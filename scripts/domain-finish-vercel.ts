import { execFile } from "node:child_process";
import { resolve4 } from "node:dns/promises";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DOMAIN = "froggyhatessnow.wiki";
const CUSTOM_SITE = `https://${DOMAIN}`;
const VERCEL_SITE = "https://froggyhatessnow-wiki.vercel.app";
const VERCEL_IP = "76.76.21.21";
const CONFIRM_FLAG = "--confirm-canonical-switch";

const argSet = new Set(process.argv.slice(2));

async function run(command: string, args: string[]) {
  console.error(`$ ${[command, ...args].join(" ")}`);
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      maxBuffer: 50 * 1024 * 1024
    });
    if (stdout.trim()) console.log(stdout.trim());
    if (stderr.trim()) console.error(stderr.trim());
    return [stdout, stderr].filter(Boolean).join("\n").trim();
  } catch (error) {
    const failed = error as Error & { stdout?: string; stderr?: string };
    if (failed.stdout?.trim()) console.log(failed.stdout.trim());
    if (failed.stderr?.trim()) console.error(failed.stderr.trim());
    throw new Error(`Command failed: ${command} ${args.join(" ")}\n${failed.message}`);
  }
}

async function runOptional(command: string, args: string[]) {
  try {
    await run(command, args);
  } catch (error) {
    console.error(`Expected incomplete check: ${(error as Error).message}`);
  }
}

async function gitStatusLines() {
  const { stdout } = await execFileAsync("git", ["status", "--short"], {
    maxBuffer: 1024 * 1024
  });
  return stdout.trim().split(/\r?\n/).filter(Boolean);
}

async function assertCleanTree() {
  const status = await gitStatusLines();
  if (status.length > 0) {
    throw new Error(`Refusing to finish Vercel domain setup with a dirty working tree:\n${status.join("\n")}`);
  }
}

async function assertRemoteMatchesLocal() {
  const [headResult, remoteResult] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"], { maxBuffer: 1024 * 1024 }),
    execFileAsync("git", ["ls-remote", "origin", "refs/heads/main"], { maxBuffer: 1024 * 1024 })
  ]);
  const localHead = headResult.stdout.trim();
  const remoteHead = remoteResult.stdout.split(/\s+/)[0] ?? "";
  if (!localHead || localHead !== remoteHead) {
    throw new Error(`Refusing to finish Vercel domain setup: local HEAD ${localHead || "unknown"} does not match origin/main ${remoteHead || "unknown"}.`);
  }
}

async function assertVercelDomain(hostname: string) {
  const output = await run("npx", ["vercel", "domains", "inspect", hostname]);
  if (!output.includes(`Domain ${hostname} found`)) {
    throw new Error(`Vercel did not report ${hostname} as attached.`);
  }
  if (output.includes("WARNING! This Domain is not configured properly.")) {
    throw new Error(`Vercel reports ${hostname} is still not configured properly.`);
  }
}

async function assertDns(hostname: string) {
  try {
    const addresses = await resolve4(hostname);
    if (!addresses.includes(VERCEL_IP)) {
      throw new Error(`resolved to ${addresses.join(", ") || "no A records"}, expected ${VERCEL_IP}`);
    }
    console.error(`${hostname} resolves to ${VERCEL_IP}`);
  } catch (error) {
    throw new Error(`DNS is not ready for ${hostname}: ${(error as Error).message}`);
  }
}

async function switchAstroSite() {
  const configPath = "astro.config.mjs";
  const source = await readFile(configPath, "utf8");
  if (source.includes(`site: "${CUSTOM_SITE}"`)) {
    console.error(`${configPath} already uses ${CUSTOM_SITE}`);
    return;
  }
  if (!source.includes(`site: "${VERCEL_SITE}"`)) {
    throw new Error(`Refusing to update ${configPath}: expected current site ${VERCEL_SITE}.`);
  }
  await writeFile(configPath, source.replace(`site: "${VERCEL_SITE}"`, `site: "${CUSTOM_SITE}"`));
  console.error(`Updated ${configPath} site to ${CUSTOM_SITE}`);
}

async function main() {
  if (!argSet.has(CONFIRM_FLAG)) {
    await run("npm", ["run", "domain:vercel-price"]);
    await runOptional("npm", ["run", "domain:health"]);
    throw new Error(
      [
        "Dry run only. This command is for after Vercel has already purchased/registered the domain.",
        "It will switch the Astro canonical site, validate, build, commit, push, deploy, and run the completion audit.",
        `After the Vercel registrar purchase and DNS propagation, run: npm run domain:finish:vercel-post-purchase`
      ].join("\n")
    );
  }

  await assertCleanTree();
  await assertRemoteMatchesLocal();
  await assertVercelDomain(DOMAIN);
  await assertVercelDomain(`www.${DOMAIN}`);
  await assertDns(DOMAIN);
  await assertDns(`www.${DOMAIN}`);
  await switchAstroSite();
  await run("npm", ["run", "validate"]);
  await run("npm", ["run", "build"]);
  await run("npm", ["run", "domain:commit-canonical", "--", "--deploy-after-commit"]);
}

await main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
