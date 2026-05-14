import { createReadStream } from "node:fs";
import { rm, stat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

type Env = Record<string, string>;

function parseEnvValue(value: string, env: Env) {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  return trimmed.replace(/\$\{([A-Z0-9_]+)\}/g, (_, key: string) => env[key] ?? "");
}

async function loadEnvFile(filePath: string, env: Env) {
  try {
    const raw = await readFile(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match) continue;
      env[match[1]] = parseEnvValue(match[2], env);
    }
  } catch (error) {
    const failed = error as NodeJS.ErrnoException;
    if (failed.code !== "ENOENT") throw error;
  }
}

function requireEnv(env: Env, key: string) {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing required R2 env var: ${key}`);
  return value;
}

function parseArgs(argv: string[]) {
  const paths: string[] = [];
  let prefix = "";
  let deleteLocal = false;
  let dryRun = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--prefix") {
      prefix = argv[++index] ?? "";
    } else if (arg === "--delete-local") {
      deleteLocal = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      paths.push(arg);
    }
  }
  return { paths: paths.length > 0 ? paths : ["tmp"], prefix, deleteLocal, dryRun };
}

async function walk(inputPath: string): Promise<string[]> {
  const info = await stat(inputPath);
  if (info.isFile()) return [inputPath];
  if (!info.isDirectory()) return [];
  const entries = await readdir(inputPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.name !== ".DS_Store")
      .map((entry) => walk(path.join(inputPath, entry.name)))
  );
  return nested.flat();
}

function assertAllowedPath(inputPath: string) {
  const normalized = path.relative(process.cwd(), path.resolve(inputPath)).replace(/\\/g, "/");
  if (normalized === "game-files" || normalized.startsWith("game-files/")) {
    throw new Error("Refusing to upload game-files/. Project policy keeps game-files local-only.");
  }
  if (normalized === "node_modules" || normalized.startsWith("node_modules/")) {
    throw new Error("Refusing to upload node_modules/. Reinstall dependencies instead.");
  }
}

function r2Key(prefix: string, filePath: string) {
  const relative = path.relative(process.cwd(), path.resolve(filePath)).replace(/\\/g, "/");
  return [prefix.replace(/^\/+|\/+$/g, ""), relative].filter(Boolean).join("/");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env: Env = { ...process.env } as Env;
  await loadEnvFile(".env", env);
  await loadEnvFile(".env.local", env);

  const bucket = requireEnv(env, "R2_BUCKET");
  const endpoint = requireEnv(env, "R2_ENDPOINT");
  const accessKeyId = requireEnv(env, "R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv(env, "R2_SECRET_ACCESS_KEY");
  const prefix = args.prefix || `offloads/${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true
  });

  for (const inputPath of args.paths) assertAllowedPath(inputPath);

  const files = (await Promise.all(args.paths.map(walk))).flat();
  const totalBytes = (
    await Promise.all(files.map(async (filePath) => (await stat(filePath)).size))
  ).reduce((sum, size) => sum + size, 0);

  console.log(
    JSON.stringify({
      bucket,
      prefix,
      paths: args.paths,
      files: files.length,
      bytes: totalBytes,
      dryRun: args.dryRun,
      deleteLocal: args.deleteLocal
    })
  );

  if (args.dryRun) return;

  for (const filePath of files) {
    const key = r2Key(prefix, filePath);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: createReadStream(filePath)
      })
    );
    console.log(`uploaded ${key}`);
  }

  if (args.deleteLocal) {
    for (const inputPath of args.paths) {
      await rm(inputPath, { recursive: true, force: true });
      console.log(`removed local ${inputPath}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
