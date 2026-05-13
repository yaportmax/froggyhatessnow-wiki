import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { REQUIRED_DATASETS } from "./validate-data";

type Source = {
  source_id?: string;
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
  verified_fields?: string[];
  unverified_fields?: string[];
  steam_internal_name?: string | null;
  steam_global_percent_api?: string | null;
  steam_community_percent?: string | null;
  icon_url?: string;
};

type PublicSource = Source & {
  id: string;
};

type AchievementFact = {
  title: string;
  slug: string;
  description: string;
  icon_url?: string;
  steam_internal_name: string | null;
  steam_global_percent_api: string | null;
  steam_community_percent: string;
  mentioned_entities: Array<{
    name: string;
    id: string;
    category: string;
    certainty: string;
    notes: string;
  }>;
  source_ids: string[];
  notes: string;
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
  external_source_checks?: Array<{
    source_id: string;
    label: string;
    url: string;
    status: number;
    ok: boolean;
    required_markers: string[];
    matched_markers: string[];
    notes: string;
  }>;
  achievements: {
    community_page_url: string;
    global_percentages_api_url: string;
    demo_global_percentages_api_url: string;
    demo_global_percentages_api_status: number;
    demo_global_percentages_api_error: string | null;
    community_rows_count: number;
    full_game_api_ids_count: number;
    demo_api_ids_count: number;
    facts?: AchievementFact[];
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
  steam_news_findings: {
    source_url: string;
    api_url?: string;
    fetched_news_item_count?: number;
    playable_frogs_count: number;
    locations_count: number;
    minimum_combined_skills_tools_attacks_companions: number;
    demo_progress_carries_over: boolean;
    confirmed_terms: string[];
    all_news_items?: Array<{
      source_id: string;
      mapped_source_id: string | null;
      gid: string;
      title: string;
      date: string;
      url: string;
      feedname: string;
      author: string;
      classification: string;
      evidence_strength: string;
      fact_scope: string[];
      claim_limits: string;
      needs_gameplay_verification: boolean;
      wiki_targets: string[];
      verified_terms: string[];
      notes: string;
    }>;
    news_items?: Array<{
      source_id: string;
      gid: string;
      title: string;
      date: string;
      url: string;
      feedname: string;
      author: string;
      wiki_targets: string[];
      verified_terms: string[];
      supports: string;
    }>;
    notes: string[];
  };
  research_gaps: string[];
  refresh_commands: string[];
};

type ExtractedMetadataSnapshot = {
  generated_at?: string;
  gameFilesPresent?: boolean;
  gameFilesContainFiles?: boolean;
  root?: string;
  filesScanned?: number;
  directoriesScanned?: number;
  readable_files?: unknown[];
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

function statusCallout(entity: Entity) {
  const unverifiedFields = entity.unverified_fields ?? [];
  if (entity.verification_status === "Verified" && unverifiedFields.length === 0) {
    return ":::tip[Verified]\nThis entry is backed by listed public source or safe metadata evidence, with no tracked fields currently marked unverified.\n:::\n\n";
  }
  if (entity.verification_status === "Verified") {
    return `:::caution[Partially verified]\nThe listed sources verify this entry, but these fields still need confirmation: ${mdEscape(unverifiedFields.join(", "))}.\n:::\n\n`;
  }
  if (entity.verification_status === "Inferred") return ":::caution[Inferred]\nThe name is public, but one or more type/effect details are inferred and need gameplay or metadata confirmation.\n:::\n\n";
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
    ["Verified Fields", entity.verified_fields && entity.verified_fields.length > 0 ? entity.verified_fields.join(", ") : "Name/source only"],
    ["Fields Needing Verification", entity.unverified_fields && entity.unverified_fields.length > 0 ? entity.unverified_fields.join(", ") : "None listed"],
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
    .map((source) => `- [${mdEscape(source.label)}](${source.path_or_url}) — ${source.type}, confidence ${source.confidence}${source.source_id ? `, source ${inlineCode(source.source_id)}` : ""}. ${mdEscape(source.notes)}`)
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

function steamNewsFindings(snapshot: SteamSnapshot) {
  const findings = snapshot.steam_news_findings;
  const newsItems = findings.news_items ?? [];
  const allNewsItems = findings.all_news_items ?? [];
  return (
    "## Steam News & Devlogs\n\n" +
    `Source stream: [Steam community news/devlogs](${findings.source_url}).\n\n` +
    "| Finding | Value |\n|---|---|\n" +
    [
      ["Playable frogs", String(findings.playable_frogs_count)],
      ["Locations", String(findings.locations_count)],
      ["Skills/tools/attacks/companions", `${findings.minimum_combined_skills_tools_attacks_companions}+`],
      ["Demo progress carries over", findings.demo_progress_carries_over ? "yes" : "no"],
      ["Steam News API items classified", String(findings.fetched_news_item_count ?? allNewsItems.length)],
      ["Direct gameplay/update sources mapped", String(newsItems.length)],
      ["Confirmed named terms", findings.confirmed_terms.join(", ")]
    ]
      .map(([field, value]) => `| ${field} | ${mdEscape(value)} |`)
      .join("\n") +
    "\n\n" +
    findings.notes.map((note) => `- ${mdEscape(note)}`).join("\n") +
    "\n\n" +
    (newsItems.length > 0
      ? "### Direct Steam News Sources\n\n" +
        "| Date | Source ID | Title | Supports |\n|---|---|---|---|\n" +
        newsItems
          .map((item) => `| ${mdEscape(item.date)} | ${inlineCode(item.source_id)} | [${mdEscape(item.title)}](${item.url}) | ${mdEscape(item.supports)} |`)
          .join("\n") +
        "\n\n"
      : "") +
    (allNewsItems.length > 0
      ? "### All Steam News Items\n\n" +
        "Every current Steam News API item is recorded below. Items classified as marketing/event or weak/no-gameplay are kept for audit coverage but should not be used as gameplay evidence.\n\n" +
        "| Date | Source ID | Title | Classification | Evidence | Scope | Limits |\n|---|---|---|---|---|---|---|\n" +
        allNewsItems
          .map(
            (item) =>
              `| ${mdEscape(item.date)} | ${inlineCode(item.source_id)} | [${mdEscape(item.title)}](${item.url}) | ${mdEscape(item.classification)} | ${mdEscape(item.evidence_strength)} | ${mdEscape(item.fact_scope.join(", "))} | ${mdEscape(item.claim_limits)} |`
          )
          .join("\n") +
        "\n\n"
      : "") +
    "\n\n"
  );
}

function externalSourceChecks(snapshot: SteamSnapshot) {
  const checks = snapshot.external_source_checks ?? [];
  if (checks.length === 0) return "";
  return (
    "## External Source Checks\n\n" +
    "These non-Steam public pages are fetched during `npm run fetch:steam`; missing marker text fails the refresh so cited non-Steam claims do not silently rot.\n\n" +
    "| Source | Status | Matched Markers | Notes |\n|---|---:|---|---|\n" +
    checks
      .map(
        (check) =>
          `| [${mdEscape(check.label)}](${check.url}) | ${check.status} | ${mdEscape(check.matched_markers.join(", "))} | ${mdEscape(check.notes)} |`
      )
      .join("\n") +
    "\n\n"
  );
}

function localMetadataStatus(snapshot: ExtractedMetadataSnapshot) {
  const filesScanned = typeof snapshot.filesScanned === "number" ? snapshot.filesScanned : 0;
  const readableCount = Array.isArray(snapshot.readable_files) ? snapshot.readable_files.length : 0;
  return (
    "## Local Metadata Scan\n\n" +
    "| Field | Value |\n|---|---|\n" +
    [
      ["Generated", snapshot.generated_at ?? "not available"],
      ["Game files present", snapshot.gameFilesPresent === true ? "yes" : "no"],
      ["Game files contain files", snapshot.gameFilesContainFiles === true ? "yes" : "no"],
      ["Scan root", snapshot.root ?? "not available"],
      ["Files scanned", String(filesScanned)],
      ["Readable metadata files", String(readableCount)]
    ]
      .map(([field, value]) => `| ${field} | ${mdEscape(value)} |`)
      .join("\n") +
    "\n\n" +
    (filesScanned === 0 || readableCount === 0
      ? "The local metadata pass currently contributes no game facts. Public Steam and public web sources are the only populated game-data sources until SteamCMD/local extraction succeeds.\n\n"
      : "Readable local metadata is summarized in `notes/extracted-metadata.md` and `notes/extracted-metadata.json` without redistributing game assets or long raw excerpts.\n\n")
  );
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

function steamSnapshotPage(snapshot: SteamSnapshot, extractedMetadata: ExtractedMetadataSnapshot) {
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
    externalSourceChecks(snapshot) +
    steamNewsFindings(snapshot) +
    localMetadataStatus(extractedMetadata) +
    "## Achievements\n\n" +
    `Public community rows parsed: **${snapshot.achievements.community_rows_count}**. Full-game global percentage API ids parsed: **${snapshot.achievements.full_game_api_ids_count}**. Demo global percentage API status: **${snapshot.achievements.demo_global_percentages_api_status}**; ids parsed: **${snapshot.achievements.demo_api_ids_count}**.\n\n` +
    `The [Achievement Source Matrix](/achievement-source-matrix/) maps each public achievement row to its Steam API id, percentage fields, source ids, and any parsed loadout names.\n\n` +
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

function achievementSourceMatrixPage(snapshot: SteamSnapshot) {
  const facts = snapshot.achievements.facts ?? [];
  const loadoutFacts = facts.filter((fact) => fact.mentioned_entities.length > 0);
  const milestoneSeries = [
    ["Skill unlock milestones", /^Power Hungry /],
    ["Artifact collection milestones", /^Relic Hunter /],
    ["Location completion milestones", /^Snow Master /],
    ["Location unlock milestones", /^Pathfinder /],
    ["Character upgrade milestones", /^Peak Performance /],
    ["Character unlock milestones", /^Assemble the Team /]
  ] as const;
  const milestoneRows = milestoneSeries.flatMap(([label, pattern]) =>
    facts
      .filter((fact) => pattern.test(fact.title))
      .map((fact) => ({ label, fact }))
  );
  return (
    frontmatter("Achievement Source Matrix", "Steam achievement fact matrix for FROGGY HATES SNOW wiki sourcing.") +
    "# Achievement Source Matrix\n\n" +
    "This page keeps the official Steam achievement evidence in one place. Achievement wording can verify names and progression thresholds, but it does not by itself verify exact item type, effect, stats, unlock cost, or balance.\n\n" +
    `Rows: **${facts.length}** public Steam achievements. Rows with parsed loadout names: **${loadoutFacts.length}**.\n\n` +
    "## Milestone Series\n\n" +
    "These achievement series verify public progression thresholds. They do not verify exact unlock costs, reward values, or whether the threshold applies identically across every mode.\n\n" +
    "| Series | Achievement | Condition | API % | Community % | Source IDs |\n|---|---|---|---:|---:|---|\n" +
    milestoneRows
      .map(
        ({ label, fact }) =>
          `| ${mdEscape(label)} | [${mdEscape(fact.title)}](/generated/achievements/${fact.slug}/) | ${mdEscape(fact.description)} | ${mdEscape(fact.steam_global_percent_api ?? "Missing")} | ${mdEscape(fact.steam_community_percent)} | ${fact.source_ids.map(inlineCode).join(", ")} |`
      )
      .join("\n") +
    "\n\n" +
    "## Loadout Names\n\n" +
    "Names in this table are safe wiki candidates because they appear in public Steam achievement conditions. Certainty describes only whether the parser can confidently classify the category from wording.\n\n" +
    "| Achievement | Mentioned Names | Source IDs | Notes |\n|---|---|---|---|\n" +
    loadoutFacts
      .map((fact) => {
        const names = fact.mentioned_entities
          .map((entity) => `${entity.name} (${entity.category}, ${entity.certainty.replace(/_/g, " ")})`)
          .join(", ");
        return `| [${mdEscape(fact.title)}](/generated/achievements/${fact.slug}/) | ${mdEscape(names)} | ${fact.source_ids.map(inlineCode).join(", ")} | ${mdEscape(fact.notes)} |`;
      })
      .join("\n") +
    "\n\n## Full Matrix\n\n" +
    "| Achievement | Icon | Condition | Steam API ID | API % | Community % | Mentioned Entities |\n|---|---|---|---|---:|---:|---|\n" +
    facts
      .map((fact) => {
        const entities =
          fact.mentioned_entities.length > 0
            ? fact.mentioned_entities.map((entity) => `${entity.name} (${entity.category})`).join(", ")
            : "None parsed";
        const icon = fact.icon_url ? `<img src="${fact.icon_url}" alt="" class="achievement-icon achievement-icon--table" loading="lazy" />` : "Missing";
        return `| [${mdEscape(fact.title)}](/generated/achievements/${fact.slug}/) | ${icon} | ${mdEscape(fact.description)} | ${fact.steam_internal_name ? inlineCode(fact.steam_internal_name) : "Missing"} | ${mdEscape(fact.steam_global_percent_api ?? "Missing")} | ${mdEscape(fact.steam_community_percent)} | ${mdEscape(entities)} |`;
      })
      .join("\n") +
    "\n"
  );
}

function gameMetadataPage(snapshot: SteamSnapshot) {
  const full = appSnapshotRows(snapshot.apps.full_game);
  const demo = appSnapshotRows(snapshot.apps.demo);
  return (
    frontmatter("Game Metadata", "Steam metadata summary for FROGGY HATES SNOW and its demo.") +
    "# Game Metadata\n\n" +
    "This page keeps volatile store metadata separate from gameplay guidance. Refresh it with `npm run fetch:steam` before relying on prices, review counts, or achievement percentages.\n\n" +
    "## Steam Apps\n\n" +
    steamAppComparison(snapshot) +
    "## Source Links\n\n" +
    `- [Full game Steam page](${snapshot.apps.full_game.source_url})\n` +
    `- [Demo Steam page](${snapshot.apps.demo.source_url})\n` +
    `- [Full game appdetails API](${snapshot.apps.full_game.api_url})\n` +
    `- [Demo appdetails API](${snapshot.apps.demo.api_url})\n` +
    `- [Steam achievement page](${snapshot.achievements.community_page_url})\n` +
    `- [Steam News API](${snapshot.sources.steam_news_api ?? snapshot.sources.steam_news_devlogs})\n\n` +
    "## Current Snapshot\n\n" +
    "| Field | Full Game | Demo |\n|---|---|---|\n" +
    [
      ["App ID", String(full.app_id), String(demo.app_id)],
      ["Title", full.title, demo.title],
      ["Type", full.type, demo.type],
      ["Release", full.release_date, demo.release_date],
      ["Developer", full.developer, demo.developer],
      ["Publisher", full.publisher, demo.publisher],
      ["Platforms", full.platforms, demo.platforms],
      ["Steam categories", full.categories, demo.categories],
      ["Languages", snapshot.apps.full_game.supported_languages_text, snapshot.apps.demo.supported_languages_text],
      ["Achievements", full.achievements, demo.achievements],
      ["Screenshots", full.screenshots, demo.screenshots],
      ["Review summary", fieldValue(snapshot.reviews.full_game), fieldValue(snapshot.reviews.demo)]
    ]
      .map(([field, fullValue, demoValue]) => `| ${field} | ${mdEscape(fullValue)} | ${mdEscape(demoValue)} |`)
      .join("\n") +
    "\n\n" +
    "## Demo Relationship\n\n" +
    `The demo app metadata links back to full app ${snapshot.apps.full_game.app_id}. The public source pass keeps demo facts separate because demo metadata and availability can drift independently from the released full game.\n`
  );
}

function relatedList(entity: Entity, lookup: Map<string, Entity>) {
  if (entity.related_entities.length === 0) return "No related entities listed yet.\n";
  return entity.related_entities
    .map((related) => {
      const target = lookup.get(related);
      if (!target) return `- ${related}`;
      return `- [${target.name}](${linkForEntity(target)}) (${target.verification_status})`;
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
  const achievementIcon =
    entity.icon_url && entity.category === "achievements"
      ? `<img src="${entity.icon_url}" alt="Steam achievement icon for ${mdEscape(entity.name)}" class="achievement-icon" loading="lazy" />\n\n_Public Steam achievement icon._\n\n`
      : "";
  return (
    frontmatter(entity.name, entity.short_description) +
    `# ${entity.name}\n\n` +
    statusCallout(entity) +
    achievementIcon +
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
    "\n- [Game Metadata](/game-metadata/)\n- [Steam Source Snapshot](/steam-source-snapshot/)\n- [Achievement Source Matrix](/achievement-source-matrix/)\n- [Source Ledger](/source-ledger/)\n- [Verification Status](/verification-status/)" +
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
  const extractedMetadata = await readJson<ExtractedMetadataSnapshot>(path.resolve("notes/extracted-metadata.json"));
  const allRows = datasetEntries.flatMap(([, rows]) => rows);
  const lookup = new Map<string, Entity>();
  for (const row of allRows) {
    lookup.set(row.id, row);
    lookup.set(row.slug, row);
  }

  await writeFile(path.join(outputRoot, "index.md"), homepage(allRows, steamSnapshot));
  await writeFile(path.join(outputRoot, "source-ledger.md"), sourceLedgerPage(publicSources, allRows));
  await writeFile(path.join(outputRoot, "steam-source-snapshot.md"), steamSnapshotPage(steamSnapshot, extractedMetadata));
  await writeFile(path.join(outputRoot, "achievement-source-matrix.md"), achievementSourceMatrixPage(steamSnapshot));
  await writeFile(path.join(outputRoot, "game-metadata.md"), gameMetadataPage(steamSnapshot));

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
