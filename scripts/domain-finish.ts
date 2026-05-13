import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DOMAIN = "froggyhatessnow.wiki";
const CUSTOM_SITE = `https://${DOMAIN}`;
const VERCEL_SITE = "https://froggyhatessnow-wiki.vercel.app";
const CONFIRM_FLAG = "--confirm-register-and-dns";
const ALLOW_DIRTY_FLAG = "--allow-dirty";
const SKIP_SITE_SWITCH_FLAG = "--skip-site-switch";
const DEFAULT_MAX_COST = "2.06";
const DEFAULT_IDEMPOTENCY_SUFFIX = "post-verification";

const args = process.argv.slice(2);
const argSet = new Set(args);

async function run(command: string, commandArgs: string[]) {
  console.error(`$ ${[command, ...commandArgs].join(" ")}`);
  const { stdout, stderr } = await execFileAsync(command, commandArgs, {
    maxBuffer: 30 * 1024 * 1024
  });
  if (stdout.trim()) console.log(stdout.trim());
  if (stderr.trim()) console.error(stderr.trim());
  return stdout;
}

async function gitStatus() {
  const { stdout } = await execFileAsync("git", ["status", "--short"], {
    maxBuffer: 1024 * 1024
  });
  return stdout.trim();
}

function optionValue(name: string, fallback: string) {
  const prefix = `${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
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

async function inspectDomains() {
  await run("npx", ["vercel", "domains", "inspect", DOMAIN]);
  await run("npx", ["vercel", "domains", "inspect", `www.${DOMAIN}`]);
}

async function main() {
  const confirmed = argSet.has(CONFIRM_FLAG);
  if (!confirmed) {
    await run("npm", ["run", "domain:status"]);
    await run("npm", ["run", "deploy:status"]);
    throw new Error(
      [
        "Dry run only. This command will register a domain, configure DNS, switch the Astro canonical site, build, and deploy.",
        `After Porkbun account verification, run: npm run domain:finish -- ${CONFIRM_FLAG}`,
        `Optional: --max-cost-usd=${DEFAULT_MAX_COST} --idempotency-suffix=${DEFAULT_IDEMPOTENCY_SUFFIX} ${SKIP_SITE_SWITCH_FLAG}`
      ].join("\n")
    );
  }

  const dirty = await gitStatus();
  if (dirty && !argSet.has(ALLOW_DIRTY_FLAG)) {
    throw new Error(`Refusing to finish domain setup with a dirty working tree. Commit/stash first, or pass ${ALLOW_DIRTY_FLAG}.`);
  }

  const maxCost = optionValue("--max-cost-usd", DEFAULT_MAX_COST);
  const idempotencySuffix = optionValue("--idempotency-suffix", DEFAULT_IDEMPOTENCY_SUFFIX);
  await run("npm", [
    "run",
    "domain:register",
    "--",
    `--max-cost-usd=${maxCost}`,
    `--idempotency-suffix=${idempotencySuffix}`
  ]);
  await run("npm", ["run", "domain:dns"]);

  if (!argSet.has(SKIP_SITE_SWITCH_FLAG)) {
    await switchAstroSite();
  }

  await inspectDomains();
  await run("npm", ["run", "validate"]);
  await run("npm", ["run", "build"]);
  await run("npx", ["vercel", "build", "--prod", "--yes"]);
  await run("npx", ["vercel", "deploy", "--prebuilt", "--prod"]);
  await run("npm", ["run", "deploy:status"]);
  await inspectDomains();
}

await main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
