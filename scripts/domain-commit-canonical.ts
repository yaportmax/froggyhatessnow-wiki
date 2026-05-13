import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DOMAIN = "froggyhatessnow.wiki";
const CUSTOM_SITE = `https://${DOMAIN}`;

async function run(command: string, args: string[]) {
  console.error(`$ ${[command, ...args].join(" ")}`);
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      maxBuffer: 50 * 1024 * 1024
    });
    if (stdout.trim()) console.log(stdout.trim());
    if (stderr.trim()) console.error(stderr.trim());
    return stdout.trim();
  } catch (error) {
    const failed = error as Error & { stdout?: string; stderr?: string };
    if (failed.stdout?.trim()) console.log(failed.stdout.trim());
    if (failed.stderr?.trim()) console.error(failed.stderr.trim());
    throw new Error(`Command failed: ${command} ${args.join(" ")}\n${failed.message}`);
  }
}

async function gitStatus() {
  const { stdout } = await execFileAsync("git", ["status", "--short"], {
    maxBuffer: 1024 * 1024
  });
  return stdout.trim().split(/\r?\n/).filter(Boolean);
}

async function assertRemoteMatchesLocal() {
  const [headResult, remoteResult] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"], { maxBuffer: 1024 * 1024 }),
    execFileAsync("git", ["ls-remote", "origin", "refs/heads/main"], { maxBuffer: 1024 * 1024 })
  ]);
  const localHead = headResult.stdout.trim();
  const remoteHead = remoteResult.stdout.split(/\s+/)[0] ?? "";
  if (!localHead || localHead !== remoteHead) {
    throw new Error(`Refusing to commit canonical switch: local HEAD ${localHead || "unknown"} does not match origin/main ${remoteHead || "unknown"}.`);
  }
}

async function assertAstroCanonical() {
  const source = await readFile("astro.config.mjs", "utf8");
  if (!source.includes(`site: "${CUSTOM_SITE}"`)) {
    throw new Error(`Refusing to commit canonical switch: astro.config.mjs does not contain site: "${CUSTOM_SITE}".`);
  }
}

async function main() {
  await run("npm", ["run", "domain:health"]);
  await assertAstroCanonical();
  const status = await gitStatus();
  if (status.length === 0) {
    await run("npm", ["run", "audit:completion"]);
    console.error("No canonical commit needed; working tree is already clean.");
    return;
  }

  const expected = [" M astro.config.mjs"];
  if (status.length !== expected.length || status.some((line, index) => line !== expected[index])) {
    throw new Error(`Refusing to commit canonical switch with unexpected working tree changes:\n${status.join("\n")}`);
  }

  await assertRemoteMatchesLocal();
  await run("git", ["add", "astro.config.mjs"]);
  await run("git", ["commit", "-m", "Switch canonical site to custom domain"]);
  await run("git", ["push", "origin", "main"]);
  await run("npm", ["run", "audit:completion"]);
}

await main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
