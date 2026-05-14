import { execFile } from "node:child_process";
import { resolve4 } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DOMAIN = "froggyhatessnow.wiki";
const CUSTOM_SITE = `https://${DOMAIN}`;
const VERCEL_IP = "76.76.21.21";
const FETCH_TIMEOUT_MS = 10_000;

type CommandResult = {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
};

type HealthCheck = {
  name: string;
  ok: boolean;
  required?: boolean;
  details: Record<string, unknown>;
};

async function run(command: string, args: string[]): Promise<CommandResult> {
  const rendered = [command, ...args].join(" ");
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      maxBuffer: 20 * 1024 * 1024
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

function parseDomainStatus(stdout: string) {
  const nextStepStatus = stdout.match(/nextStep:\s*{[\s\S]*?"status":\s*"([^"]+)"/)?.[1] ?? "unknown";
  return {
    available: /"available":\s*"yes"/.test(stdout),
    registeredInPorkbunAccount: /"registeredInPorkbunAccount":\s*true/.test(stdout),
    dnsInvalidDomain: /"code":\s*"INVALID_DOMAIN"/.test(stdout),
    nextStepStatus
  };
}

function combinedOutput(result: CommandResult) {
  return [result.stdout, result.stderr].filter(Boolean).join("\n");
}

async function astroCanonicalCheck(): Promise<HealthCheck> {
  const configPath = "astro.config.mjs";
  const source = await readFile(configPath, "utf8");
  return {
    name: "astro-canonical-site",
    ok: source.includes(`site: "${CUSTOM_SITE}"`),
    details: {
      path: configPath,
      expectedSite: CUSTOM_SITE,
      containsExpectedSite: source.includes(`site: "${CUSTOM_SITE}"`)
    }
  };
}

async function dnsCheck(hostname: string): Promise<HealthCheck> {
  try {
    const addresses = await resolve4(hostname);
    return {
      name: `dns:${hostname}`,
      ok: addresses.includes(VERCEL_IP),
      details: {
        hostname,
        addresses,
        expectedAddress: VERCEL_IP
      }
    };
  } catch (error) {
    return {
      name: `dns:${hostname}`,
      ok: false,
      details: {
        hostname,
        expectedAddress: VERCEL_IP,
        error: (error as Error).message
      }
    };
  }
}

async function fetchCheck(baseUrl: string, pathname: string, requiredText: string, label: string): Promise<HealthCheck> {
  const url = `${baseUrl}${pathname}`;
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
    const body = await response.text();
    return {
      name: `http:${label}:${url}`,
      ok: response.ok && body.includes(requiredText),
      details: {
        url,
        httpStatus: response.status,
        containsRequiredText: body.includes(requiredText),
        requiredText
      }
    };
  } catch (error) {
    const failed = error as Error & { cause?: { message?: string; code?: string } };
    return {
      name: `http:${label}:${url}`,
      ok: false,
      details: {
        url,
        requiredText,
        error: failed.message,
        cause: failed.cause
          ? {
              message: failed.cause.message,
              code: failed.cause.code
            }
          : undefined
      }
    };
  }
}

async function main() {
  const [canonical, porkbunStatus, vercelApex, vercelWww, apexDns, wwwDns] = await Promise.all([
    astroCanonicalCheck(),
    run("npm", ["run", "domain:status"]),
    run("npx", ["vercel", "domains", "inspect", DOMAIN]),
    run("npx", ["vercel", "domains", "inspect", `www.${DOMAIN}`]),
    dnsCheck(DOMAIN),
    dnsCheck(`www.${DOMAIN}`)
  ]);

  const httpChecks = await Promise.all(
    [`https://${DOMAIN}`, `https://www.${DOMAIN}`].flatMap((baseUrl) => [
      fetchCheck(baseUrl, "/", "FROGGY HATES SNOW Wiki", "homepage"),
      fetchCheck(baseUrl, "/generated/frogs/", "Playable Frogs", "frogs-page"),
      fetchCheck(baseUrl, "/generated/mechanics/", "Mechanics", "mechanics-page"),
      fetchCheck(baseUrl, "/generated/quests/", "Quest Templates", "quests-page")
    ])
  );

  const commandChecks: HealthCheck[] = [
    {
      name: "porkbun-domain-status",
      ok: porkbunStatus.exitCode === 0 && parseDomainStatus(porkbunStatus.stdout).registeredInPorkbunAccount,
      required: false,
      details: {
        command: porkbunStatus.command,
        exitCode: porkbunStatus.exitCode,
        note: "Informational. A domain registered through Vercel or another registrar is acceptable if Vercel attachment, DNS, canonical config, and custom-domain HTTP checks all pass.",
        parsed: parseDomainStatus(porkbunStatus.stdout),
        stderr: porkbunStatus.stderr
      }
    },
    {
      name: "vercel-domain-apex",
      ok: vercelApex.exitCode === 0 && combinedOutput(vercelApex).includes(`Domain ${DOMAIN} found`),
      details: {
        command: vercelApex.command,
        exitCode: vercelApex.exitCode,
        stderr: vercelApex.stderr
      }
    },
    {
      name: "vercel-domain-www",
      ok: vercelWww.exitCode === 0 && combinedOutput(vercelWww).includes(`Domain www.${DOMAIN} found`),
      details: {
        command: vercelWww.command,
        exitCode: vercelWww.exitCode,
        stderr: vercelWww.stderr
      }
    }
  ];

  const checks = [canonical, ...commandChecks, apexDns, wwwDns, ...httpChecks];
  const ok = checks.filter((check) => check.required !== false).every((check) => check.ok);
  const report = {
    ok,
    domain: DOMAIN,
    expectedVercelAddress: VERCEL_IP,
    checks
  };

  console.log(JSON.stringify(report, null, 2));
  if (!ok) process.exitCode = 1;
}

await main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
