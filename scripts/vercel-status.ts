import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PROJECT = "froggyhatessnow-wiki";
const SCOPE = "yaportmax-5253s-projects";
const STABLE_ALIAS = "https://froggyhatessnow-wiki.vercel.app";
const KNOWN_DEPLOYMENTS = [
  "https://froggyhatessnow-wiki-md282qwlk-yaportmax-5253s-projects.vercel.app",
  "https://froggyhatessnow-wiki-kyvn13zp7-yaportmax-5253s-projects.vercel.app",
  "https://froggyhatessnow-wiki-biugqd5z2-yaportmax-5253s-projects.vercel.app"
];

type VercelInspect = {
  uid?: string;
  id?: string;
  url?: string;
  readyState?: string;
  target?: string;
  alias?: string[];
  aliases?: string[];
};

type SteamSnapshot = {
  generated_at?: string;
};

async function runVercel(args: string[], options: { allowJsonOnFailure?: boolean } = {}) {
  try {
    const { stdout } = await execFileAsync("npx", ["vercel", ...args], {
      maxBuffer: 10 * 1024 * 1024
    });
    return stdout;
  } catch (error) {
    const failed = error as Error & { stdout?: string; stderr?: string };
    const stdout = failed.stdout ?? "";
    if (options.allowJsonOnFailure && stdout.includes("{")) return stdout;
    const stderr = failed.stderr ? `\n${failed.stderr.trim()}` : "";
    const output = stdout ? `\n${stdout.trim()}` : "";
    throw new Error(`${failed.message}${stderr}${output}`);
  }
}

async function runGit(args: string[]) {
  const { stdout } = await execFileAsync("git", args, {
    maxBuffer: 1024 * 1024
  });
  return stdout.trim();
}

function parseJsonOutput<T>(raw: string): T {
  const jsonStart = raw.indexOf("{");
  if (jsonStart < 0) throw new Error(`Expected JSON output, received: ${raw.slice(0, 200)}`);
  return JSON.parse(raw.slice(jsonStart)) as T;
}

async function readSteamSnapshot() {
  const snapshotPath = new URL("../src/data/steam-snapshot.json", import.meta.url);
  const raw = await readFile(snapshotPath, "utf8");
  const snapshot = JSON.parse(raw) as SteamSnapshot;
  if (!snapshot.generated_at) throw new Error("steam-snapshot.json is missing generated_at");
  return snapshot;
}

async function inspectDeployment(url: string) {
  const raw = await runVercel(["inspect", url, "--format=json"], { allowJsonOnFailure: true });
  const data = parseJsonOutput<VercelInspect>(raw);
  return {
    id: data.uid ?? data.id ?? "unknown",
    url: data.url ? `https://${data.url.replace(/^https?:\/\//, "")}` : url,
    readyState: data.readyState ?? "unknown",
    target: data.target ?? "unknown",
    aliases: data.aliases ?? data.alias ?? []
  };
}

async function checkPage(pathname: string, requiredText: string, label = requiredText) {
  const url = `${STABLE_ALIAS}${pathname}`;
  const response = await fetch(url);
  const body = await response.text();
  return {
    url,
    httpStatus: response.status,
    ok: response.ok,
    containsRequiredText: body.includes(requiredText),
    requiredText,
    label
  };
}

async function main() {
  const [listOutput, activeDeployment, deployments, gitHead, gitStatus, steamSnapshot] = await Promise.all([
    runVercel(["list", PROJECT, "--scope", SCOPE]),
    inspectDeployment(STABLE_ALIAS),
    Promise.all(KNOWN_DEPLOYMENTS.map(inspectDeployment)),
    runGit(["rev-parse", "HEAD"]),
    runGit(["status", "--short"]),
    readSteamSnapshot()
  ]);
  const liveChecks = await Promise.all([
    checkPage("/", "FROGGY HATES SNOW Wiki"),
    checkPage("/steam-source-snapshot/", "All Steam News Items"),
    checkPage(
      "/steam-source-snapshot/",
      `Generated: ${steamSnapshot.generated_at}`,
      "Current local Steam snapshot generated_at"
    ),
    checkPage("/achievement-source-matrix/", "Loadout Names"),
    checkPage("/", 'property="og:image"', "homepage Open Graph image"),
    checkPage("/robots.txt", "sitemap-index.xml", "robots sitemap"),
    checkPage("/llms.txt", `Source snapshot generated: ${steamSnapshot.generated_at}`, "llms source snapshot marker")
  ]);
  const liveChecksPassed = liveChecks.every((check) => check.ok && check.containsRequiredText);
  const failedLiveChecks = liveChecks.filter((check) => !check.ok || !check.containsRequiredText);
  const nonReady = deployments.filter((deployment) => !["READY", "CANCELED", "ERROR"].includes(deployment.readyState));
  const nonReadyWithAliases = nonReady.filter((deployment) => deployment.aliases.length > 0);
  const safeToRemove = nonReady.filter((deployment) => deployment.aliases.length === 0);

  console.log(
    JSON.stringify(
      {
        project: `${SCOPE}/${PROJECT}`,
        local: {
          gitHead,
          dirty: gitStatus.length > 0,
          steamSnapshotGeneratedAt: steamSnapshot.generated_at
        },
        stableAlias: STABLE_ALIAS,
        activeDeployment,
        aliasHealth: {
          activeDeploymentReady: activeDeployment.readyState === "READY",
          liveChecksPassed
        },
        deployments,
        nonReadyWithAliases,
        liveChecks,
        listSummary: listOutput
          .split(/\r?\n/)
          .filter((line) => line.includes(PROJECT) || line.includes("Status"))
          .slice(0, 8),
        nextStep:
          failedLiveChecks.length > 0
            ? {
                status: "stable_alias_missing_expected_content",
                note: "The live alias is healthy, but it does not contain one or more expected local-source markers. The latest local/pushed snapshot is probably not deployed yet.",
                failedChecks: failedLiveChecks.map((check) => ({
                  url: check.url,
                  label: check.label,
                  requiredText: check.requiredText
                })),
                deploymentQueueBlockers: nonReady.map((deployment) => ({
                  id: deployment.id,
                  readyState: deployment.readyState,
                  url: deployment.url
                })),
                ...(nonReady.length === 0
                  ? {
                      command: "npm run deploy:publish"
                    }
                  : {
                      afterApprovalAndRemoval: "npm run deploy:publish -- --remove-stuck-after-approval"
                    })
              }
            : nonReadyWithAliases.length > 0
            ? {
                status: "non_ready_deployments_have_aliases",
                note: "The non-ready deployments report aliases in Vercel inspect output. Do not remove them from automation; inspect in the Vercel dashboard or remove only with explicit human approval.",
                manualReviewIds: nonReadyWithAliases.map((deployment) => deployment.id)
              }
            : safeToRemove.length > 0
            ? {
                status: "non_ready_deployments_blocking_queue",
                note: "Removal is a remote destructive action; get explicit approval first.",
                command: `npx vercel remove --safe ${safeToRemove.map((deployment) => deployment.id).join(" ")}`,
                afterApprovalAndRemoval: "npx vercel deploy --prebuilt --prod"
              }
            : {
                status: "no_known_non_ready_deployments",
                command: "npx vercel deploy --prebuilt --prod"
              }
      },
      null,
      2
    )
  );
}

await main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
