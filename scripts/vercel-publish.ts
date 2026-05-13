import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const REMOVE_STUCK_FLAG = "--remove-stuck-after-approval";
const ALLOW_DIRTY_FLAG = "--allow-dirty";

type DeploymentBlocker = {
  id: string;
  readyState?: string;
  url?: string;
};

type DeployStatus = {
  local?: {
    dirty?: boolean;
  };
  aliasHealth?: {
    liveChecksPassed?: boolean;
  };
  nextStep?: {
    status?: string;
    command?: string;
    deploymentQueueBlockers?: DeploymentBlocker[];
    manualReviewIds?: string[];
  };
};

const args = new Set(process.argv.slice(2));

async function run(command: string, commandArgs: string[]) {
  console.error(`$ ${[command, ...commandArgs].join(" ")}`);
  const { stdout, stderr } = await execFileAsync(command, commandArgs, {
    maxBuffer: 20 * 1024 * 1024
  });
  if (stdout.trim()) console.log(stdout.trim());
  if (stderr.trim()) console.error(stderr.trim());
  return stdout;
}

function parseJsonOutput<T>(raw: string): T {
  const jsonStart = raw.indexOf("{");
  if (jsonStart < 0) throw new Error(`Expected JSON output, received: ${raw.slice(0, 200)}`);
  return JSON.parse(raw.slice(jsonStart)) as T;
}

function blockerIds(status: DeployStatus) {
  const blockers = status.nextStep?.deploymentQueueBlockers?.map((blocker) => blocker.id) ?? [];
  const manualReviewIds = status.nextStep?.manualReviewIds ?? [];
  return [...new Set([...blockers, ...manualReviewIds])].filter((id) => id.length > 0);
}

async function getStatus() {
  const raw = await run("npm", ["run", "deploy:status"]);
  return parseJsonOutput<DeployStatus>(raw);
}

async function main() {
  const removeStuckAfterApproval = args.has(REMOVE_STUCK_FLAG);
  const allowDirty = args.has(ALLOW_DIRTY_FLAG);

  const status = await getStatus();
  const ids = blockerIds(status);

  if (status.local?.dirty && !allowDirty) {
    throw new Error(`Refusing to publish while the working tree is dirty. Commit/stash first, or pass ${ALLOW_DIRTY_FLAG}.`);
  }

  if (ids.length > 0 && !removeStuckAfterApproval) {
    throw new Error(
      [
        `Refusing to remove remote Vercel deployments without explicit approval.`,
        `Blocking deployment ids: ${ids.join(", ")}`,
        `After approval, run: npm run deploy:publish -- ${REMOVE_STUCK_FLAG}`
      ].join("\n")
    );
  }

  if (ids.length > 0) {
    await run("npx", ["vercel", "remove", "--safe", ...ids]);
  }

  await run("npx", ["vercel", "build", "--prod", "--yes"]);
  await run("npx", ["vercel", "deploy", "--prebuilt", "--prod"]);

  const afterStatus = await getStatus();
  if (!afterStatus.aliasHealth?.liveChecksPassed) {
    throw new Error("Publish command finished, but deploy:status still reports failing live checks.");
  }
}

await main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
