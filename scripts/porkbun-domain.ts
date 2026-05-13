import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const API_BASE = "https://api.porkbun.com/api/json/v3";
const DOMAIN = "froggyhatessnow.wiki";
const VERCEL_IP = "76.76.21.21";
const DEFAULT_MAX_COST_USD = 2.06;

type PorkbunResponse = {
  status?: string;
  code?: string;
  message?: string;
  requestId?: string;
  response?: Record<string, unknown>;
  records?: Array<Record<string, unknown>>;
  id?: string;
  [key: string]: unknown;
};

type Command = "check" | "status" | "register" | "dns";

function usage() {
  return [
    "Usage:",
    "  npm run domain:check",
    "  npm run domain:status",
    "  npm run domain:register -- --max-cost-usd=2.06",
    "  npm run domain:dns",
    "",
    "Environment:",
    "  PORKBUN_API_KEY and PORKBUN_SECRET_KEY must be set.",
    "  If they are not set, this script will also look in ../.env.local and .env.local.",
    "",
    "Safety:",
    "  check and status are read-only.",
    "  register writes only the registration request and uses an Idempotency-Key.",
    "  Use --idempotency-suffix=<label> after resolving an upstream failed registration blocker.",
    "  dns writes only missing Vercel A records after the domain is in the Porkbun account."
  ].join("\n");
}

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Optional local env files are allowed to be absent.
  }
}

async function loadCredentials() {
  await loadEnvFile(path.resolve("..", ".env.local"));
  await loadEnvFile(path.resolve(".env.local"));
  const apikey = process.env.PORKBUN_API_KEY;
  const secretapikey = process.env.PORKBUN_SECRET_KEY;
  if (!apikey || !secretapikey) {
    throw new Error("Missing PORKBUN_API_KEY or PORKBUN_SECRET_KEY. Set env vars or provide ../.env.local.");
  }
  return { apikey, secretapikey };
}

async function post(pathname: string, body: Record<string, unknown>, idempotencyKey?: string) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "froggyhatessnow-wiki-domain/0.1",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
    },
    body: JSON.stringify(body)
  });
  const data = (await response.json().catch(() => ({}))) as PorkbunResponse;
  return { httpStatus: response.status, data };
}

function pennies(priceUsd: string) {
  const parsed = Number.parseFloat(priceUsd);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid price from Porkbun: ${priceUsd}`);
  return Math.round(parsed * 100);
}

function maxCostFromArgs(args: string[]) {
  const arg = args.find((value) => value.startsWith("--max-cost-usd="));
  if (!arg) return DEFAULT_MAX_COST_USD;
  const parsed = Number.parseFloat(arg.split("=")[1] ?? "");
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid --max-cost-usd value: ${arg}`);
  return parsed;
}

function idempotencySuffixFromArgs(args: string[]) {
  const arg = args.find((value) => value.startsWith("--idempotency-suffix="));
  if (!arg) return new Date().toISOString().slice(0, 10);
  const suffix = arg.split("=")[1] ?? "";
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(suffix)) {
    throw new Error(`Invalid --idempotency-suffix value: ${arg}. Use 1-64 letters, numbers, dots, underscores, or hyphens.`);
  }
  return suffix;
}

function printSafe(label: string, value: unknown) {
  console.log(`${label}: ${JSON.stringify(value, null, 2)}`);
}

async function checkDomain(auth: Record<string, string>) {
  const result = await post(`/domain/checkDomain/${DOMAIN}`, auth);
  const response = result.data.response ?? {};
  const summary = {
    httpStatus: result.httpStatus,
    status: result.data.status,
    code: result.data.code,
    message: result.data.message,
    requestId: result.data.requestId,
    domain: DOMAIN,
    available: response.avail,
    type: response.type,
    price: response.price,
    regularPrice: response.regularPrice,
    premium: response.premium
  };
  printSafe("domainCheck", summary);
  if (result.data.status !== "SUCCESS") throw new Error(`Porkbun checkDomain failed: ${result.data.code ?? result.data.message ?? result.httpStatus}`);
  return response;
}

async function registerDomain(auth: Record<string, string>, args: string[]) {
  const response = await checkDomain(auth);
  if (response.avail !== "yes") throw new Error(`${DOMAIN} is not available; registration skipped.`);
  if (response.premium === "yes") throw new Error(`${DOMAIN} is premium; API registration skipped.`);
  const price = String(response.price ?? "");
  const maxCostUsd = maxCostFromArgs(args);
  if (Number.parseFloat(price) > maxCostUsd) {
    throw new Error(`Quoted price ${price} exceeds --max-cost-usd=${maxCostUsd}.`);
  }

  const idempotencyKey = `froggyhatessnow-wiki-${DOMAIN}-${idempotencySuffixFromArgs(args)}`;
  const result = await post(
    `/domain/create/${DOMAIN}`,
    {
      ...auth,
      cost: pennies(price),
      agreeToTerms: "yes"
    },
    idempotencyKey
  );
  const summary = {
    httpStatus: result.httpStatus,
    status: result.data.status,
    code: result.data.code,
    message: result.data.message,
    requestId: result.data.requestId,
    domain: DOMAIN,
    idempotencyKey
  };
  printSafe("domainCreate", summary);
  if (result.data.status !== "SUCCESS") throw new Error(`Porkbun domain create failed: ${result.data.code ?? result.data.message ?? result.httpStatus}`);
}

async function getDnsRecords(auth: Record<string, string>) {
  const result = await post(`/dns/retrieve/${DOMAIN}`, auth);
  const summary = {
    httpStatus: result.httpStatus,
    status: result.data.status,
    code: result.data.code,
    message: result.data.message,
    requestId: result.data.requestId,
    records: Array.isArray(result.data.records) ? result.data.records.length : 0
  };
  printSafe("dnsRetrieve", summary);
  if (result.data.status !== "SUCCESS") throw new Error(`Porkbun DNS retrieve failed: ${result.data.code ?? result.data.message ?? result.httpStatus}`);
  return result.data.records ?? [];
}

function hasRecord(records: Array<Record<string, unknown>>, name: string, type: string, content: string) {
  return records.some((record) => {
    const recordName = String(record.name ?? "");
    const normalizedName = recordName === DOMAIN ? "" : recordName.replace(`.${DOMAIN}`, "");
    return normalizedName === name && record.type === type && record.content === content;
  });
}

async function createDnsRecord(auth: Record<string, string>, name: string, type: string, content: string) {
  const result = await post(
    `/dns/create/${DOMAIN}`,
    {
      ...auth,
      name,
      type,
      content,
      ttl: 600
    },
    `froggyhatessnow-wiki-dns-${name || "apex"}-${type}-${content}`
  );
  const summary = {
    httpStatus: result.httpStatus,
    status: result.data.status,
    code: result.data.code,
    message: result.data.message,
    requestId: result.data.requestId,
    id: result.data.id,
    name: name || "@",
    type,
    content
  };
  printSafe("dnsCreate", summary);
  if (result.data.status !== "SUCCESS") throw new Error(`Porkbun DNS create failed: ${result.data.code ?? result.data.message ?? result.httpStatus}`);
}

async function configureDns(auth: Record<string, string>) {
  const records = await getDnsRecords(auth);
  const desired = [
    { name: "", type: "A", content: VERCEL_IP },
    { name: "www", type: "A", content: VERCEL_IP }
  ];

  for (const record of desired) {
    if (hasRecord(records, record.name, record.type, record.content)) {
      printSafe("dnsExists", { name: record.name || "@", type: record.type, content: record.content });
      continue;
    }
    await createDnsRecord(auth, record.name, record.type, record.content);
  }
}

async function printDomainStatus(auth: Record<string, string>) {
  const domainResponse = await checkDomain(auth);
  const dnsResult = await post(`/dns/retrieve/${DOMAIN}`, auth);
  const records = Array.isArray(dnsResult.data.records) ? dnsResult.data.records : [];
  const desired = [
    { name: "", type: "A", content: VERCEL_IP },
    { name: "www", type: "A", content: VERCEL_IP }
  ];
  const dnsSummary = {
    httpStatus: dnsResult.httpStatus,
    status: dnsResult.data.status,
    code: dnsResult.data.code,
    message: dnsResult.data.message,
    requestId: dnsResult.data.requestId,
    domain: DOMAIN,
    registeredInPorkbunAccount: dnsResult.data.status === "SUCCESS",
    records: records.length,
    vercelARecordsPresent: desired.map((record) => ({
      name: record.name || "@",
      type: record.type,
      content: record.content,
      present: hasRecord(records, record.name, record.type, record.content)
    }))
  };
  printSafe("dnsStatus", dnsSummary);

  if (domainResponse.avail === "yes") {
    printSafe("nextStep", {
      status: "domain_available_not_registered",
      command: "npm run domain:register -- --max-cost-usd=2.06 --idempotency-suffix=post-verification",
      note: "Run this after Porkbun account email and phone verification clears."
    });
    return;
  }

  if (dnsResult.data.status !== "SUCCESS") {
    printSafe("nextStep", {
      status: "domain_unavailable_but_not_accessible_in_porkbun_account",
      note: "If you registered the domain elsewhere, configure Vercel DNS at that registrar. If Porkbun owns it, verify account access/API permissions."
    });
    return;
  }

  const missingDns = desired.filter((record) => !hasRecord(records, record.name, record.type, record.content));
  if (missingDns.length > 0) {
    printSafe("nextStep", {
      status: "domain_registered_dns_incomplete",
      command: "npm run domain:dns",
      missing: missingDns.map((record) => `${record.type} ${record.name || "@"} ${record.content}`)
    });
    return;
  }

  printSafe("nextStep", {
    status: "porkbun_dns_ready",
    commands: [
      "npx vercel domains inspect froggyhatessnow.wiki",
      "npx vercel domains inspect www.froggyhatessnow.wiki"
    ]
  });
}

async function main() {
  const [commandArg = "check", ...args] = process.argv.slice(2);
  if (commandArg === "--help" || commandArg === "-h") {
    console.log(usage());
    return;
  }
  if (!["check", "status", "register", "dns"].includes(commandArg)) {
    throw new Error(`Unknown command: ${commandArg}\n${usage()}`);
  }

  const command = commandArg as Command;
  const auth = await loadCredentials();
  if (command === "check") await checkDomain(auth);
  if (command === "status") await printDomainStatus(auth);
  if (command === "register") await registerDomain(auth, args);
  if (command === "dns") await configureDns(auth);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main().catch((error) => {
    console.error((error as Error).message);
    process.exitCode = 1;
  });
}
