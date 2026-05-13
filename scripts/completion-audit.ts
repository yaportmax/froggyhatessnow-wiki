import { execFile } from "node:child_process";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { REQUIRED_DATASETS } from "./validate-data.ts";

const execFileAsync = promisify(execFile);

const DOMAIN = "froggyhatessnow.wiki";
const CUSTOM_SITE = `https://${DOMAIN}`;
const REQUIRED_PATHS = [
  ".gitignore",
  "README.md",
  "AGENTS.md",
  "package.json",
  "astro.config.mjs",
  "scripts/scan-game-files.ts",
  "scripts/generate-pages.ts",
  "scripts/validate-data.ts",
  "scripts/completion-audit.ts",
  "scripts/domain-health.ts",
  "scripts/domain-commit-canonical.ts",
  "notes/public-research.md",
  "notes/extracted-metadata.md",
  "notes/extracted-metadata.json",
  "notes/domain-options.md",
  "notes/porkbun-verification-support.md",
  "notes/final-handoff.md",
  "notes/completion-audit.md",
  "src/content/docs/index.md",
  "src/content/docs/guides/beginner-guide.md",
  "src/content/docs/guides/warmth-management.md",
  "src/content/docs/guides/best-upgrades.md",
  "src/content/docs/guides/unlocks.md",
  "src/content/docs/guides/game-modes.md",
  "src/content/docs/faq.md",
  "src/content/docs/contribute.md",
  "src/content/docs/verification-status.md",
  "src/content/docs/game-metadata.md",
  "src/content/docs/steam-source-snapshot.md",
  "src/content/docs/achievement-source-matrix.md",
  "src/content/docs/source-ledger.md"
];
const REQUIRED_SCRIPTS = ["dev", "build", "preview", "scan", "fetch:steam", "refresh:data", "generate", "validate", "build:verified"];
const SUPPORTING_SCRIPTS = [
  "test",
  "deploy:status",
  "deploy:publish",
  "domain:check",
  "domain:status",
  "domain:register",
  "domain:dns",
  "domain:finish",
  "domain:finish:post-verification",
  "domain:vercel-price",
  "domain:vercel-buy",
  "domain:finish:vercel-post-purchase",
  "domain:health",
  "domain:commit-canonical",
  "audit:completion"
];

type Check = {
  name: string;
  ok: boolean;
  details: Record<string, unknown>;
};

type CommandResult = {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
};

async function run(command: string, args: string[]): Promise<CommandResult> {
  const rendered = [command, ...args].join(" ");
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      maxBuffer: 50 * 1024 * 1024
    });
    return { command: rendered, exitCode: 0, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (error) {
    const failed = error as Error & { code?: number; stdout?: string; stderr?: string };
    return {
      command: rendered,
      exitCode: typeof failed.code === "number" ? failed.code : 1,
      stdout: failed.stdout?.trim() ?? "",
      stderr: failed.stderr?.trim() ?? failed.message
    };
  }
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function jsonFromCommand(raw: string) {
  const start = raw.indexOf("{");
  if (start < 0) return null;
  try {
    return JSON.parse(raw.slice(start)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function pathChecks(): Promise<Check[]> {
  const checks: Check[] = [];
  for (const filePath of REQUIRED_PATHS) {
    checks.push({
      name: `path:${filePath}`,
      ok: await exists(filePath),
      details: { path: filePath }
    });
  }
  for (const dataset of REQUIRED_DATASETS) {
    const dataPath = `src/data/${dataset}.json`;
    const indexPath = `src/content/docs/generated/${dataset}/index.md`;
    checks.push({ name: `data:${dataset}`, ok: await exists(dataPath), details: { path: dataPath } });
    checks.push({ name: `generated-index:${dataset}`, ok: await exists(indexPath), details: { path: indexPath } });
  }
  checks.push({
    name: "data:public-sources",
    ok: await exists("src/data/public-sources.json"),
    details: { path: "src/data/public-sources.json" }
  });
  checks.push({
    name: "data:steam-snapshot",
    ok: await exists("src/data/steam-snapshot.json"),
    details: { path: "src/data/steam-snapshot.json" }
  });
  return checks;
}

async function packageChecks(): Promise<Check[]> {
  const raw = await readFile("package.json", "utf8");
  const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
  const scripts = pkg.scripts ?? {};
  return [...REQUIRED_SCRIPTS, ...SUPPORTING_SCRIPTS].map((script) => ({
    name: `package-script:${script}`,
    ok: script in scripts,
    details: { script, command: scripts[script] ?? null, required: REQUIRED_SCRIPTS.includes(script) }
  }));
}

async function dataCoverageCheck(): Promise<Check> {
  const counts: Record<string, number> = {};
  const statuses: Record<string, number> = {};
  let total = 0;
  for (const dataset of REQUIRED_DATASETS) {
    const rows = JSON.parse(await readFile(`src/data/${dataset}.json`, "utf8")) as Array<Record<string, unknown>>;
    counts[dataset] = rows.length;
    total += rows.length;
    for (const row of rows) {
      const status = String(row.verification_status ?? "unknown");
      statuses[status] = (statuses[status] ?? 0) + 1;
    }
  }
  return {
    name: "data-coverage",
    ok: total > 0 && counts.tools > 0,
    details: { totalEntities: total, counts, verificationStatuses: statuses }
  };
}

async function generatedPageCheck(): Promise<Check> {
  const files = await walk("src/content/docs/generated");
  const indexFiles = files.filter((file) => file.endsWith(`${path.sep}index.md`));
  const entityCounts = await Promise.all(
    REQUIRED_DATASETS.map(async (dataset) => {
      const rows = JSON.parse(await readFile(`src/data/${dataset}.json`, "utf8")) as unknown[];
      return rows.length;
    })
  );
  const expectedMinimum = entityCounts.reduce((sum, count) => sum + count, 0) + REQUIRED_DATASETS.length;
  return {
    name: "generated-pages",
    ok: indexFiles.length >= expectedMinimum,
    details: { generatedIndexFiles: indexFiles.length, expectedMinimum }
  };
}

async function walk(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) return walk(entryPath);
      if (entry.isFile()) return [entryPath];
      return [];
    })
  );
  return files.flat();
}

async function gitChecks(): Promise<Check[]> {
  const [status, head, remote, ignoredGameFiles] = await Promise.all([
    run("git", ["status", "--short"]),
    run("git", ["rev-parse", "HEAD"]),
    run("git", ["ls-remote", "origin", "refs/heads/main"]),
    run("git", ["check-ignore", "-q", "game-files/sentinel"])
  ]);
  const localHead = head.stdout.trim();
  const remoteHead = remote.stdout.split(/\s+/)[0] ?? "";
  return [
    {
      name: "git-clean",
      ok: status.exitCode === 0 && status.stdout.length === 0,
      details: { exitCode: status.exitCode, status: status.stdout }
    },
    {
      name: "git-remote-main-matches-local",
      ok: head.exitCode === 0 && remote.exitCode === 0 && localHead.length > 0 && localHead === remoteHead,
      details: { localHead, remoteHead }
    },
    {
      name: "game-files-gitignored",
      ok: ignoredGameFiles.exitCode === 0,
      details: { path: "game-files/sentinel" }
    }
  ];
}

async function astroCanonicalCheck(): Promise<Check> {
  const source = await readFile("astro.config.mjs", "utf8");
  return {
    name: "astro-canonical-custom-domain",
    ok: source.includes(`site: "${CUSTOM_SITE}"`),
    details: {
      expectedSite: CUSTOM_SITE,
      containsExpectedSite: source.includes(`site: "${CUSTOM_SITE}"`)
    }
  };
}

function commandCheck(name: string, result: CommandResult, expectSuccess: boolean): Check {
  return {
    name,
    ok: expectSuccess ? result.exitCode === 0 : result.exitCode !== 0,
    details: {
      command: result.command,
      exitCode: result.exitCode,
      stdoutTail: result.stdout.slice(-1200),
      stderrTail: result.stderr.slice(-1200)
    }
  };
}

async function main() {
  const checks: Check[] = [
    ...(await pathChecks()),
    ...(await packageChecks()),
    await dataCoverageCheck(),
    await generatedPageCheck(),
    ...(await gitChecks()),
    await astroCanonicalCheck()
  ];

  const [validate, test, build, deployStatus, domainHealth] = await Promise.all([
    run("npm", ["run", "validate"]),
    run("npm", ["test"]),
    run("npm", ["run", "build"]),
    run("npm", ["run", "deploy:status"]),
    run("npm", ["run", "domain:health"])
  ]);

  checks.push(commandCheck("command:validate", validate, true));
  checks.push(commandCheck("command:test", test, true));
  checks.push(commandCheck("command:build", build, true));
  checks.push(commandCheck("command:deploy-status", deployStatus, true));
  checks.push(commandCheck("command:domain-health", domainHealth, true));

  const deployReport = jsonFromCommand(deployStatus.stdout);
  const domainReport = jsonFromCommand(domainHealth.stdout);
  const missing = checks.filter((check) => !check.ok);
  const report = {
    ok: missing.length === 0,
    objective: "Unofficial metadata-first FROGGY HATES SNOW wiki with generated content, validation, deployment, and custom domain.",
    expectedRemainingBlocker:
      missing.some((check) => check.name === "command:domain-health" || check.name === "astro-canonical-custom-domain")
        ? "Custom-domain registration/DNS/canonical verification is still incomplete."
        : null,
    localDeployment: deployReport,
    customDomainHealth: domainReport,
    checks,
    missing: missing.map((check) => ({ name: check.name, details: check.details }))
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

await main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
