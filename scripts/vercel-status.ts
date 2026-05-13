import { execFile } from "node:child_process";
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

async function runVercel(args: string[]) {
  const { stdout } = await execFileAsync("npx", ["vercel", ...args], {
    maxBuffer: 10 * 1024 * 1024
  });
  return stdout;
}

function parseJsonOutput<T>(raw: string): T {
  const jsonStart = raw.indexOf("{");
  if (jsonStart < 0) throw new Error(`Expected JSON output, received: ${raw.slice(0, 200)}`);
  return JSON.parse(raw.slice(jsonStart)) as T;
}

async function inspectDeployment(url: string) {
  const raw = await runVercel(["inspect", url, "--format=json"]);
  const data = parseJsonOutput<VercelInspect>(raw);
  return {
    id: data.uid ?? data.id ?? "unknown",
    url: data.url ? `https://${data.url.replace(/^https?:\/\//, "")}` : url,
    readyState: data.readyState ?? "unknown",
    target: data.target ?? "unknown",
    aliases: data.aliases ?? data.alias ?? []
  };
}

async function checkPage(pathname: string, requiredText: string) {
  const url = `${STABLE_ALIAS}${pathname}`;
  const response = await fetch(url);
  const body = await response.text();
  return {
    url,
    httpStatus: response.status,
    ok: response.ok,
    containsRequiredText: body.includes(requiredText),
    requiredText
  };
}

async function main() {
  const listOutput = await runVercel(["list", PROJECT, "--scope", SCOPE]);
  const deployments = await Promise.all(KNOWN_DEPLOYMENTS.map(inspectDeployment));
  const liveChecks = await Promise.all([
    checkPage("/", "FROGGY HATES SNOW Wiki"),
    checkPage("/steam-source-snapshot/", "All Steam News Items"),
    checkPage("/achievement-source-matrix/", "Loadout Names")
  ]);
  const nonReady = deployments.filter((deployment) => !["READY", "CANCELED", "ERROR"].includes(deployment.readyState));
  const nonReadyWithAliases = nonReady.filter((deployment) => deployment.aliases.length > 0);
  const safeToRemove = nonReady.filter((deployment) => deployment.aliases.length === 0);

  console.log(
    JSON.stringify(
      {
        project: `${SCOPE}/${PROJECT}`,
        deployments,
        nonReadyWithAliases,
        liveChecks,
        listSummary: listOutput
          .split(/\r?\n/)
          .filter((line) => line.includes(PROJECT) || line.includes("Status"))
          .slice(0, 8),
        nextStep:
          nonReadyWithAliases.length > 0
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
