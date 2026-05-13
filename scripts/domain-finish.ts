import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DOMAIN = "froggyhatessnow.wiki";
const CUSTOM_SITE = `https://${DOMAIN}`;
const VERCEL_SITE = "https://froggyhatessnow-wiki.vercel.app";
const CONFIRM_FLAG = "--confirm-register-and-dns";
const ALLOW_DIRTY_FLAG = "--allow-dirty";
const SKIP_SITE_SWITCH_FLAG = "--skip-site-switch";
const COMMIT_CANONICAL_FLAG = "--commit-canonical-after-success";
const DEFAULT_MAX_COST = "2.06";
const CUSTOM_LIVE_CHECK_ATTEMPTS = 12;
const CUSTOM_LIVE_CHECK_DELAY_MS = 10_000;

const args = process.argv.slice(2);
const argSet = new Set(args);

async function run(command: string, commandArgs: string[]) {
  console.error(`$ ${[command, ...commandArgs].join(" ")}`);
  try {
    const { stdout, stderr } = await execFileAsync(command, commandArgs, {
      maxBuffer: 30 * 1024 * 1024
    });
    if (stdout.trim()) console.log(stdout.trim());
    if (stderr.trim()) console.error(stderr.trim());
    return stdout;
  } catch (error) {
    const failed = error as Error & { stdout?: string; stderr?: string };
    if (failed.stdout?.trim()) console.log(failed.stdout.trim());
    if (failed.stderr?.trim()) console.error(failed.stderr.trim());
    throw new Error(`Command failed: ${command} ${commandArgs.join(" ")}\n${failed.message}`);
  }
}

async function gitStatus() {
  const { stdout } = await execFileAsync("git", ["status", "--short"], {
    maxBuffer: 1024 * 1024
  });
  return stdout.trim();
}

async function gitStatusLines() {
  const status = await gitStatus();
  return status.split(/\r?\n/).filter(Boolean);
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

function optionValue(name: string, fallback: string) {
  const prefix = `${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function freshIdempotencySuffix() {
  return `post-verification-${new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15)}Z`;
}

async function readSteamSnapshotGeneratedAt() {
  const raw = await readFile("src/data/steam-snapshot.json", "utf8");
  const snapshot = JSON.parse(raw) as { generated_at?: string };
  if (!snapshot.generated_at) throw new Error("src/data/steam-snapshot.json is missing generated_at.");
  return snapshot.generated_at;
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

async function assertAstroCanonical() {
  const source = await readFile("astro.config.mjs", "utf8");
  if (!source.includes(`site: "${CUSTOM_SITE}"`)) {
    throw new Error(`astro.config.mjs does not contain site: "${CUSTOM_SITE}".`);
  }
}

async function commitCanonicalSwitchIfNeeded() {
  await assertAstroCanonical();
  await assertRemoteMatchesLocal();
  const status = await gitStatusLines();
  if (status.length === 0) {
    console.error("No canonical commit needed; working tree is already clean.");
    return;
  }

  const expected = [" M astro.config.mjs"];
  if (status.length !== expected.length || status.some((line, index) => line !== expected[index])) {
    throw new Error(`Refusing to commit canonical switch with unexpected working tree changes:\n${status.join("\n")}`);
  }

  await run("git", ["add", "astro.config.mjs"]);
  await run("git", ["commit", "-m", "Switch canonical site to custom domain"]);
  await run("git", ["push", "origin", "main"]);
}

async function inspectDomains() {
  await run("npx", ["vercel", "domains", "inspect", DOMAIN]);
  await run("npx", ["vercel", "domains", "inspect", `www.${DOMAIN}`]);
}

async function fetchCheck(baseUrl: string, pathname: string, requiredText: string, label: string) {
  const url = `${baseUrl}${pathname}`;
  try {
    const response = await fetch(url, { redirect: "follow" });
    const body = await response.text();
    return {
      url,
      httpStatus: response.status,
      ok: response.ok,
      containsRequiredText: body.includes(requiredText),
      requiredText,
      label
    };
  } catch (error) {
    return {
      url,
      httpStatus: 0,
      ok: false,
      containsRequiredText: false,
      requiredText,
      label,
      error: (error as Error).message
    };
  }
}

async function verifyCustomDomainLive() {
  const generatedAt = await readSteamSnapshotGeneratedAt();
  const baseUrls = [CUSTOM_SITE, `https://www.${DOMAIN}`];
  const checks = [
    { pathname: "/", requiredText: "FROGGY HATES SNOW Wiki", label: "homepage" },
    { pathname: "/steam-source-snapshot/", requiredText: "All Steam News Items", label: "Steam source page" },
    {
      pathname: "/steam-source-snapshot/",
      requiredText: `Generated: ${generatedAt}`,
      label: "current Steam snapshot marker"
    },
    { pathname: "/achievement-source-matrix/", requiredText: "Loadout Names", label: "achievement matrix" }
  ];

  let latestResults: Awaited<ReturnType<typeof fetchCheck>>[] = [];
  for (let attempt = 1; attempt <= CUSTOM_LIVE_CHECK_ATTEMPTS; attempt += 1) {
    latestResults = (
      await Promise.all(
        baseUrls.map((baseUrl) =>
          Promise.all(checks.map((check) => fetchCheck(baseUrl, check.pathname, check.requiredText, check.label)))
        )
      )
    ).flat();

    const failed = latestResults.filter((result) => !result.ok || !result.containsRequiredText);
    if (failed.length === 0) {
      console.log(
        JSON.stringify(
          {
            customDomainLiveChecksPassed: true,
            attempts: attempt,
            checks: latestResults
          },
          null,
          2
        )
      );
      return;
    }

    if (attempt < CUSTOM_LIVE_CHECK_ATTEMPTS) {
      console.error(
        `Custom-domain live checks not ready yet (${failed.length} failed); retrying in ${CUSTOM_LIVE_CHECK_DELAY_MS / 1000}s.`
      );
      await delay(CUSTOM_LIVE_CHECK_DELAY_MS);
    }
  }

  throw new Error(
    [
      "Custom-domain live checks failed after DNS/deploy.",
      ...latestResults
        .filter((result) => !result.ok || !result.containsRequiredText)
        .map((result) =>
          [
            `- ${result.url}`,
            `status=${result.httpStatus}`,
            `label=${result.label}`,
            `containsRequiredText=${result.containsRequiredText}`,
            "error" in result && result.error ? `error=${result.error}` : null
          ]
            .filter(Boolean)
            .join(" ")
        )
    ].join("\n")
  );
}

async function main() {
  const defaultIdempotencySuffix = freshIdempotencySuffix();
  const confirmed = argSet.has(CONFIRM_FLAG);
  if (!confirmed) {
    await run("npm", ["run", "domain:status"]);
    await run("npm", ["run", "deploy:status"]);
    throw new Error(
      [
        "Dry run only. This command will register a domain, configure DNS, switch the Astro canonical site, build, and deploy.",
        "After Porkbun account verification, run: npm run domain:finish:post-verification",
        `Optional: --max-cost-usd=${DEFAULT_MAX_COST} --idempotency-suffix=${defaultIdempotencySuffix} ${SKIP_SITE_SWITCH_FLAG} ${COMMIT_CANONICAL_FLAG}`
      ].join("\n")
    );
  }

  const dirty = await gitStatus();
  if (dirty && !argSet.has(ALLOW_DIRTY_FLAG)) {
    throw new Error(`Refusing to finish domain setup with a dirty working tree. Commit/stash first, or pass ${ALLOW_DIRTY_FLAG}.`);
  }

  const maxCost = optionValue("--max-cost-usd", DEFAULT_MAX_COST);
  const idempotencySuffix = optionValue("--idempotency-suffix", defaultIdempotencySuffix);
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

  if (argSet.has(COMMIT_CANONICAL_FLAG) && !argSet.has(SKIP_SITE_SWITCH_FLAG)) {
    await commitCanonicalSwitchIfNeeded();
    await run("npm", ["run", "deploy:publish"]);
    await inspectDomains();
    await verifyCustomDomainLive();
    await run("npm", ["run", "domain:health"]);
    await run("npm", ["run", "audit:completion"]);
    return;
  }

  await run("npx", ["vercel", "build", "--prod", "--yes"]);
  await run("npx", ["vercel", "deploy", "--prebuilt", "--prod"]);
  await run("npm", ["run", "deploy:status"]);
  await inspectDomains();
  await verifyCustomDomainLive();
  await run("npm", ["run", "domain:health"]);
  if (!argSet.has(SKIP_SITE_SWITCH_FLAG)) {
    console.error(`Custom-domain health passed. To commit, push, and redeploy the canonical config switch, run: npm run domain:commit-canonical -- --deploy-after-commit`);
  }
}

await main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
