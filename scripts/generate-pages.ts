import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { REQUIRED_DATASETS } from "./validate-data";

type Source = {
  type: string;
  path_or_url: string;
  label: string;
  confidence: string;
  notes: string;
};

type Entity = {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  category: string;
  short_description: string;
  effect: string;
  unlock_method: string;
  cost: string;
  mode: string;
  related_entities: string[];
  sources: Source[];
  verification_status: string;
  last_verified_game_version: string;
  notes: string;
  steam_internal_name?: string | null;
  steam_global_percent_api?: string | null;
  steam_community_percent?: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  frogs: "Frogs",
  maps: "Maps",
  tools: "Tools",
  items: "Items",
  skills: "Skills",
  companions: "Companions",
  upgrades: "Upgrades",
  bosses: "Bosses",
  enemies: "Enemies",
  achievements: "Achievements",
  glossary: "Glossary"
};

function frontmatter(title: string, description: string) {
  return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\ndraft: false\n---\n\n`;
}

function mdEscape(value: unknown) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ")
    .trim();
}

function linkForEntity(entity: Entity) {
  return `/generated/${entity.category}/${entity.slug}/`;
}

async function readDataset(dataset: string): Promise<Entity[]> {
  return JSON.parse(await readFile(path.resolve("src/data", `${dataset}.json`), "utf8")) as Entity[];
}

function statusCallout(status: string) {
  if (status === "Verified") return ":::tip[Verified]\nThis entry is backed by at least one listed public source or safe metadata source.\n:::\n\n";
  if (status === "Inferred") return ":::caution[Inferred]\nThe name is public, but one or more type/effect details are inferred and need gameplay or metadata confirmation.\n:::\n\n";
  return ":::danger[Needs verification]\nThis entry is a stub and should not be treated as confirmed.\n:::\n\n";
}

function entityTable(entity: Entity) {
  const rows = [
    ["Status", entity.verification_status],
    ["Category", entity.category],
    ["Aliases", entity.aliases.length > 0 ? entity.aliases.join(", ") : "None listed"],
    ["Effect", entity.effect],
    ["Unlock Method", entity.unlock_method],
    ["Cost", entity.cost],
    ["Mode", entity.mode],
    ["Last Verified", entity.last_verified_game_version],
    ["Notes", entity.notes || "None"]
  ];

  if (entity.steam_internal_name) rows.push(["Steam Internal Achievement ID", entity.steam_internal_name]);
  if (entity.steam_global_percent_api) rows.push(["Steam Global Percent API", `${entity.steam_global_percent_api}%`]);
  if (entity.steam_community_percent) rows.push(["Steam Community Percent", entity.steam_community_percent]);

  return `| Field | Value |\n|---|---|\n${rows.map(([field, value]) => `| ${field} | ${mdEscape(value)} |`).join("\n")}\n\n`;
}

function sourcesList(entity: Entity) {
  if (entity.sources.length === 0) return "No sources listed yet.\n";
  return entity.sources
    .map((source) => `- [${mdEscape(source.label)}](${source.path_or_url}) — ${source.type}, confidence ${source.confidence}. ${mdEscape(source.notes)}`)
    .join("\n")
    .concat("\n");
}

function relatedList(entity: Entity, lookup: Map<string, Entity>) {
  if (entity.related_entities.length === 0) return "No related entities listed yet.\n";
  return entity.related_entities
    .map((related) => {
      const target = lookup.get(related);
      if (!target) return `- ${related}`;
      return `- [${target.name}](${linkForEntity(target)})`;
    })
    .join("\n")
    .concat("\n");
}

function categoryIndex(dataset: string, rows: Entity[]) {
  const label = CATEGORY_LABELS[dataset] ?? dataset;
  const statusCounts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.verification_status] = (acc[row.verification_status] ?? 0) + 1;
    return acc;
  }, {});
  const description = `${label} entries for the unofficial FROGGY HATES SNOW wiki.`;

  return (
    frontmatter(label, description) +
    `# ${label}\n\n` +
    `${description}\n\n` +
    `Status counts: ${Object.entries(statusCounts)
      .map(([status, count]) => `${status}: ${count}`)
      .join(", ")}.\n\n` +
    "| Name | Status | Summary |\n|---|---|---|\n" +
    rows.map((row) => `| [${mdEscape(row.name)}](${row.slug}/) | ${row.verification_status} | ${mdEscape(row.short_description)} |`).join("\n") +
    "\n"
  );
}

function entityPage(entity: Entity, lookup: Map<string, Entity>) {
  return (
    frontmatter(entity.name, entity.short_description) +
    `# ${entity.name}\n\n` +
    statusCallout(entity.verification_status) +
    `${entity.short_description}\n\n` +
    entityTable(entity) +
    "## Related\n\n" +
    relatedList(entity, lookup) +
    "\n## Sources\n\n" +
    sourcesList(entity)
  );
}

function homepage(allRows: Entity[]) {
  const verified = allRows.filter((row) => row.verification_status === "Verified").length;
  const inferred = allRows.filter((row) => row.verification_status === "Inferred").length;
  const needs = allRows.filter((row) => row.verification_status === "Needs verification").length;
  return (
    frontmatter("FROGGY HATES SNOW Wiki", "Unofficial metadata-first fan wiki for FROGGY HATES SNOW.") +
    "# FROGGY HATES SNOW Wiki\n\n" +
    "Unofficial metadata-first fan wiki for **FROGGY HATES SNOW**. The current build starts from public Steam metadata, the public Steam achievements page, public review summaries, publisher metadata, and safe local metadata scanning.\n\n" +
    ":::caution[Scope]\nThis wiki does not redistribute proprietary game files, assets, binaries, source code, or large raw text dumps. Entries marked Inferred or Needs verification should be treated as work-in-progress.\n:::\n\n" +
    `Current entity coverage: **${allRows.length} entries** (${verified} Verified, ${inferred} Inferred, ${needs} Needs verification).\n\n` +
    "## Browse\n\n" +
    REQUIRED_DATASETS.map((dataset) => `- [${CATEGORY_LABELS[dataset]}](/generated/${dataset}/)`).join("\n") +
    "\n\n## Priority Research Gaps\n\n" +
    "- Local Steam demo acquisition is blocked in this macOS shell; see `notes/public-research.md`.\n" +
    "- Individual frog/character names, map names, boss names, enemy names, exact upgrade stats, costs, and unlock conditions need gameplay or safe metadata verification.\n" +
    "- Achievement percentages, review counts, and prices are volatile and should be refreshed before publishing numeric claims.\n"
  );
}

function guidePages() {
  return new Map<string, string>([
    [
      "guides/beginner-guide.md",
      frontmatter("Beginner Guide", "Starter guide for new FROGGY HATES SNOW players.") +
        "# Beginner Guide\n\n" +
        "Start from the verified public loop: leave home, dig through snow, collect resources, return value home, and use progression to grow stronger.\n\n" +
        "## Confirmed From Public Sources\n\n" +
        "- You can survive by finding the escape door or defeating the boss.\n" +
        "- Keys matter for the escape door and can also be spent on treasure chests.\n" +
        "- Warmth matters; staying too long in the cold can freeze you.\n" +
        "- Peaceful Mode is described as monster-free.\n\n" +
        "## Needs Verification\n\n" +
        "- Best first upgrades.\n" +
        "- Exact key counts by map or mode.\n" +
        "- Exact enemy wave timing and boss behavior.\n"
    ],
    [
      "guides/warmth-management.md",
      frontmatter("Warmth Management", "Warmth and freezing guide for FROGGY HATES SNOW.") +
        "# Warmth Management\n\n" +
        "Warmth is a verified survival concept from official Steam copy: the cold is dangerous, and freezing is a run threat.\n\n" +
        "## Publicly Sourced Notes\n\n" +
        "- Official copy says warmth is survival.\n" +
        "- Official copy says staying too long in the cold can freeze the player unless the right upgrades are unlocked.\n\n" +
        "## Needs Verification\n\n" +
        "- Exact warmth meter behavior.\n" +
        "- Exact freeze thresholds.\n" +
        "- Which upgrades, tools, or items improve cold resistance.\n"
    ],
    [
      "guides/best-upgrades.md",
      frontmatter("Best Upgrades", "Upgrade guide scaffold for FROGGY HATES SNOW.") +
        "# Best Upgrades\n\n" +
        "Public sources confirm upgrade paths for faster digging, stronger fighting, and cold resistance, plus powerful upgrades from treasure chests.\n\n" +
        "This page is intentionally conservative until effects, costs, and unlock order are verified from gameplay or safe local metadata.\n"
    ],
    [
      "guides/unlocks.md",
      frontmatter("Unlocks", "Unlock guide scaffold for FROGGY HATES SNOW.") +
        "# Unlocks\n\n" +
        "Public achievements verify unlock categories for skills, characters, and locations.\n\n" +
        "| Category | Public Achievement Thresholds |\n|---|---|\n| Skills | 1, 5, 10, 20, 30 |\n| Characters | 1, 3, 9 |\n| Locations | 1, 5, 15 |\n\n" +
        "Named unlock requirements need verification.\n"
    ],
    [
      "guides/game-modes.md",
      frontmatter("Game Modes", "Game mode notes for FROGGY HATES SNOW.") +
        "# Game Modes\n\n" +
        "Official Steam copy confirms a core mode with enemies and a **Peaceful Mode** described as monster-free.\n\n" +
        "Mode-specific progression, achievement eligibility, and reward differences need verification.\n"
    ]
  ]);
}

function staticPages() {
  return new Map<string, string>([
    [
      "faq.md",
      frontmatter("FAQ", "Frequently asked questions for the unofficial FROGGY HATES SNOW wiki.") +
        "# FAQ\n\n" +
        "## Is this official?\n\nNo. This is an unofficial fan wiki.\n\n" +
        "## What is verified?\n\nVerified entries cite public Steam, publisher, achievement, or safe local metadata sources.\n\n" +
        "## Why are many effects missing?\n\nThe project is metadata-first and does not invent stats, costs, unlocks, or behavior.\n"
    ],
    [
      "contribute.md",
      frontmatter("Contribute", "Contribution guide for the unofficial FROGGY HATES SNOW wiki.") +
        "# Contribute\n\n" +
        "Contributions should include a source and one of the allowed verification statuses: Verified, Inferred, or Needs verification.\n\n" +
        "Do not add proprietary assets, binaries, source code, decompiled content, DRM-bypassed material, or long raw text dumps from the game files.\n\n" +
        "Useful contributions include screenshots of public pages, short gameplay notes, safe metadata findings, and corrections to inferred categories.\n"
    ],
    [
      "verification-status.md",
      frontmatter("Verification Status", "Verification status rules for the FROGGY HATES SNOW wiki.") +
        "# Verification Status\n\n" +
        "| Status | Meaning |\n|---|---|\n| Verified | Backed by a listed source. |\n| Inferred | Name or concept is public, but classification or behavior is inferred. |\n| Needs verification | Placeholder or incomplete information. |\n\n" +
        "Use only these three statuses in data files.\n"
    ]
  ]);
}

export async function generatePages() {
  const outputRoot = path.resolve("src/content/docs");
  const generatedRoot = path.join(outputRoot, "generated");
  await mkdir(outputRoot, { recursive: true });
  await rm(generatedRoot, { recursive: true, force: true });
  await mkdir(generatedRoot, { recursive: true });

  const datasetEntries = await Promise.all(REQUIRED_DATASETS.map(async (dataset) => [dataset, await readDataset(dataset)] as const));
  const allRows = datasetEntries.flatMap(([, rows]) => rows);
  const lookup = new Map<string, Entity>();
  for (const row of allRows) {
    lookup.set(row.id, row);
    lookup.set(row.slug, row);
  }

  await writeFile(path.join(outputRoot, "index.md"), homepage(allRows));

  for (const [dataset, rows] of datasetEntries) {
    const categoryDir = path.join(generatedRoot, dataset);
    await mkdir(categoryDir, { recursive: true });
    await writeFile(path.join(categoryDir, "index.md"), categoryIndex(dataset, rows));
    for (const row of rows) {
      await mkdir(path.join(categoryDir, row.slug), { recursive: true });
      await writeFile(path.join(categoryDir, row.slug, "index.md"), entityPage(row, lookup));
    }
  }

  for (const [relativePath, contents] of [...guidePages(), ...staticPages()]) {
    const filePath = path.join(outputRoot, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents);
  }

  console.log(`Generated ${allRows.length} entity detail pages and ${REQUIRED_DATASETS.length} category indexes.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await generatePages();
}
