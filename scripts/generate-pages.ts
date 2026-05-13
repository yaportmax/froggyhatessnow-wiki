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

type PublicSource = Source & {
  id: string;
};

type SnapshotApp = {
  app_id: number;
  kind: string;
  title: string;
  type: string;
  source_url: string;
  api_url: string;
  is_free: boolean | null;
  release_date: unknown;
  developer: string[];
  publisher: string[];
  platforms: unknown;
  genres: string[];
  categories: string[];
  supported_languages_text: string;
  price_overview: unknown;
  recommendations_total: number | null;
  achievements_total: number | null;
  screenshots_count: number;
  screenshots: Array<{ id: number | string | null; thumbnail_url: string; full_url: string }>;
  movies: Array<{ id: number | string | null; name: string; thumbnail_url: string }>;
  header_image: string | null;
  capsule_image: string | null;
  website: string | null;
  fullgame?: unknown;
};

type SteamSnapshot = {
  accessed_date: string;
  generated_at: string;
  source_policy: string[];
  sources: Record<string, string>;
  apps: {
    full_game: SnapshotApp;
    demo: SnapshotApp;
  };
  reviews: {
    full_game: Record<string, unknown> | null;
    demo: Record<string, unknown> | null;
  };
  achievements: {
    community_page_url: string;
    global_percentages_api_url: string;
    demo_global_percentages_api_url: string;
    demo_global_percentages_api_status: number;
    demo_global_percentages_api_error: string | null;
    community_rows_count: number;
    full_game_api_ids_count: number;
    demo_api_ids_count: number;
    highest_global_percentages: Array<{ name: string; percent: string }>;
    lowest_global_percentages: Array<{ name: string; percent: string }>;
    notes: string[];
  };
  public_gameplay_claims: Array<{
    claim: string;
    source_ids: string[];
    confidence: string;
    wiki_targets: string[];
    notes: string;
  }>;
  research_gaps: string[];
  refresh_commands: string[];
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

function inlineCode(value: string) {
  return `\`${value.replace(/`/g, "")}\``;
}

function plainList(values: unknown) {
  if (!Array.isArray(values) || values.length === 0) return "None listed";
  return values.map((value) => String(value)).join(", ");
}

function compactJson(value: unknown) {
  if (value === null || value === undefined) return "None listed";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function fieldValue(value: unknown) {
  return mdEscape(compactJson(value));
}

function linkForEntity(entity: Entity) {
  return `/generated/${entity.category}/${entity.slug}/`;
}

async function readDataset(dataset: string): Promise<Entity[]> {
  return JSON.parse(await readFile(path.resolve("src/data", `${dataset}.json`), "utf8")) as Entity[];
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function clearAstroContentCache() {
  await Promise.all([
    rm(path.resolve(".astro"), { recursive: true, force: true }),
    rm(path.resolve("node_modules/.astro"), { recursive: true, force: true })
  ]);
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

function reviewSummaryTable(snapshot: SteamSnapshot) {
  const rows = [
    ["Full game", snapshot.reviews.full_game],
    ["Demo", snapshot.reviews.demo]
  ];
  return (
    "| App | Review Summary |\n|---|---|\n" +
    rows.map(([label, value]) => `| ${label} | ${fieldValue(value)} |`).join("\n") +
    "\n\n"
  );
}

function appSnapshotRows(app: SnapshotApp) {
  return {
    app_id: app.app_id,
    title: app.title,
    type: app.type,
    release_date: fieldValue(app.release_date),
    developer: plainList(app.developer),
    publisher: plainList(app.publisher),
    platforms: fieldValue(app.platforms),
    genres: plainList(app.genres),
    categories: plainList(app.categories),
    price: fieldValue(app.price_overview),
    recommendations: app.recommendations_total === null ? "None listed" : String(app.recommendations_total),
    achievements: app.achievements_total === null ? "None listed" : String(app.achievements_total),
    screenshots: String(app.screenshots_count),
    movies: app.movies.length === 0 ? "None listed" : app.movies.map((movie) => movie.name || String(movie.id)).join(", ")
  };
}

function steamAppComparison(snapshot: SteamSnapshot) {
  const full = appSnapshotRows(snapshot.apps.full_game);
  const demo = appSnapshotRows(snapshot.apps.demo);
  const rows: Array<[string, string, string]> = [
    ["App ID", String(full.app_id), String(demo.app_id)],
    ["Title", full.title, demo.title],
    ["Type", full.type, demo.type],
    ["Release", full.release_date, demo.release_date],
    ["Developer", full.developer, demo.developer],
    ["Publisher", full.publisher, demo.publisher],
    ["Platforms", full.platforms, demo.platforms],
    ["Genres", full.genres, demo.genres],
    ["Categories", full.categories, demo.categories],
    ["Current US Price", full.price, demo.price],
    ["Recommendations", full.recommendations, demo.recommendations],
    ["Achievements", full.achievements, demo.achievements],
    ["Screenshots", full.screenshots, demo.screenshots],
    ["Movies", full.movies, demo.movies]
  ];

  return (
    "| Field | Full Game | Demo |\n|---|---|---|\n" +
    rows.map(([field, fullValue, demoValue]) => `| ${field} | ${mdEscape(fullValue)} | ${mdEscape(demoValue)} |`).join("\n") +
    "\n\n"
  );
}

function screenshotGrid(snapshot: SteamSnapshot) {
  const shots = snapshot.apps.full_game.screenshots.slice(0, 4);
  if (shots.length === 0) return "";
  return [
    '<div class="steam-media-grid">',
    ...shots.map(
      (shot) =>
        `<a href="${shot.full_url}" rel="noopener"><img src="${shot.thumbnail_url}" alt="Public Steam screenshot for FROGGY HATES SNOW" loading="lazy" /></a>`
    ),
    "</div>",
    ""
  ].join("\n");
}

function sourceLedgerPage(publicSources: PublicSource[], allRows: Entity[]) {
  const statusCounts = allRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.verification_status] = (acc[row.verification_status] ?? 0) + 1;
    return acc;
  }, {});
  const sourceCounts = new Map<string, number>();
  for (const row of allRows) {
    for (const source of row.sources) {
      sourceCounts.set(source.label, (sourceCounts.get(source.label) ?? 0) + 1);
    }
  }
  const topSources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    frontmatter("Source Ledger", "Public source ledger for the FROGGY HATES SNOW wiki.") +
    "# Source Ledger\n\n" +
    "This is the public-source audit trail for the wiki. It separates source availability from gameplay certainty: a public achievement can verify a name without verifying the item's exact effect.\n\n" +
    `Entity status counts: ${Object.entries(statusCounts)
      .map(([status, count]) => `${status}: ${count}`)
      .join(", ")}.\n\n` +
    "## Source Coverage\n\n" +
    "| Source Label | Referenced Entities |\n|---|---:|\n" +
    topSources.map(([label, count]) => `| ${mdEscape(label)} | ${count} |`).join("\n") +
    "\n\n## Public Sources\n\n" +
    "| ID | Source | Confidence | Notes |\n|---|---|---|---|\n" +
    publicSources
      .map((source) => `| ${inlineCode(source.id)} | [${mdEscape(source.label)}](${source.path_or_url}) | ${source.confidence} | ${mdEscape(source.notes)} |`)
      .join("\n") +
    "\n"
  );
}

function steamSnapshotPage(snapshot: SteamSnapshot) {
  const full = snapshot.apps.full_game;
  const highest = snapshot.achievements.highest_global_percentages;
  const lowest = snapshot.achievements.lowest_global_percentages;

  return (
    frontmatter("Steam Source Snapshot", "Current public Steam metadata snapshot for FROGGY HATES SNOW.") +
    "# Steam Source Snapshot\n\n" +
    (full.header_image ? `![FROGGY HATES SNOW Steam header](${full.header_image})\n\n` : "") +
    `Accessed: **${snapshot.accessed_date}**. Generated: ${snapshot.generated_at}.\n\n` +
    "This page is the main sourcing checkpoint for game-populating wiki data. It uses official public Steam pages/APIs first, then marks anything not confirmed by those sources as inferred or needing verification.\n\n" +
    "## Source Policy\n\n" +
    snapshot.source_policy.map((item) => `- ${mdEscape(item)}`).join("\n") +
    "\n\n## App Metadata\n\n" +
    steamAppComparison(snapshot) +
    "## Steam Media\n\n" +
    `Steam appdetails currently lists ${full.screenshots_count} full-game screenshots. The thumbnails below are public Steam CDN URLs and link to the public full-size Steam images.\n\n` +
    screenshotGrid(snapshot) +
    "## Reviews\n\n" +
    reviewSummaryTable(snapshot) +
    "## Achievements\n\n" +
    `Public community rows parsed: **${snapshot.achievements.community_rows_count}**. Full-game global percentage API ids parsed: **${snapshot.achievements.full_game_api_ids_count}**. Demo global percentage API status: **${snapshot.achievements.demo_global_percentages_api_status}**; ids parsed: **${snapshot.achievements.demo_api_ids_count}**.\n\n` +
    (snapshot.achievements.demo_global_percentages_api_error ? `Demo achievement endpoint note: ${snapshot.achievements.demo_global_percentages_api_error}.\n\n` : "") +
    "| Highest Public API Percentages | Percent |\n|---|---:|\n" +
    highest.map((row) => `| ${inlineCode(row.name)} | ${row.percent}% |`).join("\n") +
    "\n\n| Lowest Public API Percentages | Percent |\n|---|---:|\n" +
    lowest.map((row) => `| ${inlineCode(row.name)} | ${row.percent}% |`).join("\n") +
    "\n\n" +
    snapshot.achievements.notes.map((item) => `- ${mdEscape(item)}`).join("\n") +
    "\n\n## Public Gameplay Claims\n\n" +
    "| Claim | Source IDs | Confidence | Wiki Targets | Notes |\n|---|---|---|---|---|\n" +
    snapshot.public_gameplay_claims
      .map(
        (claim) =>
          `| ${mdEscape(claim.claim)} | ${claim.source_ids.map(inlineCode).join(", ")} | ${claim.confidence} | ${claim.wiki_targets.map(inlineCode).join(", ")} | ${mdEscape(claim.notes)} |`
      )
      .join("\n") +
    "\n\n## Research Gaps\n\n" +
    snapshot.research_gaps.map((gap) => `- ${mdEscape(gap)}`).join("\n") +
    "\n\n## Refresh\n\n" +
    "```bash\n" +
    snapshot.refresh_commands.join("\n") +
    "\n```\n"
  );
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

function homepage(allRows: Entity[], snapshot: SteamSnapshot) {
  const verified = allRows.filter((row) => row.verification_status === "Verified").length;
  const inferred = allRows.filter((row) => row.verification_status === "Inferred").length;
  const needs = allRows.filter((row) => row.verification_status === "Needs verification").length;
  const headerImage = snapshot.apps.full_game.header_image;
  return (
    frontmatter("FROGGY HATES SNOW Wiki", "Unofficial metadata-first fan wiki for FROGGY HATES SNOW.") +
    "# FROGGY HATES SNOW Wiki\n\n" +
    (headerImage ? `![FROGGY HATES SNOW Steam header](${headerImage})\n\n` : "") +
    "Unofficial metadata-first fan wiki for **FROGGY HATES SNOW**. The current build starts from public Steam metadata, the public Steam achievements page, public review summaries, publisher metadata, and safe local metadata scanning.\n\n" +
    ":::caution[Scope]\nThis wiki does not redistribute proprietary game files, assets, binaries, source code, or large raw text dumps. Entries marked Inferred or Needs verification should be treated as work-in-progress.\n:::\n\n" +
    `Current entity coverage: **${allRows.length} entries** (${verified} Verified, ${inferred} Inferred, ${needs} Needs verification).\n\n` +
    `Steam source snapshot: full game app ${snapshot.apps.full_game.app_id}, demo app ${snapshot.apps.demo.app_id}, ${snapshot.achievements.community_rows_count} public achievement rows, accessed ${snapshot.accessed_date}.\n\n` +
    "## Browse\n\n" +
    REQUIRED_DATASETS.map((dataset) => `- [${CATEGORY_LABELS[dataset]}](/generated/${dataset}/)`).join("\n") +
    "\n- [Steam Source Snapshot](/steam-source-snapshot/)\n- [Source Ledger](/source-ledger/)\n- [Verification Status](/verification-status/)" +
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
  const publicSources = await readJson<PublicSource[]>(path.resolve("src/data/public-sources.json"));
  const steamSnapshot = await readJson<SteamSnapshot>(path.resolve("src/data/steam-snapshot.json"));
  const allRows = datasetEntries.flatMap(([, rows]) => rows);
  const lookup = new Map<string, Entity>();
  for (const row of allRows) {
    lookup.set(row.id, row);
    lookup.set(row.slug, row);
  }

  await writeFile(path.join(outputRoot, "index.md"), homepage(allRows, steamSnapshot));
  await writeFile(path.join(outputRoot, "source-ledger.md"), sourceLedgerPage(publicSources, allRows));
  await writeFile(path.join(outputRoot, "steam-source-snapshot.md"), steamSnapshotPage(steamSnapshot));

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

  await clearAstroContentCache();
  console.log(`Generated ${allRows.length} entity detail pages and ${REQUIRED_DATASETS.length} category indexes.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await generatePages();
}
