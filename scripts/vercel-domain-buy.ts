import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_DOMAIN = "froggyhatessnow.wiki";
const DEFAULT_SCOPE = "yaportmax-5253s-projects";
const CONFIRM_FLAG = "--confirm-financial-purchase";
const DEFAULT_MAX_PURCHASE_USD = 2.99;
const DEFAULT_MAX_RENEWAL_USD = 23;

const args = process.argv.slice(2);

type Mode = "price" | "buy";

type PriceQuote = {
  domain: string;
  purchaseUsd: number;
  renewalUsd: number;
  transferUsd: number;
  term: string;
  raw: string;
};

function usage() {
  return [
    "Usage:",
    "  npm run domain:vercel-price",
    "  npm run domain:vercel-buy -- --confirm-financial-purchase --max-purchase-usd=2.99 --max-renewal-usd=23",
    "",
    "Options:",
    `  --domain=${DEFAULT_DOMAIN}`,
    `  --scope=${DEFAULT_SCOPE}`,
    `  --max-purchase-usd=${DEFAULT_MAX_PURCHASE_USD}`,
    `  --max-renewal-usd=${DEFAULT_MAX_RENEWAL_USD}`,
    "",
    "Safety:",
    "  price is read-only.",
    "  buy is a financial transaction and refuses to run without --confirm-financial-purchase.",
    "  buy also refuses if the quoted purchase or renewal price exceeds the configured caps."
  ].join("\n");
}

function optionValue(name: string, fallback: string) {
  const prefix = `${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function numericOption(name: string, fallback: number) {
  const value = optionValue(name, String(fallback));
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid ${name}: ${value}`);
  return parsed;
}

function modeFromArgs(): Mode {
  const [mode = "price"] = args;
  if (mode === "--help" || mode === "-h") {
    console.log(usage());
    process.exit(0);
  }
  if (mode !== "price" && mode !== "buy") throw new Error(`Unknown mode: ${mode}\n${usage()}`);
  return mode;
}

async function runVercel(commandArgs: string[]) {
  const { stdout, stderr } = await execFileAsync("npx", ["vercel", ...commandArgs], {
    maxBuffer: 10 * 1024 * 1024
  });
  return [stdout, stderr].filter(Boolean).join("\n").trim();
}

function dollars(raw: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = raw.match(new RegExp(`${escaped}:\\s*\\$([0-9]+(?:\\.[0-9]+)?)`, "i"));
  if (!match) throw new Error(`Could not parse ${label} price from Vercel output:\n${raw}`);
  const parsed = Number.parseFloat(match[1] ?? "");
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label} price from Vercel output:\n${raw}`);
  return parsed;
}

function term(raw: string) {
  return raw.match(/Term:\s*(.+)$/im)?.[1]?.trim() ?? "unknown";
}

async function priceQuote(domain: string, scope: string): Promise<PriceQuote> {
  const raw = await runVercel(["domains", "price", domain, "--scope", scope]);
  return {
    domain,
    purchaseUsd: dollars(raw, "Purchase"),
    renewalUsd: dollars(raw, "Renewal"),
    transferUsd: dollars(raw, "Transfer"),
    term: term(raw),
    raw
  };
}

async function main() {
  const mode = modeFromArgs();
  const domain = optionValue("--domain", DEFAULT_DOMAIN);
  const scope = optionValue("--scope", DEFAULT_SCOPE);
  const maxPurchaseUsd = numericOption("--max-purchase-usd", DEFAULT_MAX_PURCHASE_USD);
  const maxRenewalUsd = numericOption("--max-renewal-usd", DEFAULT_MAX_RENEWAL_USD);

  const quote = await priceQuote(domain, scope);
  console.log(JSON.stringify({ quote, maxPurchaseUsd, maxRenewalUsd }, null, 2));

  if (mode === "price") return;

  if (!args.includes(CONFIRM_FLAG)) {
    throw new Error(
      [
        "Refusing to buy a domain without explicit financial confirmation.",
        `Re-run only after approval: npm run domain:vercel-buy -- ${CONFIRM_FLAG} --max-purchase-usd=${maxPurchaseUsd} --max-renewal-usd=${maxRenewalUsd}`,
        `Quoted purchase: $${quote.purchaseUsd}; renewal: $${quote.renewalUsd}.`
      ].join("\n")
    );
  }

  if (quote.purchaseUsd > maxPurchaseUsd) {
    throw new Error(`Refusing purchase: quoted purchase $${quote.purchaseUsd} exceeds --max-purchase-usd=${maxPurchaseUsd}.`);
  }
  if (quote.renewalUsd > maxRenewalUsd) {
    throw new Error(`Refusing purchase: quoted renewal $${quote.renewalUsd} exceeds --max-renewal-usd=${maxRenewalUsd}.`);
  }

  const output = await runVercel(["domains", "buy", domain, "--scope", scope]);
  console.log(output);
  console.error(
    [
      "Domain purchase command completed. Next steps:",
      `  Wait for ${domain} and www.${domain} to resolve in Vercel.`,
      "  npm run domain:finish:vercel-post-purchase"
    ].join("\n")
  );
}

await main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
