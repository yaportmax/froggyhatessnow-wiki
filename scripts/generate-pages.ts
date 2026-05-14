import { mkdir, readFile, rm, writeFile as writeRawFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { REQUIRED_DATASETS } from "./validate-data";

async function writeFile(filePath: string, contents: string) {
  await writeRawFile(filePath, contents.replace(/\n+$/u, "") + "\n");
}

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
  local_game_data?: LocalGameData;
};

type LocalGameData = {
  build?: {
    app_id?: string | null;
    app_name?: string | null;
    build_id?: string | null;
    build_target?: string | null;
    addressables_version?: string | null;
    locator_id?: string | null;
  };
  addressables?: {
    internal_id_count?: number;
    scenes?: string[];
    level_object_prefabs_count?: number;
    level_object_groups?: Array<{ group: string; count: number; examples: string[] }>;
  };
  localization?: {
    english_pairs_count?: number;
    prefix_counts?: Record<string, number>;
    languages_seen?: string[];
    skills?: Array<{ id: string; name: string; description: string; source_keys: string[] }>;
    characters?: Array<{ id: string; name: string; specialty: string; source_keys: string[] }>;
    locations?: Array<{ id: string; name: string; source_key: string }>;
    artifacts?: Array<{ id: string; name: string; source_key: string }>;
    stats?: Array<{ id: string; name: string; source_key: string }>;
    resources?: Array<{ id: string; name: string; source_key: string }>;
    quests?: Array<{ id: string; text: string; source_key: string }>;
    events?: Array<{ id: string; title: string; body: string; source_keys: string[] }>;
    rarities?: Array<{ id: string; name: string; source_key: string }>;
    end_states?: Array<{ id: string; name: string; source_key: string }>;
    source_paths?: string[];
  };
  managed_code?: {
    detected_markers?: string[];
    enum_groups?: Array<{ name: string; owner?: string | null; display_name?: string; value_count: number; values: string[]; value_map?: Array<{ name: string; value: unknown }>; truncated?: boolean }>;
    scriptable_object_types?: Array<{ name: string; owner?: string | null; display_name?: string; fields: string[]; field_count: number; truncated?: boolean }>;
    important_type_names?: string[];
    type_counts?: Record<string, number>;
    extractor_errors?: string[];
  };
  serialized_assets?: {
    object_counts?: Array<{ path: string; objects: number; top_types: Array<{ type: string; count: number }> }>;
    collectible_lists?: Array<{ name: string; source_path: string; items: Array<{ name: string; count: unknown; type?: unknown; type_id?: unknown }>; item_count: number }>;
    stripped_mono_behaviours?: Record<string, unknown>;
    gameplay_component_summaries?: {
      component_counts?: Record<string, number>;
      chest_controllers?: Array<Record<string, unknown>>;
      collectible_heaps?: Array<Record<string, unknown>>;
      collectible_challenges?: Array<Record<string, unknown>>;
      collectible_pits?: Array<Record<string, unknown>>;
      quick_collectible_spawners?: Array<Record<string, unknown>>;
      tree_spawn_point_roots?: Array<Record<string, unknown>>;
      heap_spawners?: Array<Record<string, unknown>>;
      spawn_slot_configs?: Array<Record<string, unknown>>;
      status_effect_bar_types?: Array<Record<string, unknown>>;
    };
    extractor_errors?: string[];
  };
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

function htmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function truncateForTable(value: unknown, maxLength = 180) {
  const text = mdEscape(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}...`;
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
  return steamMediaGrid(snapshot.apps.full_game.screenshots, "Public Steam screenshot for FROGGY HATES SNOW", "steam-media-grid");
}

function steamMediaGrid(shots: Array<{ thumbnail_url: string; full_url: string }>, alt: string, className = "steam-media-grid") {
  const visibleShots = shots.filter((shot) => shot.thumbnail_url && shot.full_url);
  if (visibleShots.length === 0) return "";
  return [
    `<div class="${className}">`,
    ...visibleShots.map((shot, index) => `<a href="${htmlEscape(shot.full_url)}" rel="noopener"><img src="${htmlEscape(shot.thumbnail_url)}" alt="${htmlEscape(`${alt} ${index + 1}`)}" loading="lazy" /></a>`),
    "</div>",
    ""
  ].join("\n");
}

function steamScreenshotStrip(snapshot: SteamSnapshot, start = 0, count = 3) {
  const shots = snapshot.apps.full_game.screenshots.slice(start, start + count);
  return steamMediaGrid(shots, "Public Steam screenshot for FROGGY HATES SNOW", "steam-media-strip");
}

function steamHeroImage(snapshot: SteamSnapshot) {
  const headerImage = snapshot.apps.full_game.header_image;
  if (!headerImage) return "";
  return `<figure class="wiki-hero-media"><img src="${htmlEscape(headerImage)}" alt="FROGGY HATES SNOW public Steam header art" loading="eager" /></figure>\n\n`;
}

function mediaGalleryPage(snapshot: SteamSnapshot) {
  const full = snapshot.apps.full_game;
  const demo = snapshot.apps.demo;
  const movieThumbs = [...(full.movies ?? []), ...(demo.movies ?? [])].flatMap((movie) => {
    const thumbnail = movie.thumbnail_url;
    return thumbnail ? [{ thumbnail_url: thumbnail, full_url: thumbnail }] : [];
  });
  return (
    frontmatter("Media", "Public Steam screenshots and media for FROGGY HATES SNOW.") +
    "Public Steam media that is safe to show on the wiki. Proprietary assets extracted from local game files are intentionally not redistributed.\n\n" +
    (full.header_image
      ? `<figure class="wiki-wide-media"><img src="${htmlEscape(full.header_image)}" alt="FROGGY HATES SNOW public Steam header art" loading="lazy" /></figure>\n\n`
      : "") +
    "## Full-Game Screenshots\n\n" +
    screenshotGrid(snapshot) +
    (demo.screenshots?.length
      ? "## Demo Screenshots\n\n" + steamMediaGrid(demo.screenshots, "Public Steam demo screenshot for FROGGY HATES SNOW", "steam-media-grid")
      : "") +
    (movieThumbs.length ? "## Video Thumbnails\n\n" + steamMediaGrid(movieThumbs, "Public Steam video thumbnail for FROGGY HATES SNOW", "steam-media-grid steam-media-grid--small") : "") +
    "## Related\n\n" +
    relationList([
      pageLink("Home", "/"),
      pageLink("Frogs", "/generated/frogs/"),
      pageLink("Maps", "/generated/maps/"),
      pageLink("Mechanics", "/generated/mechanics/")
    ])
  );
}

function steamNewsFindings(snapshot: SteamSnapshot) {
  const findings = snapshot.steam_news_findings;
  const newsItems = findings.news_items ?? [];
  const allNewsItems = findings.all_news_items ?? [];
  return (
    "## Steam News & Devlogs\n\n" +
    `Reference stream: [Steam community news/devlogs](${findings.source_url}).\n\n` +
    "| Finding | Value |\n|---|---|\n" +
    [
      ["Playable frogs", String(findings.playable_frogs_count)],
      ["Locations", String(findings.locations_count)],
      ["Skills/tools/attacks/companions", `${findings.minimum_combined_skills_tools_attacks_companions}+`],
      ["Demo progress carries over", findings.demo_progress_carries_over ? "yes" : "no"],
      ["Steam News API items classified", String(findings.fetched_news_item_count ?? allNewsItems.length)],
      ["Direct gameplay/update references mapped", String(newsItems.length)],
      ["Confirmed named terms", findings.confirmed_terms.join(", ")]
    ]
      .map(([field, value]) => `| ${field} | ${mdEscape(value)} |`)
      .join("\n") +
    "\n\n" +
    findings.notes.map((note) => `- ${mdEscape(note)}`).join("\n") +
    "\n\n" +
    (newsItems.length > 0
      ? "### Direct Steam News References\n\n" +
        "| Date | Reference ID | Title | Supports |\n|---|---|---|---|\n" +
        newsItems
          .map((item) => `| ${mdEscape(item.date)} | ${inlineCode(item.source_id)} | [${mdEscape(item.title)}](${item.url}) | ${mdEscape(item.supports)} |`)
          .join("\n") +
        "\n\n"
      : "") +
    (allNewsItems.length > 0
      ? "### All Steam News Items\n\n" +
        "Every current Steam News API item is recorded below. Items classified as marketing/event or weak/no-gameplay are kept for audit coverage but should not be used as gameplay evidence.\n\n" +
        "| Date | Reference ID | Title | Classification | Evidence | Scope | Limits |\n|---|---|---|---|---|---|---|\n" +
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
    "## External Reference Checks\n\n" +
    "These non-Steam public pages are fetched during `npm run fetch:steam`; missing marker text fails the refresh so cited non-Steam claims do not silently rot.\n\n" +
    "| Reference | Status | Matched Markers | Notes |\n|---|---:|---|---|\n" +
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
  const local = snapshot.local_game_data;
  const localCounts =
    local && local.localization
      ? ` Local extraction currently found ${local.localization.skills?.length ?? 0} skill/tool strings, ${local.localization.characters?.length ?? 0} character rows, ${local.localization.locations?.length ?? 0} location names, ${local.localization.artifacts?.length ?? 0} artifact names, ${local.localization.resources?.length ?? 0} resource labels, ${local.localization.quests?.length ?? 0} quest strings, ${local.localization.events?.length ?? 0} event notifications, and ${local.managed_code?.enum_groups?.length ?? 0} managed enum groups.`
      : "";
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
      ? "The local metadata pass currently contributes no game facts. Public Steam and public web references are the only populated game-data references until SteamCMD/local extraction succeeds.\n\n"
      : `Readable local metadata is summarized in \`notes/extracted-metadata.md\` and \`notes/extracted-metadata.json\` without redistributing game assets or long raw excerpts.${localCounts} See [Game File Extraction](/game-file-extraction/) for the player-useful tables.\n\n`)
  );
}

function localDataSourceNote() {
  return "";
}

function localExtractionSummary(local?: LocalGameData) {
  if (!local) return "";
  const localization = local.localization ?? {};
  const addressables = local.addressables ?? {};
  const managed = local.managed_code ?? {};
  const stripped = asRecord(local.serialized_assets?.stripped_mono_behaviours);
  const statusEffects = asArray(stripped.status_effect_upgrades);
  const coreSkills = (localization.skills ?? []).filter((skill) => !isStatusEffectVariantSkill(skill as Record<string, unknown>, statusEffects));
  const gameplayComponents = local.serialized_assets?.gameplay_component_summaries?.component_counts ?? {};
  const gameplayComponentTotal = Object.values(gameplayComponents).reduce((sum, count) => sum + Number(count ?? 0), 0);
  const enemyWaveRows = asArray(stripped.enemy_wave_data).reduce((sum, row) => sum + asArray(row.arenas).reduce((arenaSum, arena) => arenaSum + asArray(arena.waves).length, 0), 0);
  const levelObjectRules = asArray(stripped.level_object_spawner_data).reduce((sum, row) => sum + asArray(row.sections).reduce((sectionSum, section) => sectionSum + asArray(section.entries).length, 0), 0);
  const bossPhaseOrders = asArray(stripped.enemy_component_payloads).reduce((sum, row) => sum + asArray(row.boss_phase_orders).length, 0);
  return (
    "| Extracted Area | Count / Value |\n|---|---:|\n" +
    [
      ["Localized core skill/tool rows", String(coreSkills.length)],
      ["Status/effect upgrade label rows", String(statusEffects.length)],
      ["Playable character rows", String(localization.characters?.length ?? 0)],
      ["Location names", String(localization.locations?.length ?? 0)],
      ["Artifact names", String(localization.artifacts?.length ?? 0)],
      ["Stat labels", String(localization.stats?.length ?? 0)],
      ["Resource labels", String(localization.resources?.length ?? 0)],
      ["Rarity labels", String(localization.rarities?.length ?? 0)],
      ["Quest strings", String(localization.quests?.length ?? 0)],
      ["Event notifications", String(localization.events?.length ?? 0)],
      ["End-state labels", String(localization.end_states?.length ?? 0)],
      ["Addressable internal IDs", String(addressables.internal_id_count ?? 0)],
      ["Level-object prefabs", String(addressables.level_object_prefabs_count ?? 0)],
      ["Managed enum groups", String(managed.enum_groups?.length ?? 0)],
      ["ScriptableObject/DataSO types", String(managed.scriptable_object_types?.length ?? 0)],
      ["Structurally decoded character payloads", String(asArray(stripped.characters).length)],
      ["Structurally decoded location payloads", String(asArray(stripped.locations).length)],
      ["Structurally decoded artifact payloads", String(asArray(stripped.artifacts).length)],
      ["Upgrade payloads with values/unlocks", String(asArray(stripped.upgrade_assets).length)],
      ["Status-effect upgrade payloads", String(asArray(stripped.status_effect_upgrades).length)],
      ["Enemy/boss component payloads", String(asArray(stripped.enemy_component_payloads).length)],
      ["Enemy wave rows", String(enemyWaveRows)],
      ["Level-object spawn rules", String(levelObjectRules)],
      ["Boss phase-order rows", String(bossPhaseOrders)],
      ["Decoded gameplay component instances", String(gameplayComponentTotal)]
    ]
      .map(([field, value]) => `| ${field} | ${mdEscape(value)} |`)
      .join("\n") +
    "\n\n"
  );
}

function compactTableRows<T>(rows: T[], render: (row: T) => string, limit = 160) {
  const shown = rows.slice(0, limit).map(render).join("\n");
  const more = rows.length > limit ? `\n| ${rows.length - limit} additional rows omitted from page | See notes/extracted-metadata.json | |` : "";
  return shown + more + "\n";
}

function extractedSkillRows(skills: NonNullable<NonNullable<LocalGameData["localization"]>["skills"]>, rows: Entity[]) {
  if (rows.length === 0) return skills;
  const names = new Set(rows.flatMap((row) => [row.name.toLowerCase(), ...row.aliases.map((alias) => alias.toLowerCase())]));
  const ids = new Set(rows.map((row) => row.slug));
  return skills.filter((skill) => names.has(skill.name.toLowerCase()) || ids.has(skill.id));
}

function enumByName(local: LocalGameData | undefined, name: string) {
  return local?.managed_code?.enum_groups?.find((group) => group.name === name || group.display_name === name);
}

function enumValues(local: LocalGameData | undefined, name: string) {
  return enumByName(local, name)?.values?.filter((value) => !/^none$/i.test(value) && value !== "NONE") ?? [];
}

function examplesCell(row: Record<string, unknown>) {
  return Array.isArray(row.examples) ? row.examples.map(String).join(", ") : "";
}

function rawCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function displayText(value: unknown) {
  return String(value ?? "")
    .replace(/^_+/, "")
    .replace(/_/g, " ")
    .replace(/\bPoision\b/g, "Poison")
    .replace(/\bRecieve\b/g, "Receive");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>>) : [];
}

function slugify(value: unknown) {
  const slug = String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unknown";
}

function lookupKey(value: unknown) {
  return slugify(value).replace(/^\d+-/, "");
}

function extractedLabel(row: Record<string, unknown>) {
  return row.feature_name ?? row.name ?? row.feature ?? row.class ?? "Unknown";
}

function isPlayerFacingAsset(row: Record<string, unknown>) {
  const label = String(row.name ?? row.object_name ?? row.feature_name ?? "");
  return row.debug_or_test_asset !== true && !/(^|[_\s-])old$/i.test(label) && !/^test\b/i.test(label);
}

function isStatusEffectVariantSkill(skill: Record<string, unknown>, statusEffects: Array<Record<string, unknown>>) {
  const name = displayText(skill.name).trim();
  const id = String(skill.id ?? "");
  const description = displayText(skill.description);
  if (!name) return false;
  const matchesExtractedEffect = statusEffects.some((effect) => {
    const labels = [effect.feature_name, effect.name, effect.feature].filter(Boolean).map((value) => slugify(value));
    return labels.includes(slugify(name));
  });
  if (matchesExtractedEffect) return true;
  const statusSuffix = /\s(Fire|Frost|Lightning|Poison|Stun)$/i.test(name) || /_(fire|frost|lightning|poison|stun)$/i.test(id);
  const statusDescription = /(Infliction on hit|threshold is reached|Effect triggers|chance to trigger)/i.test(description);
  if (statusSuffix && statusDescription) return true;
  return /^Roll Damage$/i.test(name) && /Physical Damage on impact/i.test(description);
}

function statusEffectSkillSlug(effect: Record<string, unknown>, skillSlugByName: Map<string, string>) {
  const label = String(effect.feature_name ?? effect.name ?? "");
  const candidates = [label, String(effect.feature ?? ""), label.replace(/^Curvy\s+/i, "Curvy Tongue ")];
  for (const candidate of candidates) {
    const slug = skillSlugByName.get(candidate.toLowerCase());
    if (slug) return slug;
  }
  return undefined;
}

function statusEffectBaseSkillSlug(effect: Record<string, unknown>, skillSlugByName: Map<string, string>) {
  const rawName = displayText(effect.name || effect.feature_name);
  const prefix = rawName.replace(/\s+(Fire|Frost|Lightning|Poison|Stun)$/i, "");
  const aliases: Record<string, string> = {
    BaseballBat: "Baseball Bat",
    CurvyTongue: "Curvy Tongue",
    EnergyWave: "Energy Wave",
    HeavyJump: "Precise Jump",
    "Hockey Stick": "Hockey Stick",
    Icicle: "Piercing Icicles",
    Pickaxe: "Pickaxe",
    Roll: "Swift Roll",
    "Roll Physical Damage": "Roll Damage",
    Snowball: "Snowball Volley",
    Snowgun: "Snowballer",
    SpitAttack: "Spit Attack",
    TongueAttack: "Tongue Attack",
    Wrench: "Wrench Attack"
  };
  return skillSlugByName.get((aliases[prefix] ?? prefix).toLowerCase());
}

function pageLink(label: unknown, href: string) {
  return `[${mdEscape(displayText(label))}](${href})`;
}

function extractedSourceNote() {
  return "";
}

function statDisplay(row: Record<string, unknown>) {
  const label = row.display_label || row.stat || row.stat_id || "Stat";
  const delta = row.display_delta || row.value || "";
  return `${label}: ${delta}`;
}

function progressionValues(value: unknown) {
  const record = asRecord(value);
  const values = Array.isArray(record.values) ? record.values.map((item) => displayText(item)).join(", ") : "";
  if (values) return values;
  const start = record.start ?? "";
  const end = record.end ?? "";
  return start !== "" || end !== "" ? `${start} -> ${end}` : "";
}

function valueRangeText(row: Record<string, unknown>) {
  const values = Array.isArray(row.values) && row.values.length > 0 ? ` (${row.values.map((item) => displayText(item)).join(", ")})` : "";
  return `${row.label ?? "Value"}: ${row.start ?? ""} -> ${row.end ?? ""}${values}`;
}

function valueRangeBrief(row: Record<string, unknown>) {
  const start = displayText(row.start);
  const end = displayText(row.end);
  if (!start && !end) return "";
  if (start === end) return start;
  return `${start} -> ${end}`;
}

function valueRangeLevelValues(row: Record<string, unknown>) {
  return Array.isArray(row.values) ? row.values.map((item) => displayText(item)).join(", ") : "";
}

function valueRangeTable(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "";
  return (
    "| Parameter | Start | End | Level values |\n|---|---:|---:|---|\n" +
    rows
      .map((row) => `| ${mdEscape(row.label ?? "Value")} | ${mdEscape(row.start)} | ${mdEscape(row.end)} | ${mdEscape(valueRangeLevelValues(row))} |`)
      .join("\n") +
    "\n"
  );
}

function valueSequenceHtml(row: Record<string, unknown>) {
  if (!Array.isArray(row.values) || row.values.length === 0) return "";
  return `<div class="wiki-value-sequence">${row.values.map((value) => `<span>${htmlText(value)}</span>`).join("")}</div>`;
}

function valueRangeTableHtml(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "";
  return wikiDataTable(
    ["Parameter", "Start", "End", "Level values"],
    rows.map((row) => [htmlText(row.label ?? "Value"), htmlText(row.start), htmlText(row.end), valueSequenceHtml(row) || htmlText(valueRangeLevelValues(row))]),
    "wiki-data-table--values"
  );
}

function cleanQuestText(value: unknown) {
  return displayText(value).replace(/\s*\[questID:\s*\d+\]\s*/gi, "").replace(/\s+/g, " ").trim();
}

function spawnerLabel(name: unknown, klass: unknown) {
  const type = String(klass ?? "");
  if (type === "EnemySpawnerWavesData") return `Enemy waves: ${displayText(name)}`;
  if (type === "LevelObjectSpawnerData") return `Level objects: ${displayText(name)}`;
  if (type === "TerrainHeightData") return `Terrain height: ${displayText(name)}`;
  if (type === "TerrainTextureData") return `Terrain texture: ${displayText(name)}`;
  return displayText(name);
}

function relationList(links: string[]) {
  const unique = [...new Set(links.filter(Boolean))];
  if (unique.length === 0) return "";
  return `<ul class="wiki-inline-list">${unique.map((link) => `<li>${chipHtml(link)}</li>`).join("")}</ul>\n\n`;
}

function chipHtml(value: string) {
  const match = value.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (match) return `<a href="${htmlEscape(match[2])}">${htmlEscape(displayText(match[1]))}</a>`;
  return htmlEscape(displayText(value));
}

function htmlLink(label: unknown, href: string) {
  return `<a href="${htmlEscape(href)}">${htmlEscape(displayText(label))}</a>`;
}

function nonEmptyText(value: unknown) {
  return displayText(value).trim().length > 0;
}

function htmlText(value: unknown) {
  return htmlEscape(displayText(value));
}

function wikiChipListHtml(values: string[]) {
  const unique = [...new Set(values.filter(Boolean))];
  if (unique.length === 0) return "";
  return `<ul class="wiki-inline-list">${unique.map((value) => `<li>${chipHtml(value)}</li>`).join("")}</ul>`;
}

function wikiTextList(values: unknown[]) {
  const visible = values.map(displayText).map((value) => value.trim()).filter(Boolean);
  if (visible.length === 0) return "";
  return `<ul class="wiki-list">${visible.map((value) => `<li>${htmlEscape(value)}</li>`).join("")}</ul>`;
}

function wikiHtmlList(values: string[]) {
  const visible = values.map((value) => value.trim()).filter(Boolean);
  if (visible.length === 0) return "";
  return `<ul class="wiki-list">${visible.map((value) => `<li>${value}</li>`).join("")}</ul>`;
}

function tableClassName(className: string) {
  return className
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.replace(/wiki-reference-grid/g, "wiki-reference-table").replace(/grid/g, "table"))
    .join(" ");
}

function wikiDataTable(headers: string[], rows: string[][], className = "") {
  const visibleRows = rows.filter((row) => row.some((cell) => cell.trim().length > 0));
  if (visibleRows.length === 0) return "";
  const classes = ["wiki-table-scroll", tableClassName(className)].filter(Boolean).join(" ");
  return (
    `<div class="${classes}">\n` +
    `<table class="wiki-data-table">\n<thead><tr>${headers.map((header) => `<th scope="col">${htmlEscape(header)}</th>`).join("")}</tr></thead>\n<tbody>\n` +
    visibleRows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("\n") +
    "\n</tbody>\n</table>\n</div>\n\n"
  );
}

function definitionListHtml(facts?: Array<[string, unknown]>) {
  const rows = (facts ?? []).filter(([, value]) => nonEmptyText(value));
  if (rows.length === 0) return "";
  return `<dl class="wiki-compact-list">${rows.map(([label, value]) => `<div><dt>${htmlEscape(label)}</dt><dd>${htmlText(value)}</dd></div>`).join("")}</dl>`;
}

function referenceSectionHtml(sections?: Array<{ label: string; html?: string; value?: unknown }>) {
  return (sections ?? [])
    .map((section) => {
      const body = section.html ?? (nonEmptyText(section.value) ? `<p>${htmlText(section.value)}</p>` : "");
      if (!body.trim()) return "";
      return `<section class="wiki-table-section"><strong>${htmlEscape(section.label)}</strong>${body}</section>`;
    })
    .filter(Boolean)
    .join("");
}

function wikiReferenceGrid(
  entries: Array<{
    title: unknown;
    href?: string;
    description?: unknown;
    facts?: Array<[string, unknown]>;
    sections?: Array<{ label: string; html?: string; value?: unknown }>;
  }>,
  className = ""
) {
  const visibleEntries = entries.filter((entry) => nonEmptyText(entry.title));
  if (visibleEntries.length === 0) return "";
  const prepared = visibleEntries.map((entry) => ({
    title: entry.href ? htmlLink(entry.title, entry.href) : htmlText(entry.title),
    description: nonEmptyText(entry.description) ? htmlText(entry.description) : "",
    facts: definitionListHtml(entry.facts),
    details: referenceSectionHtml(entry.sections)
  }));
  const hasDescriptions = prepared.some((row) => row.description);
  const hasFacts = prepared.some((row) => row.facts);
  const hasDetails = prepared.some((row) => row.details);
  const headers = ["Name", ...(hasDescriptions ? ["Description"] : []), ...(hasFacts ? ["Stats"] : []), ...(hasDetails ? ["Details"] : [])];
  const rows = prepared.map((row) => [row.title, ...(hasDescriptions ? [row.description] : []), ...(hasFacts ? [row.facts] : []), ...(hasDetails ? [row.details] : [])]);
  return wikiDataTable(headers, rows, className || "wiki-reference-table");
}

function wikiSummaryTable(entries: Array<{ label: string; value: unknown; href?: string }>) {
  const visibleEntries = entries.filter((entry) => displayText(entry.value));
  if (visibleEntries.length === 0) return "";
  return (
    '<div class="wiki-table-scroll wiki-table-scroll--summary">\n<table class="wiki-summary-table">\n<tbody>\n' +
    visibleEntries
      .map((entry) => {
        const value = entry.href ? `<a href="${htmlEscape(entry.href)}">${htmlText(entry.value)}</a>` : htmlText(entry.value);
        return `<tr><th scope="row">${htmlEscape(entry.label)}</th><td>${value}</td></tr>`;
      })
      .join("\n") +
    "\n</tbody>\n</table>\n</div>\n\n"
  );
}

function wikiInfoBox(title: unknown, rows: Array<{ label: string; value: unknown; href?: string }>) {
  const visibleRows = rows.filter((row) => displayText(row.value));
  if (visibleRows.length === 0) return "";
  return (
    `<aside class="wiki-infobox">\n` +
    `<div class="wiki-infobox__title">The ${htmlText(title)}</div>\n` +
    `<table>\n<tbody>\n` +
    visibleRows
      .map((row) => {
        const value = row.href ? `<a href="${htmlEscape(row.href)}">${htmlText(row.value)}</a>` : htmlText(row.value);
        return `<tr><th scope="row">${htmlEscape(row.label)}</th><td>${value}</td></tr>`;
      })
      .join("\n") +
    `\n</tbody>\n</table>\n</aside>\n\n`
  );
}

function strippedData(extracted: ExtractedMetadataSnapshot) {
  return asRecord(extracted.local_game_data?.serialized_assets?.stripped_mono_behaviours);
}

function formatCollectibleItem(item: { name: string; count: unknown; type?: unknown; type_id?: unknown }) {
  const name = String(item.name ?? "").trim();
  const count = item.count ?? "?";
  const hasCountInName = new RegExp(`\\bx\\s*${String(count).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i").test(name);
  const type = item.type ? ` (${item.type})` : item.type_id !== undefined ? ` (type ${item.type_id})` : "";
  return `${name}${hasCountInName ? "" : ` x${count}`}${type}`;
}

function localNamesForEntity(entity: Entity) {
  return new Set([entity.name.toLowerCase(), entity.slug, ...entity.aliases.map((alias) => alias.toLowerCase())]);
}

function localSkillForEntity(local: LocalGameData | undefined, entity: Entity) {
  const names = localNamesForEntity(entity);
  return (local?.localization?.skills ?? []).find((skill) => names.has(skill.name.toLowerCase()) || names.has(skill.id));
}

function localArtifactForEntity(local: LocalGameData | undefined, entity: Entity) {
  const names = localNamesForEntity(entity);
  return (local?.localization?.artifacts ?? []).find((artifact) => names.has(artifact.name.toLowerCase()) || names.has(artifact.id));
}

function localResourceForEntity(local: LocalGameData | undefined, entity: Entity) {
  const names = localNamesForEntity(entity);
  return (local?.localization?.resources ?? []).find((resource) => names.has(resource.name.toLowerCase()) || names.has(resource.id));
}

function localStatForEntity(local: LocalGameData | undefined, entity: Entity) {
  const names = localNamesForEntity(entity);
  return (local?.localization?.stats ?? []).find((stat) => names.has(stat.name.toLowerCase()) || names.has(stat.id));
}

function localExtractionSection(dataset: string, rows: Entity[], extracted: ExtractedMetadataSnapshot) {
  const local = extracted.local_game_data;
  if (!local) return "";
  const stripped = strippedData(extracted);
  const localization = local.localization ?? {};
  const skills = localization.skills ?? [];
  const statusEffects = asArray(stripped.status_effect_upgrades);
  const coreSkills = skills.filter((skill) => !isStatusEffectVariantSkill(skill as Record<string, unknown>, statusEffects));
  const characters = localization.characters ?? [];
  const locations = localization.locations ?? [];
  const artifacts = localization.artifacts ?? [];
  const stats = localization.stats ?? [];
  const resources = localization.resources ?? [];
  const quests = localization.quests ?? [];
  const events = localization.events ?? [];
  const rarities = localization.rarities ?? [];
  const endStates = localization.end_states ?? [];
  const groups = local.addressables?.level_object_groups ?? [];

  if (dataset === "skills") {
    return (
      "\n## Game-File Extracted Core Skills\n\n" +
      localDataSourceNote() +
      "| Name | In-game description |\n|---|---|\n" +
      compactTableRows(coreSkills, (skill) => `| ${mdEscape(skill.name)} | ${mdEscape(skill.description)} |`)
    );
  }

  if (dataset === "tools") {
    const localTools = extractedSkillRows(skills, rows);
    return (
      "\n## Game-File Extracted Tool Rows\n\n" +
      localDataSourceNote() +
      "| Name | In-game description |\n|---|---|\n" +
      compactTableRows(localTools, (skill) => `| ${mdEscape(skill.name)} | ${mdEscape(skill.description)} |`, 80)
    );
  }

  if (dataset === "companions") {
    const companionNames = new Set(["Penguin", "Mole", "Owl", "Dog", "Cat"]);
    const companionRows = skills.filter((skill) => companionNames.has(skill.name));
    const companionIds = enumValues(local, "CompanionID");
    return (
      "\n## Game-File Extracted Companions\n\n" +
      localDataSourceNote() +
      (companionIds.length > 0 ? `Managed companion IDs: ${companionIds.map(inlineCode).join(", ")}.\n\n` : "") +
      "| Name | In-game description |\n|---|---|\n" +
      compactTableRows(companionRows, (skill) => `| ${mdEscape(skill.name)} | ${mdEscape(skill.description)} |`, 40)
    );
  }

  if (dataset === "frogs") {
    return (
      "\n## Game-File Extracted Character Roster\n\n" +
      localDataSourceNote() +
      "| Slot | Name | Specialty |\n|---|---|---|\n" +
      compactTableRows(characters, (character) => `| ${mdEscape(character.id.replace("character_", ""))} | ${mdEscape(character.name)} | ${mdEscape(character.specialty)} |`, 40)
    );
  }

  if (dataset === "maps") {
    return (
      "\n## Game-File Extracted Locations And Level Objects\n\n" +
      localDataSourceNote() +
      "| Slot | Location name |\n|---|---|\n" +
      compactTableRows(locations, (location) => `| ${mdEscape(location.id.replace("location_", ""))} | ${mdEscape(location.name)} |`, 40) +
      "\n### Addressable Level-Object Groups\n\n" +
      "| Group | Count | Examples |\n|---|---:|---|\n" +
      compactTableRows(groups, (group) => `| ${mdEscape(group.group)} | ${group.count} | ${mdEscape(group.examples.join(", "))} |`, 20)
    );
  }

  if (dataset === "items") {
    return (
      "\n## Game-File Extracted Artifacts\n\n" +
      localDataSourceNote() +
      "| ID | Artifact name |\n|---|---|\n" +
      compactTableRows(artifacts, (artifact) => `| ${mdEscape(artifact.id.replace("artifact_", ""))} | ${mdEscape(artifact.name)} |`, 80) +
      "\n### Resource Labels\n\n" +
      "| ID | Resource name |\n|---|---|\n" +
      compactTableRows(resources, (resource) => `| ${mdEscape(resource.id)} | ${mdEscape(resource.name)} |`, 40) +
      "\n### Rarity Labels\n\n" +
      "| ID | Rarity name |\n|---|---|\n" +
      compactTableRows(rarities, (rarity) => `| ${mdEscape(rarity.id)} | ${mdEscape(rarity.name)} |`, 20)
    );
  }

  if (dataset === "upgrades") {
    return (
      "\n## Game-File Extracted Stat Labels\n\n" +
      localDataSourceNote() +
      "| Stat | Label |\n|---|---|\n" +
      compactTableRows(stats, (stat) => `| ${inlineCode(stat.id)} | ${mdEscape(stat.name)} |`, 80)
    );
  }

  if (dataset === "glossary") {
    const gameModes = enumValues(local, "GameMode");
    const difficulty = enumValues(local, "DifficultyLevel");
    return (
      "\n## Game-File Extracted System Terms\n\n" +
      localDataSourceNote() +
      "| Term Set | Values |\n|---|---|\n" +
      [
        ["Game modes", gameModes],
        ["Difficulty levels", difficulty]
      ]
        .map(([label, values]) => `| ${mdEscape(label as string)} | ${(values as string[]).map(inlineCode).join(", ")} |`)
        .join("\n") +
      "\n\nInternal feature and quest-logic IDs are kept on [Game File Extraction](/game-file-extraction/) so this glossary stays readable.\n\n" +
      "### Quest Strings\n\n" +
      "| Quest key | Text |\n|---|---|\n" +
      compactTableRows(quests, (quest) => `| ${inlineCode(quest.id)} | ${mdEscape(displayText(quest.text))} |`, 80) +
      "\n### Event Notifications\n\n" +
      "| Event | Message |\n|---|---|\n" +
      compactTableRows(events, (event) => `| ${mdEscape(event.title)} | ${mdEscape(event.body)} |`, 40) +
      "\n### End States\n\n" +
      "| ID | Label |\n|---|---|\n" +
      compactTableRows(endStates, (state) => `| ${mdEscape(state.id)} | ${mdEscape(state.name)} |`, 20)
    );
  }

  return "";
}

function gameFileExtractionPage(extracted: ExtractedMetadataSnapshot) {
  const local = extracted.local_game_data;
  if (!local) {
    return (
      frontmatter("Game File Extraction", "Local game-file extraction status for FROGGY HATES SNOW.") +
      "No local game-file data is currently extracted. Run `npm run scan` after `game-files/` contains the demo build.\n"
    );
  }
  const build = local.build ?? {};
  const localization = local.localization ?? {};
  const addressables = local.addressables ?? {};
  const managed = local.managed_code ?? {};
  const serialized = local.serialized_assets ?? {};
  const gameplay = serialized.gameplay_component_summaries ?? {};
  const keyEnums = ["FeatureID", "ArtifactID", "QuestLogicsID", "CompanionID", "VisualsID", "GameMode", "DifficultyLevel"]
    .map((name) => enumByName(local, name))
    .filter((value): value is NonNullable<ReturnType<typeof enumByName>> => Boolean(value));

  return (
    frontmatter("Game File Extraction", "Player-useful local game-file extraction for FROGGY HATES SNOW.") +
    "This page is the local extraction checkpoint. It exists because public Steam pages are not enough for a useful wiki. The extractor keeps facts short and evidence-labeled without redistributing proprietary game files, binaries, program code, images, audio, or large raw text dumps.\n\n" +
    "## Build\n\n" +
    "| Field | Value |\n|---|---|\n" +
    [
      ["Steam app ID", build.app_id ?? "not detected"],
      ["App name", build.app_name ?? "not detected"],
      ["Steam build ID", build.build_id ?? "not detected"],
      ["Build target", build.build_target ?? "not detected"],
      ["Addressables version", build.addressables_version ?? "not detected"],
      ["Addressables locator", build.locator_id ?? "not detected"],
      ["Scan generated", extracted.generated_at ?? "not detected"]
    ]
      .map(([field, value]) => `| ${mdEscape(field)} | ${mdEscape(value)} |`)
      .join("\n") +
    "\n\n## Coverage\n\n" +
    localExtractionSummary(local) +
    "## Extracted Character Roster\n\n" +
    "| Slot | Name | Specialty |\n|---|---|---|\n" +
    compactTableRows(localization.characters ?? [], (character) => `| ${mdEscape(character.id.replace("character_", ""))} | ${mdEscape(character.name)} | ${mdEscape(character.specialty)} |`, 40) +
    "\n## Extracted Locations\n\n" +
    "| Slot | Location name |\n|---|---|\n" +
    compactTableRows(localization.locations ?? [], (location) => `| ${mdEscape(location.id.replace("location_", ""))} | ${mdEscape(location.name)} |`, 40) +
    "\n## Extracted Core Skills And Tools\n\n" +
    "| Name | In-game description |\n|---|---|\n" +
    compactTableRows(
      (localization.skills ?? []).filter((skill) => !isStatusEffectVariantSkill(skill as Record<string, unknown>, asArray(stripped.status_effect_upgrades))),
      (skill) => `| ${mdEscape(skill.name)} | ${mdEscape(skill.description)} |`
    ) +
    "\n## Extracted Status And Effect Upgrades\n\n" +
    "| Name | Base feature | Type |\n|---|---|---|\n" +
    compactTableRows(
      asArray(stripped.status_effect_upgrades),
      (effect) => `| ${mdEscape(effect.feature_name ?? effect.name)} | ${mdEscape(effect.feature)} | ${mdEscape(effect.damageable_effect_type ?? effect.damageable_effect_type_id)} |`
    ) +
    "\n## Extracted Artifacts\n\n" +
    "| ID | Artifact name |\n|---|---|\n" +
    compactTableRows(localization.artifacts ?? [], (artifact) => `| ${mdEscape(artifact.id.replace("artifact_", ""))} | ${mdEscape(artifact.name)} |`, 80) +
    "\n## Extracted Resources And Rarities\n\n" +
    "| ID | Resource name |\n|---|---|\n" +
    compactTableRows(localization.resources ?? [], (resource) => `| ${mdEscape(resource.id)} | ${mdEscape(resource.name)} |`, 40) +
    "\n| ID | Rarity name |\n|---|---|\n" +
    compactTableRows(localization.rarities ?? [], (rarity) => `| ${mdEscape(rarity.id)} | ${mdEscape(rarity.name)} |`, 20) +
    "\n## Extracted Stat Labels\n\n" +
    "| Stat key | Label |\n|---|---|\n" +
    compactTableRows(localization.stats ?? [], (stat) => `| ${inlineCode(stat.id)} | ${mdEscape(stat.name)} |`, 100) +
    "\n## Extracted Quest Strings\n\n" +
    "| Quest key | Text |\n|---|---|\n" +
    compactTableRows(localization.quests ?? [], (quest) => `| ${inlineCode(quest.id)} | ${mdEscape(displayText(quest.text))} |`, 100) +
    "\n## Extracted Event Notifications\n\n" +
    "| Event | Message |\n|---|---|\n" +
    compactTableRows(localization.events ?? [], (event) => `| ${mdEscape(event.title)} | ${mdEscape(event.body)} |`, 60) +
    "\n## Extracted End States\n\n" +
    "| ID | Label |\n|---|---|\n" +
    compactTableRows(localization.end_states ?? [], (state) => `| ${mdEscape(state.id)} | ${mdEscape(state.name)} |`, 20) +
    "\n## Addressables\n\n" +
    `Scenes: ${(addressables.scenes ?? []).map(inlineCode).join(", ") || "none detected"}.\n\n` +
    "| Level-object group | Count | Examples |\n|---|---:|---|\n" +
    compactTableRows(addressables.level_object_groups ?? [], (group) => `| ${mdEscape(group.group)} | ${group.count} | ${mdEscape(group.examples.join(", "))} |`, 20) +
    "\n## Managed Assembly Enums\n\n" +
    "These are enum labels from `Assembly-CSharp.dll`; they verify internal identifiers and system categories, not balance values or exact unlock costs.\n\n" +
    "| Enum | Values |\n|---|---|\n" +
    compactTableRows(keyEnums, (group) => `| ${mdEscape(group.display_name ?? group.name)} | ${mdEscape(group.values.slice(0, 90).join(", "))}${group.truncated ? " ..." : ""} |`, 20) +
    "\n## ScriptableObject/DataSO Types\n\n" +
    "| Type | Field count | Useful fields |\n|---|---:|---|\n" +
    compactTableRows(
      managed.scriptable_object_types ?? [],
      (row) => `| ${mdEscape(row.display_name ?? row.name)} | ${row.field_count} | ${mdEscape(row.fields.slice(0, 16).join(", "))}${row.truncated ? " ..." : ""} |`,
      80
    ) +
    (gameplay.component_counts && Object.keys(gameplay.component_counts).length > 0
      ? "\n## Decoded Gameplay Components\n\n" +
        "These are compact prefab/component parameters decoded from Unity serialized data. They are useful for wiki mechanics coverage, but they are not a full balance table and do not prove exact unlock costs or per-character stats.\n\n" +
        "| Component | Instances |\n|---|---:|\n" +
        Object.entries(gameplay.component_counts)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([component, count]) => `| ${mdEscape(component)} | ${count} |`)
          .join("\n") +
        "\n\n### Chest Controllers\n\n" +
        "| Occurrences | Keys to open | Chest type | Examples |\n|---:|---:|---|---|\n" +
        compactTableRows(gameplay.chest_controllers ?? [], (row) => `| ${rawCell(row.occurrences)} | ${rawCell(row.key_count_to_open)} | ${mdEscape(rawCell(row.chest_type ?? row.chest_type_id))} | ${mdEscape(examplesCell(row))} |`, 24) +
        "\n### Collectible Heaps\n\n" +
        "| Occurrences | Type | Default count | Active range | Max radius | Examples |\n|---:|---|---:|---|---:|---|\n" +
        compactTableRows(
          gameplay.collectible_heaps ?? [],
          (row) =>
            `| ${rawCell(row.occurrences)} | ${mdEscape(rawCell(row.type ?? row.type_id))} | ${rawCell(row.default_count)} | ${rawCell(row.min_active_collectibles)}-${rawCell(row.max_active_collectibles)} | ${rawCell(row.max_radius)} | ${mdEscape(examplesCell(row))} |`,
          24
        ) +
        "\n### Collectible Challenges\n\n" +
        "| Occurrences | Target count | Completion delay | Examples |\n|---:|---:|---:|---|\n" +
        compactTableRows(
          gameplay.collectible_challenges ?? [],
          (row) => `| ${rawCell(row.occurrences)} | ${rawCell(row.target_activated_count)} | ${rawCell(row.on_complete_delay)} | ${mdEscape(examplesCell(row))} |`,
          24
        ) +
        "\n### Collectible Pits\n\n" +
        "| Occurrences | Raw type id | Examples |\n|---:|---|---|\n" +
        compactTableRows(
          gameplay.collectible_pits ?? [],
          (row) => `| ${rawCell(row.occurrences)} | ${mdEscape(rawCell(row.type_id))} | ${mdEscape(examplesCell(row))} |`,
          24
        ) +
        "\n### Quick Collectible Spawners\n\n" +
        "| Occurrences | Type | Count | Cooldown | Distance range | Examples |\n|---:|---|---:|---:|---|---|\n" +
        compactTableRows(
          gameplay.quick_collectible_spawners ?? [],
          (row) => `| ${rawCell(row.occurrences)} | ${mdEscape(rawCell(row.type ?? row.type_id))} | ${rawCell(row.count)} | ${rawCell(row.spawn_cooldown)} | ${mdEscape(rawCell(row.distance_range))} | ${mdEscape(examplesCell(row))} |`,
          24
        ) +
        "\n### Tree Spawn Point Roots\n\n" +
        "| Occurrences | Percent range | Count range | Examples |\n|---:|---|---|---|\n" +
        compactTableRows(
          gameplay.tree_spawn_point_roots ?? [],
          (row) => `| ${rawCell(row.occurrences)} | ${rawCell(row.min_percent)}-${rawCell(row.max_percent)} | ${rawCell(row.min_count)}-${rawCell(row.max_count)} | ${mdEscape(examplesCell(row))} |`,
          24
        ) +
        "\n### Heap Spawners\n\n" +
        "| Occurrences | Radius range | Count range | Y range | Enabled count | Examples |\n|---:|---|---|---|---:|---|\n" +
        compactTableRows(
          gameplay.heap_spawners ?? [],
          (row) => `| ${rawCell(row.occurrences)} | ${rawCell(row.min_radius)}-${rawCell(row.max_radius)} | ${mdEscape(rawCell(row.count_range))} | ${rawCell(row.min_y)}-${rawCell(row.max_y)} | ${rawCell(row.enabled_count)} | ${mdEscape(examplesCell(row))} |`,
          24
        ) +
        "\n### Spawn Slot Configs\n\n" +
        "| Occurrences | Component | Slot count | Chest priority | Slot type counts | Examples |\n|---:|---|---:|---:|---|---|\n" +
        compactTableRows(
          gameplay.spawn_slot_configs ?? [],
          (row) => `| ${rawCell(row.occurrences)} | ${mdEscape(rawCell(row.component))} | ${rawCell(row.slot_count)} | ${rawCell(row.chest_priority)} | ${mdEscape(rawCell(row.slot_type_counts))} | ${mdEscape(examplesCell(row))} |`,
          32
        )
      : "") +
    (serialized.collectible_lists && serialized.collectible_lists.length > 0
      ? "\n## Serialized Collectible Lists\n\n" +
        "| List | Items |\n|---|---|\n" +
        compactTableRows(
          serialized.collectible_lists,
          (list) => `| ${mdEscape(list.name)} | ${mdEscape(list.items.map(formatCollectibleItem).join(", "))} |`,
          40
        )
      : "") +
    ""
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
    frontmatter("Reference Ledger", "Public reference ledger for the FROGGY HATES SNOW wiki.") +
    "This is the public-reference audit trail for the wiki. It separates reference availability from gameplay certainty: a public achievement can verify a name without verifying the item's exact effect.\n\n" +
    `Entity status counts: ${Object.entries(statusCounts)
      .map(([status, count]) => `${status}: ${count}`)
      .join(", ")}.\n\n` +
    "## Reference Coverage\n\n" +
    "| Reference Label | Referenced Entities |\n|---|---:|\n" +
    topSources.map(([label, count]) => `| ${mdEscape(label)} | ${count} |`).join("\n") +
    "\n\n## Public References\n\n" +
    "| ID | Reference | Confidence | Notes |\n|---|---|---|---|\n" +
    publicSources
      .map((source) => `| ${inlineCode(source.id)} | [${mdEscape(source.label)}](${source.path_or_url}) | ${source.confidence} | ${truncateForTable(source.notes)} |`)
      .join("\n") +
    "\n"
  );
}

function steamSnapshotPage(snapshot: SteamSnapshot, extractedMetadata: ExtractedMetadataSnapshot) {
  const full = snapshot.apps.full_game;
  const highest = snapshot.achievements.highest_global_percentages;
  const lowest = snapshot.achievements.lowest_global_percentages;

  return (
    frontmatter("Steam Metadata Snapshot", "Current public Steam metadata snapshot for FROGGY HATES SNOW.") +
    (full.header_image ? `![FROGGY HATES SNOW Steam header](${full.header_image})\n\n` : "") +
    `Accessed: **${snapshot.accessed_date}**. Generated: ${snapshot.generated_at}.\n\n` +
    "This page is the main evidence checkpoint for game-populating wiki data. It uses official public Steam pages/APIs first, then marks anything not confirmed by those references as inferred or needing verification.\n\n" +
    "## Evidence Policy\n\n" +
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
    `The achievement evidence matrix maps each public achievement row to its Steam API id, percentage fields, reference ids, and any parsed loadout names.\n\n` +
    (snapshot.achievements.demo_global_percentages_api_error ? `Demo achievement endpoint note: ${snapshot.achievements.demo_global_percentages_api_error}.\n\n` : "") +
    "| Highest Public API Percentages | Percent |\n|---|---:|\n" +
    highest.map((row) => `| ${inlineCode(row.name)} | ${row.percent}% |`).join("\n") +
    "\n\n| Lowest Public API Percentages | Percent |\n|---|---:|\n" +
    lowest.map((row) => `| ${inlineCode(row.name)} | ${row.percent}% |`).join("\n") +
    "\n\n" +
    snapshot.achievements.notes.map((item) => `- ${mdEscape(item)}`).join("\n") +
    "\n\n## Public Gameplay Claims\n\n" +
    "| Claim | Reference IDs | Confidence | Wiki Targets | Notes |\n|---|---|---|---|---|\n" +
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
    frontmatter("Achievement Evidence Matrix", "Steam achievement fact matrix for FROGGY HATES SNOW wiki evidence.") +
    "This page keeps the official Steam achievement evidence in one place. Achievement wording can verify names and progression thresholds, but it does not by itself verify exact item type, effect, stats, unlock cost, or balance.\n\n" +
    `Rows: **${facts.length}** public Steam achievements. Rows with parsed loadout names: **${loadoutFacts.length}**.\n\n` +
    "## Milestone Series\n\n" +
    "These achievement series verify public progression thresholds. They do not verify exact unlock costs, reward values, or whether the threshold applies identically across every mode.\n\n" +
    "| Series | Achievement | Condition | API % | Community % | Reference IDs |\n|---|---|---|---:|---:|---|\n" +
    milestoneRows
      .map(
        ({ label, fact }) =>
          `| ${mdEscape(label)} | ${mdEscape(fact.title)} | ${mdEscape(fact.description)} | ${mdEscape(fact.steam_global_percent_api ?? "Missing")} | ${mdEscape(fact.steam_community_percent)} | ${fact.source_ids.map(inlineCode).join(", ")} |`
      )
      .join("\n") +
    "\n\n" +
    "## Loadout Names\n\n" +
    "Names in this table are safe wiki candidates because they appear in public Steam achievement conditions. Certainty describes only whether the parser can confidently classify the category from wording.\n\n" +
    "| Achievement | Mentioned Names | Reference IDs | Notes |\n|---|---|---|---|\n" +
    loadoutFacts
      .map((fact) => {
        const names = fact.mentioned_entities
          .map((entity) => `${entity.name} (${entity.category}, ${entity.certainty.replace(/_/g, " ")})`)
          .join(", ");
        return `| ${mdEscape(fact.title)} | ${mdEscape(names)} | ${fact.source_ids.map(inlineCode).join(", ")} | ${mdEscape(fact.notes)} |`;
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
        return `| ${mdEscape(fact.title)} | ${icon} | ${mdEscape(fact.description)} | ${fact.steam_internal_name ? inlineCode(fact.steam_internal_name) : "Missing"} | ${mdEscape(fact.steam_global_percent_api ?? "Missing")} | ${mdEscape(fact.steam_community_percent)} | ${mdEscape(entities)} |`;
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
    "This page keeps volatile store metadata separate from gameplay guidance. Refresh it with `npm run fetch:steam` before relying on prices, review counts, or achievement percentages.\n\n" +
    "## Steam Apps\n\n" +
    steamAppComparison(snapshot) +
    "## Reference Links\n\n" +
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
    `The demo app metadata links back to full app ${snapshot.apps.full_game.app_id}. The public evidence pass keeps demo facts separate because demo metadata and availability can drift independently from the released full game.\n`
  );
}

function useful(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^(needs verification|not applicable|none listed|not available|unknown)\.?$/i.test(text)) return "";
  return text.replace(/^Steam achievement condition:\s*/i, "").trim();
}

function isSourceOnlyDescription(text: string) {
  return (
    / is named in a public achievement condition\.?$/i.test(text) ||
    / is named in official Steam news or devlog copy\.?$/i.test(text) ||
    / is mentioned in official Steam copy or Steam devlogs/i.test(text) ||
    / is a public .* concept from Steam copy or achievements\.?$/i.test(text)
  );
}

function playerFact(entity: Entity) {
  const effect = useful(entity.effect);
  if (/unlocked from the beginning/i.test(effect)) return "Unlocked from the beginning.";
  if (/starts with this as a default skill/i.test(effect)) return effect;
  if (effect) return effect;

  const description = useful(entity.short_description);
  if (description && !isSourceOnlyDescription(description)) return description;

  return "";
}

function playerFactWithLocal(entity: Entity, dataset: string, local?: LocalGameData) {
  if (["skills", "tools", "companions"].includes(dataset)) {
    const skill = localSkillForEntity(local, entity);
    if (skill) return skill.description;
  }

  if (dataset === "items") {
    const resource = localResourceForEntity(local, entity);
    if (resource) return resource.name;
    const artifact = localArtifactForEntity(local, entity);
    if (artifact) return artifact.name;
  }

  if (dataset === "upgrades") {
    const stat = localStatForEntity(local, entity);
    if (stat) return stat.name;
  }

  if (dataset === "frogs") {
    const characters = local?.localization?.characters ?? [];
    const character = characters.find((row) => row.name.toLowerCase() === entity.name.toLowerCase() || row.id === entity.slug);
    if (character) return character.specialty;
    if (entity.slug === "playable-characters" && characters.length > 0) {
      return characters.map((row) => `${row.name} (${row.specialty})`).join(", ");
    }
  }

  if (dataset === "maps") {
    const locations = local?.localization?.locations ?? [];
    const location = locations.find((row) => row.name.toLowerCase() === entity.name.toLowerCase() || row.id === entity.slug);
    if (location) return location.name;
    if (entity.slug === "locations" && locations.length > 0) {
      return locations.map((row) => row.name).join(", ");
    }
  }

  return playerFact(entity);
}

function unlockFact(entity: Entity) {
  const unlock = useful(entity.unlock_method);
  if (unlock) return unlock;

  const effect = useful(entity.effect);
  if (/unlocked from the beginning/i.test(effect)) return "Unlocked from the beginning.";
  if (/starts with this as a default skill/i.test(effect)) return effect;

  return "";
}

function modeFact(entity: Entity) {
  return useful(entity.mode);
}

function sourceFact(entity: Entity) {
  const sourceLabels = entity.sources
    .filter((source) => source.type === "public_source")
    .map((source) => source.label.replace(/^Steam /, "Steam "))
    .slice(0, 2);
  const sourceText = sourceLabels.length > 0 ? sourceLabels.join("; ") : "Source listed in ledger";
  return `${entity.verification_status}: ${sourceText}`;
}

function playerNote(entity: Entity) {
  return entity.verification_status;
}

function relatedFact(entity: Entity) {
  return entity.related_entities.length > 0 ? entity.related_entities.join(", ") : "";
}

function achievementRarity(entity: Entity) {
  if (entity.steam_community_percent) return entity.steam_community_percent;
  if (entity.steam_global_percent_api) return `${entity.steam_global_percent_api}%`;
  return "";
}

function categoryIntro(dataset: string, rows: Entity[]) {
  return "";
}

function displayRowsForCategory(dataset: string, rows: Entity[], local?: LocalGameData) {
  const characters = local?.localization?.characters ?? [];
  const locations = local?.localization?.locations ?? [];
  return rows.filter((row) => {
    if (dataset === "frogs" && row.slug === "unnamed-frog-roster-slots" && characters.length >= 10) return false;
    if (dataset === "maps" && row.slug === "unnamed-location-roster-slots" && locations.length >= 16) return false;
    return true;
  });
}

function categoryTable(dataset: string, rows: Entity[], local?: LocalGameData) {
  const displayRows = displayRowsForCategory(dataset, rows, local);
  if (dataset === "achievements") {
    return wikiReferenceGrid(
      displayRows.map((row) => ({
        title: row.name,
        facts: [["Rarity", achievementRarity(row)]],
        sections: [
          { label: "How to earn", value: unlockFact(row) },
          { label: "Related names", value: relatedFact(row) }
        ]
      })),
      "wiki-reference-grid--achievements"
    );
  }

  if (dataset === "frogs") {
    return (
      "| Frog | Specialty | Unlock / availability | Status |\n|---|---|---|---|\n" +
      displayRows.map((row) => `| ${mdEscape(row.name)} | ${mdEscape(playerFactWithLocal(row, dataset, local))} | ${mdEscape(unlockFact(row))} | ${mdEscape(playerNote(row))} |`).join("\n") +
      "\n"
    );
  }

  if (dataset === "maps") {
    return (
      "| Location | Description | Unlock / progression | Status |\n|---|---|---|---|\n" +
      displayRows.map((row) => `| ${mdEscape(row.name)} | ${mdEscape(playerFactWithLocal(row, dataset, local))} | ${mdEscape(unlockFact(row))} | ${mdEscape(playerNote(row))} |`).join("\n") +
      "\n"
    );
  }

  if (["bosses", "enemies"].includes(dataset)) {
    return (
      "| Name | Description | Mode | Status |\n|---|---|---|---|\n" +
      displayRows.map((row) => `| ${mdEscape(row.name)} | ${mdEscape(playerFactWithLocal(row, dataset, local))} | ${mdEscape(modeFact(row))} | ${mdEscape(playerNote(row))} |`).join("\n") +
      "\n"
    );
  }

  if (dataset === "glossary") {
    return (
      "| Term | Description | Status |\n|---|---|---|\n" +
      displayRows.map((row) => `| ${mdEscape(row.name)} | ${mdEscape(useful(row.short_description) || playerFactWithLocal(row, dataset, local))} | ${mdEscape(playerNote(row))} |`).join("\n") +
      "\n"
    );
  }

  return (
    "| Name | Description | Unlock / availability | Status |\n|---|---|---|---|\n" +
    displayRows.map((row) => `| ${mdEscape(row.name)} | ${mdEscape(playerFactWithLocal(row, dataset, local))} | ${mdEscape(unlockFact(row))} | ${mdEscape(playerNote(row))} |`).join("\n") +
    "\n"
  );
}

function categoryIndex(dataset: string, rows: Entity[], extractedMetadata: ExtractedMetadataSnapshot) {
  const label = CATEGORY_LABELS[dataset] ?? dataset;
  const description = `${label} player lookup for FROGGY HATES SNOW.`;

  return (
    frontmatter(label, description) +
    categoryTable(dataset, rows, extractedMetadata.local_game_data)
  );
}

function extractedModel(extracted: ExtractedMetadataSnapshot) {
  const local = extracted.local_game_data;
  const stripped = strippedData(extracted);
  const localization = local?.localization ?? {};
  const characters = asArray(stripped.characters).filter((row) => row.debug_or_test_asset !== true);
  const locations = asArray(stripped.locations);
  const artifacts = asArray(stripped.artifacts);
  const upgrades = asArray(stripped.upgrade_assets).filter(isPlayerFacingAsset);
  const statusEffects = asArray(stripped.status_effect_upgrades);
  const enemyComponents = asArray(stripped.enemy_component_payloads).filter(isPlayerFacingAsset);
  const enemyWaves = asArray(stripped.enemy_wave_data);
  const enemyArenaSpawners = asArray(stripped.enemy_arena_spawner_data);
  const levelObjectSpawners = asArray(stripped.level_object_spawner_data);
  const levelObjectPresets = asArray(stripped.level_object_preset_data);
  const questTemplates = asArray(stripped.quest_templates);
  const achievementConditions = asArray(stripped.achievement_conditions);
  const gameModes = asArray(stripped.game_modes);
  const difficultyLevels = asArray(stripped.difficulty_levels);
  const rarityTables = asArray(stripped.rarity_tables);
  const terrainHeightData = asArray(stripped.terrain_height_data);
  const terrainTextureData = asArray(stripped.terrain_texture_data);
  const allSkills = (localization.skills ?? []).map((skill) => skill as Record<string, unknown>);
  const skills = allSkills.filter((skill) => !isStatusEffectVariantSkill(skill, statusEffects));

  const upgradeSlugByPath = new Map<number, string>();
  const upgradeSlugByName = new Map<string, string>();
  for (const upgrade of upgrades) {
    const label = extractedLabel(upgrade);
    const slug = slugify(label);
    if (typeof upgrade.object_path_id === "number") upgradeSlugByPath.set(upgrade.object_path_id, slug);
    for (const key of [upgrade.feature_name, upgrade.name, upgrade.feature, upgrade.class]) {
      if (key) upgradeSlugByName.set(String(key).toLowerCase(), slug);
    }
  }

  const skillSlugByName = new Map<string, string>();
  const skillBySlug = new Map<string, Record<string, unknown>>();
  for (const skill of skills) {
    const slug = slugify(skill.name);
    skillBySlug.set(slug, skill);
    for (const key of [skill.name, skill.id, ...(Array.isArray(skill.source_keys) ? skill.source_keys : [])]) {
      if (key) skillSlugByName.set(String(key).toLowerCase(), slug);
    }
  }

  const statusEffectsBySkillSlug = new Map<string, Record<string, unknown>[]>();
  const baseStatusEffectsBySkillSlug = new Map<string, Record<string, unknown>[]>();
  for (const effect of statusEffects) {
    const skillSlug = statusEffectSkillSlug(effect, skillSlugByName);
    if (skillSlug) {
      const rows = statusEffectsBySkillSlug.get(skillSlug) ?? [];
      rows.push(effect);
      statusEffectsBySkillSlug.set(skillSlug, rows);
    }
    const baseSkillSlug = statusEffectBaseSkillSlug(effect, skillSlugByName);
    if (baseSkillSlug) {
      const rows = baseStatusEffectsBySkillSlug.get(baseSkillSlug) ?? [];
      rows.push(effect);
      baseStatusEffectsBySkillSlug.set(baseSkillSlug, rows);
    }
  }

  const waveSlugByPath = new Map<number, string>();
  const waveBySlug = new Map<string, Record<string, unknown>>();
  for (const wave of enemyWaves) {
    const slug = slugify(wave.name);
    if (typeof wave.object_path_id === "number") waveSlugByPath.set(wave.object_path_id, slug);
    waveBySlug.set(slug, wave);
  }

  const spawnerSlugByPath = new Map<number, string>();
  const spawnerBySlug = new Map<string, Record<string, unknown>>();
  for (const spawner of levelObjectSpawners) {
    const slug = slugify(spawner.name);
    if (typeof spawner.object_path_id === "number") spawnerSlugByPath.set(spawner.object_path_id, slug);
    spawnerBySlug.set(slug, spawner);
  }

  const enemySlugByKey = new Map<string, string>();
  for (const enemy of enemyComponents.filter((row) => row.class === "EnemyUpgradeModule" && asArray(row.value_ranges).length > 0)) {
    enemySlugByKey.set(lookupKey(enemy.name), slugify(enemy.name));
  }

  const locationLinksByWaveSlug = new Map<string, string[]>();
  const locationLinksBySpawnerSlug = new Map<string, string[]>();
  const rewardLocationsByUpgradeSlug = new Map<string, string[]>();
  for (const location of locations) {
    const locationSlug = slugify(location.name);
    const locationLink = pageLink(location.name, `/generated/maps/${locationSlug}/`);
    const generation = asRecord(location.level_generation);
    const waveSlug = typeof generation.enemy_spawner_path_id === "number" ? waveSlugByPath.get(generation.enemy_spawner_path_id) : undefined;
    if (waveSlug) {
      const rows = locationLinksByWaveSlug.get(waveSlug) ?? [];
      rows.push(locationLink);
      locationLinksByWaveSlug.set(waveSlug, rows);
    }
    for (const pathId of [generation.main_level_object_spawner_path_id, generation.secondary_level_object_spawner_path_id]) {
      const spawnerSlug = typeof pathId === "number" ? spawnerSlugByPath.get(pathId) : undefined;
      if (!spawnerSlug) continue;
      const rows = locationLinksBySpawnerSlug.get(spawnerSlug) ?? [];
      rows.push(locationLink);
      locationLinksBySpawnerSlug.set(spawnerSlug, rows);
    }
    const reward = asRecord(location.location_reward);
    const rewardSlug = upgradeSlugByName.get(String(reward.completion_reward_name ?? "").toLowerCase());
    if (rewardSlug) {
      const rows = rewardLocationsByUpgradeSlug.get(rewardSlug) ?? [];
      rows.push(locationLink);
      rewardLocationsByUpgradeSlug.set(rewardSlug, rows);
    }
  }

  const wavesByEnemyKey = new Map<string, string[]>();
  const locationsByEnemyKey = new Map<string, string[]>();
  for (const wave of enemyWaves) {
    const waveSlug = slugify(wave.name);
    const waveLink = pageLink(wave.name, `/generated/waves/${waveSlug}/`);
    const locationLinks = locationLinksByWaveSlug.get(waveSlug) ?? [];
    for (const arena of asArray(wave.arenas)) {
      for (const waveRow of asArray(arena.waves)) {
        for (const spawn of asArray(waveRow.spawns)) {
          const key = lookupKey(spawn.enemy);
          if (!key) continue;
          const waveRows = wavesByEnemyKey.get(key) ?? [];
          waveRows.push(waveLink);
          wavesByEnemyKey.set(key, waveRows);
          const mapRows = locationsByEnemyKey.get(key) ?? [];
          mapRows.push(...locationLinks);
          locationsByEnemyKey.set(key, mapRows);
        }
      }
    }
  }

  const characterByUpgradeSlug = new Map<string, string[]>();
  const characterBySkillSlug = new Map<string, string[]>();
  for (const character of characters) {
    const characterSlug = slugify(character.name);
    for (const skill of asArray(character.skill_progression)) {
      const pathId = typeof skill.feature_path_id === "number" ? skill.feature_path_id : undefined;
      const slug = pathId ? upgradeSlugByPath.get(pathId) : undefined;
      if (skill.empty_slot === true) continue;
      const characterLink = pageLink(character.name, `/generated/frogs/${characterSlug}/`);
      if (slug) {
        const links = characterByUpgradeSlug.get(slug) ?? [];
        links.push(characterLink);
        characterByUpgradeSlug.set(slug, links);
      }
      const skillSlug = skillSlugByName.get(String(skill.resolved_upgrade_name ?? skill.label ?? skill.asset ?? "").toLowerCase());
      if (skillSlug) {
        const links = characterBySkillSlug.get(skillSlug) ?? [];
        links.push(characterLink);
        characterBySkillSlug.set(skillSlug, links);
      }
    }
  }

  return {
    local,
    stripped,
    characters,
    locations,
    artifacts,
    upgrades,
    statusEffects,
    enemyComponents,
    enemyWaves,
    enemyArenaSpawners,
    levelObjectSpawners,
    levelObjectPresets,
    questTemplates,
    achievementConditions,
    gameModes,
    difficultyLevels,
    rarityTables,
    terrainHeightData,
    terrainTextureData,
    allSkills,
    skills,
    upgradeSlugByPath,
    upgradeSlugByName,
    skillSlugByName,
    skillBySlug,
    statusEffectsBySkillSlug,
    baseStatusEffectsBySkillSlug,
    waveSlugByPath,
    waveBySlug,
    spawnerSlugByPath,
    spawnerBySlug,
    enemySlugByKey,
    locationLinksByWaveSlug,
    locationLinksBySpawnerSlug,
    rewardLocationsByUpgradeSlug,
    wavesByEnemyKey,
    locationsByEnemyKey,
    characterByUpgradeSlug,
    characterBySkillSlug
  };
}

function characterPage(character: Record<string, unknown>, model: ReturnType<typeof extractedModel>) {
  const slug = slugify(character.name);
  const skills = asArray(character.skill_progression).filter((row) => row.empty_slot !== true);
  const statRows = asArray(character.character_stats);
  const questRows = asArray(character.character_quests);
  const startingSkills = skills.filter((row) => Number(row.unlock_step ?? 0) === 0);
  const laterSkills = skills.filter((row) => Number(row.unlock_step ?? 0) > 0);
  const skillRelations: string[] = [];
  const skillLink = (row: Record<string, unknown>) => {
    const upgradeSlug = typeof row.feature_path_id === "number" ? model.upgradeSlugByPath.get(row.feature_path_id) : undefined;
    const label = row.resolved_upgrade_name ?? row.label ?? row.asset;
    const skillSlug = model.skillSlugByName.get(String(label ?? "").toLowerCase());
    if (skillSlug) return pageLink(label, `/generated/skills/${skillSlug}/`);
    if (upgradeSlug) return pageLink(label, `/generated/upgrades/${upgradeSlug}/`);
    return mdEscape(label);
  };
  const unlockText = Number(character.unlock_cost ?? 0) === 0 ? "Unlocked from the start." : `Unlock cost: ${displayText(character.unlock_cost)}.`;
  return (
    frontmatter(String(character.name ?? "Character"), `${character.name} character reference for FROGGY HATES SNOW.`) +
    extractedSourceNote() +
    wikiInfoBox(character.name, [
      { label: "Specialty", value: character.specialty },
      { label: "Unlock cost", value: character.unlock_cost },
      { label: "XP thresholds", value: progressionValues(character.level_upgrade_experience) },
      { label: "Starting skills", value: startingSkills.length }
    ]) +
    `${displayText(character.name)} is one of the playable frogs in FROGGY HATES SNOW. ${unlockText} ${displayText(character.specialty) ? `${displayText(character.name)}'s listed specialty is ${displayText(character.specialty)}.` : ""}\n\n` +
    "## Starting Loadout\n\n" +
    (startingSkills.length > 0
      ? "### Starting Skills\n\n" +
        wikiReferenceGrid(
          startingSkills.map((row) => {
            const label = row.resolved_upgrade_name ?? row.label ?? row.asset;
            const upgradeSlug = typeof row.feature_path_id === "number" ? model.upgradeSlugByPath.get(row.feature_path_id) : undefined;
            const skillSlug = model.skillSlugByName.get(String(label ?? "").toLowerCase());
            if (skillSlug) skillRelations.push(pageLink(label, `/generated/skills/${skillSlug}/`));
            if (upgradeSlug) skillRelations.push(pageLink(label, `/generated/upgrades/${upgradeSlug}/`));
            return {
              title: label,
              href: skillSlug ? `/generated/skills/${skillSlug}/` : upgradeSlug ? `/generated/upgrades/${upgradeSlug}/` : undefined,
              facts: [["Rarity", row.rarity ?? ""]]
            };
          }),
          "wiki-reference-table--starting-loadout"
        )
      : "No starting skills listed.\n\n") +
    "## Unlocks\n\n" +
    `${unlockText}\n\n` +
    (laterSkills.length > 0
      ? wikiDataTable(
          ["Unlock Step", "Rewards"],
          [...new Set(laterSkills.map((row) => Number(row.unlock_step ?? 0)))]
            .sort((a, b) => a - b)
            .map((step) => [
              htmlText(step),
              wikiChipListHtml(laterSkills.filter((row) => Number(row.unlock_step ?? 0) === step).map(skillLink))
            ]),
          "wiki-data-table--unlocks"
        )
      : "") +
    "## Stat Bonuses\n\n" +
    (statRows.length > 0
      ? wikiReferenceGrid(
          statRows.map((row) => ({
            title: row.display_label ?? row.stat,
            facts: [["Value", row.display_delta ?? row.value]]
          })),
          "wiki-reference-grid--values"
        )
      : "") +
    (questRows.length > 0
      ? "## Requirements\n\n" +
        wikiReferenceGrid(
          questRows.map((row) => ({
            title: row.condition ?? cleanQuestText(row.text),
            facts: [["Quest ID", row.quest_id]]
          })),
          "wiki-reference-grid--requirements"
        )
      : "") +
    "## Skill Progression\n\n" +
    wikiReferenceGrid(
      skills.map((row) => {
        const upgradeSlug = typeof row.feature_path_id === "number" ? model.upgradeSlugByPath.get(row.feature_path_id) : undefined;
        const label = row.resolved_upgrade_name ?? row.label ?? row.asset;
        const skillSlug = model.skillSlugByName.get(String(label ?? "").toLowerCase());
        if (skillSlug) skillRelations.push(pageLink(label, `/generated/skills/${skillSlug}/`));
        if (upgradeSlug) skillRelations.push(pageLink(label, `/generated/upgrades/${upgradeSlug}/`));
        return {
          title: label,
          href: skillSlug ? `/generated/skills/${skillSlug}/` : upgradeSlug ? `/generated/upgrades/${upgradeSlug}/` : undefined,
          facts: [
            ["Group", row.group],
            ["Unlock step", row.unlock_step],
            ["Rarity", row.rarity ?? ""]
          ],
          sections: [
            {
              label: "Links",
              html: wikiChipListHtml([
                skillSlug ? pageLink(label, `/generated/skills/${skillSlug}/`) : "",
                upgradeSlug ? pageLink(label, `/generated/upgrades/${upgradeSlug}/`) : ""
              ])
            }
          ]
        };
      }),
      "wiki-reference-grid--progression"
    ) +
    "## Notes\n\n" +
    `Canonical slug: ${inlineCode(slug)}.\n\n` +
    "## Related\n\n" +
    relationList([
      pageLink("All frogs", "/generated/frogs/"),
      ...skillRelations.slice(0, 20)
    ])
  );
}

function frogsIndex(model: ReturnType<typeof extractedModel>, snapshot: SteamSnapshot) {
  return (
    frontmatter("Frogs", "Playable frog roster and character progression for FROGGY HATES SNOW.") +
    extractedSourceNote() +
    steamScreenshotStrip(snapshot, 0, 3) +
    "There are 10 playable frog rows in the local data. Each frog page follows the same character layout: overview, starting loadout, unlocks, stats, and skill progression.\n\n" +
    wikiDataTable(
      ["Frog", "Specialty", "Unlock cost", "Starting skills"],
      model.characters.map((character) => [
        htmlLink(character.name, `/generated/frogs/${slugify(character.name)}/`),
        htmlText(character.specialty),
        htmlText(character.unlock_cost),
        htmlText(asArray(character.skill_progression).filter((row) => row.empty_slot !== true && Number(row.unlock_step ?? 0) === 0).length)
      ]),
      "wiki-reference-table--frogs"
    )
  );
}

function locationPage(location: Record<string, unknown>, model: ReturnType<typeof extractedModel>) {
  const generation = asRecord(location.level_generation);
  const settings = asRecord(location.game_settings);
  const reward = asRecord(location.location_reward);
  const rewardSlug = model.upgradeSlugByName.get(String(reward.completion_reward_name ?? "").toLowerCase());
  const waveSlug = typeof generation.enemy_spawner_path_id === "number" ? model.waveSlugByPath.get(generation.enemy_spawner_path_id) : undefined;
  const mainSpawnerSlug = typeof generation.main_level_object_spawner_path_id === "number" ? model.spawnerSlugByPath.get(generation.main_level_object_spawner_path_id) : undefined;
  const secondarySpawnerSlug = typeof generation.secondary_level_object_spawner_path_id === "number" ? model.spawnerSlugByPath.get(generation.secondary_level_object_spawner_path_id) : undefined;
  const wave = waveSlug ? model.waveBySlug.get(waveSlug) : undefined;
  const spawnerLinks = [
    mainSpawnerSlug ? pageLink(generation.main_level_object_spawner_name, `/generated/spawners/${mainSpawnerSlug}/`) : generation.main_level_object_spawner_name ? spawnerLabel(generation.main_level_object_spawner_name, generation.main_level_object_spawner_class) : "",
    secondarySpawnerSlug ? pageLink(generation.secondary_level_object_spawner_name, `/generated/spawners/${secondarySpawnerSlug}/`) : generation.secondary_level_object_spawner_name ? spawnerLabel(generation.secondary_level_object_spawner_name, generation.secondary_level_object_spawner_class) : ""
  ];
  const startResources = asArray(settings.start_resources);
  return (
    frontmatter(String(location.name ?? "Location"), `${location.name} location reference for FROGGY HATES SNOW.`) +
    extractedSourceNote() +
    wikiSummaryTable([
      { label: "Unlock cost", value: location.unlock_cost },
      { label: "Enemy wave data", value: generation.enemy_spawner_name ?? "", href: waveSlug ? `/generated/waves/${waveSlug}/` : undefined },
      { label: "Terrain", value: generation.height_data_name ? `${generation.height_data_name} / ${generation.texture_data_name ?? ""}` : "" },
      { label: "Completion reward", value: reward.completion_reward_name ?? "", href: rewardSlug ? `/generated/upgrades/${rewardSlug}/` : undefined }
    ]) +
    "## Objectives\n\n" +
    wikiReferenceGrid(
      asArray(location.parsed_quests).map((quest) => ({
        title: `Logic ${displayText(quest.logic_id)}`,
        description: cleanQuestText(quest.text),
        facts: [["Target", quest.target_value]]
      })),
      "wiki-reference-grid--objectives"
    ) +
    "\n\n## Run Settings\n\n" +
    wikiSummaryTable([
      ["Start resources", startResources.map((row) => `${row.label} (${row.count})`).join(", ")],
      ["Upgrade choices after arena", settings.upgrade_card_spawn_count_on_arena_end ?? ""],
      ["Enemy upgrade level", progressionValues(settings.enemy_upgrade_level_params)],
      ["Arena spawn time", progressionValues(settings.arena_spawn_time_params)],
      ["Tree scale", asRecord(location.location_reward).tree_scale ?? ""],
      ["Enabled tree percent", asRecord(location.location_reward).enabled_tree_percent ?? ""]
    ].map(([label, value]) => ({ label: String(label), value }))) +
    "\n\n## Spawners\n\n" +
    relationList([
      ...spawnerLinks,
      waveSlug ? pageLink(generation.enemy_spawner_name, `/generated/waves/${waveSlug}/`) : generation.enemy_spawner_name ? spawnerLabel(generation.enemy_spawner_name, generation.enemy_spawner_class) : ""
    ]) +
    (wave
      ? "## Enemy Wave Summary\n\n" +
        wikiSummaryTable([
          { label: "Wave table", value: wave.name, href: waveSlug ? `/generated/waves/${waveSlug}/` : undefined },
          { label: "Arenas", value: wave.arena_count ?? asArray(wave.arenas).length },
          { label: "Waves", value: wave.wave_count }
        ])
      : "") +
    "## Related\n\n" +
    relationList([pageLink("All locations", "/generated/maps/"), rewardSlug ? pageLink(reward.completion_reward_name, `/generated/upgrades/${rewardSlug}/`) : ""])
  );
}

function mapsIndex(model: ReturnType<typeof extractedModel>, snapshot: SteamSnapshot) {
  return (
    frontmatter("Maps", "Location objectives, generation data, and rewards for FROGGY HATES SNOW.") +
    extractedSourceNote() +
    steamScreenshotStrip(snapshot, 3, 3) +
    wikiReferenceGrid(
      model.locations.map((location) => {
        const generation = asRecord(location.level_generation);
        const reward = asRecord(location.location_reward);
        const rewardSlug = model.upgradeSlugByName.get(String(reward.completion_reward_name ?? "").toLowerCase());
        const waveSlug = typeof generation.enemy_spawner_path_id === "number" ? model.waveSlugByPath.get(generation.enemy_spawner_path_id) : undefined;
        const objectives = asArray(location.parsed_quests)
          .slice(0, 3)
          .map((quest) => cleanQuestText(quest.text));
        return {
          title: location.name,
          href: `/generated/maps/${slugify(location.name)}/`,
          facts: [
            ["Unlock cost", location.unlock_cost],
            ["Enemy wave", waveSlug ? generation.enemy_spawner_name : ""],
            ["Reward", reward.completion_reward_name ?? ""]
          ],
          sections: [
            { label: "Objectives", html: wikiTextList(objectives) },
            {
              label: "Links",
              html: wikiChipListHtml([
                waveSlug ? pageLink(generation.enemy_spawner_name, `/generated/waves/${waveSlug}/`) : "",
                rewardSlug ? pageLink(reward.completion_reward_name, `/generated/upgrades/${rewardSlug}/`) : ""
              ])
            }
          ]
        };
      }),
      "wiki-reference-grid--maps"
    )
  );
}

function artifactPage(artifact: Record<string, unknown>) {
  return (
    frontmatter(String(artifact.name ?? "Artifact"), `${artifact.name} artifact reference for FROGGY HATES SNOW.`) +
    extractedSourceNote() +
    wikiSummaryTable([
      { label: "Rarity", value: artifact.rarity ?? artifact.rarity_id },
      { label: "Weight", value: artifact.weight },
      { label: "Levels", value: artifact.level_count }
    ]) +
    "## Stats\n\n" +
    wikiReferenceGrid(
      asArray(artifact.upgradable_stats).map((stat) => ({
        title: stat.stat ?? stat.stat_id,
        description: asRecord(stat.visuals).text ?? "",
        sections: [
          {
            label: "Level values",
            html: wikiTextList(asArray(stat.parameter_values).map((value) => `${value.title ?? "Value"} ${progressionValues(asRecord(value).progression_value)}`))
          }
        ]
      })),
      "wiki-reference-grid--values"
    )
  );
}

function itemsIndex(model: ReturnType<typeof extractedModel>, snapshot: SteamSnapshot) {
  return (
    frontmatter("Items", "Artifacts, resources, and rarity data for FROGGY HATES SNOW.") +
    extractedSourceNote() +
    steamScreenshotStrip(snapshot, 6, 3) +
    "## Artifacts\n\n" +
    wikiReferenceGrid(
      model.artifacts.map((artifact) => ({
        title: artifact.name,
        href: `/generated/items/${slugify(artifact.name)}/`,
        facts: [
          ["Rarity", artifact.rarity],
          ["Weight", artifact.weight]
        ],
        sections: [{ label: "Stats", html: wikiTextList(asArray(artifact.upgradable_stats).map((stat) => stat.stat ?? stat.stat_id)) }]
      })),
      "wiki-reference-grid--items"
    ) +
    "\n\n## Resources\n\n" +
    wikiReferenceGrid(
      (model.local?.localization?.resources ?? []).map((row) => ({
        title: row.name,
        facts: [["ID", row.id]]
      })),
      "wiki-reference-grid--items"
    ) +
    "\n\n## Rarities\n\n" +
    wikiReferenceGrid(
      (model.local?.localization?.rarities ?? []).map((row) => ({
        title: row.name,
        facts: [["ID", row.id]]
      })),
      "wiki-reference-grid--items"
    ) +
    "\n\n## Upgrade Rarity Tables\n\n" +
    wikiReferenceGrid(
      model.rarityTables.map((row) => ({
        title: row.rarity ?? row.name,
        facts: [
          ["Chance", `${displayText(row.upgrade_chance_percent)}%`],
          ["Upgrade count rule", row.use_exact_count ? row.actual_upgrade_count : `${displayText(row.upgrade_count_percent)}%`]
        ]
      })),
      "wiki-reference-grid--items"
    )
  );
}

function upgradePage(upgrade: Record<string, unknown>, model: ReturnType<typeof extractedModel>) {
  const slug = slugify(upgrade.feature_name ?? upgrade.name ?? upgrade.class);
  const relatedCharacters = model.characterByUpgradeSlug.get(slug) ?? [];
  const skillSlug = model.skillSlugByName.get(String(upgrade.feature_name ?? upgrade.name ?? "").toLowerCase());
  const matchingStatusEffects = skillSlug ? [...(model.baseStatusEffectsBySkillSlug.get(skillSlug) ?? []), ...(model.statusEffectsBySkillSlug.get(skillSlug) ?? [])] : [];
  const rewardLocations = model.rewardLocationsByUpgradeSlug.get(slug) ?? [];
  return (
    frontmatter(String(upgrade.feature_name ?? upgrade.name ?? upgrade.class ?? "Upgrade"), `${upgrade.feature_name ?? upgrade.name} upgrade reference for FROGGY HATES SNOW.`) +
    extractedSourceNote() +
    wikiSummaryTable([
      { label: "Feature", value: upgrade.feature ?? upgrade.feature_id },
      { label: "Rarity", value: upgrade.rarity ?? upgrade.rarity_id }
    ]) +
    (upgrade.feature_description ? `${mdEscape(upgrade.feature_description)}\n\n` : "") +
    (asArray(upgrade.value_ranges).length > 0 ? "## Values\n\n" + valueRangeTableHtml(asArray(upgrade.value_ranges)) : "") +
    (asArray(upgrade.unlock_conditions).length > 0
      ? "## Unlocks\n\n" +
        asArray(upgrade.unlock_conditions).map((row) => `- ${mdEscape(row.condition)}${row.quest_id !== undefined ? ` (${inlineCode(`quest ${row.quest_id}`)})` : ""}`).join("\n") +
        "\n\n"
      : "") +
    (relatedCharacters.length > 0 ? "## Related Characters\n\n" + relationList(relatedCharacters) : "") +
    (rewardLocations.length > 0 ? "## Reward Locations\n\n" + relationList(rewardLocations) : "") +
    (matchingStatusEffects.length > 0
      ? "## Status Effects\n\n" +
        wikiReferenceGrid(
          matchingStatusEffects.map((row) => ({
            title: row.feature_name ?? row.name,
            href: `/generated/status-effects/${slugify(row.feature_name ?? row.name)}/`,
            description: row.feature_description ?? "",
            facts: [["Type", row.damageable_effect_type ?? row.damageable_effect_type_id]]
          })),
          "wiki-reference-grid--status-effects"
        )
      : "")
  );
}

function upgradesIndex(model: ReturnType<typeof extractedModel>, snapshot: SteamSnapshot) {
  return (
    frontmatter("Upgrades", "Upgrade values, unlocks, and character relationships for FROGGY HATES SNOW.") +
    extractedSourceNote() +
    steamScreenshotStrip(snapshot, 8, 3) +
    wikiReferenceGrid(
      model.upgrades.map((upgrade) => {
        const slug = slugify(upgrade.feature_name ?? upgrade.name ?? upgrade.class);
        return {
          title: upgrade.feature_name ?? upgrade.name ?? upgrade.class,
          href: `/generated/upgrades/${slug}/`,
          description: upgrade.feature_description,
          facts: [["Rarity", upgrade.rarity ?? ""]],
          sections: [
            { label: "Values", html: wikiTextList(asArray(upgrade.value_ranges).slice(0, 3).map((row) => `${row.label}: ${valueRangeBrief(row)}`)) },
            { label: "Used by", html: wikiChipListHtml((model.characterByUpgradeSlug.get(slug) ?? []).slice(0, 6)) }
          ]
        };
      }),
      "wiki-reference-grid--upgrades"
    )
  );
}

function statusEffectLinksForSkill(skillSlug: string, model: ReturnType<typeof extractedModel>) {
  const effects = [...(model.baseStatusEffectsBySkillSlug.get(skillSlug) ?? []), ...(model.statusEffectsBySkillSlug.get(skillSlug) ?? [])];
  const unique = new Map<string, Record<string, unknown>>();
  for (const effect of effects) unique.set(slugify(effect.feature_name ?? effect.name), effect);
  return [...unique.values()]
    .map((effect) => pageLink(effect.feature_name ?? effect.name, `/generated/status-effects/${slugify(effect.feature_name ?? effect.name)}/`))
    .join(", ");
}

function skillsIndex(model: ReturnType<typeof extractedModel>, snapshot: SteamSnapshot) {
  return (
    frontmatter("Skills", "Core skill, tool, and attack reference for FROGGY HATES SNOW.") +
    extractedSourceNote() +
    steamScreenshotStrip(snapshot, 10, 3) +
    wikiReferenceGrid(
      model.skills.map((skill) => {
        const skillSlug = slugify(skill.name);
        return {
          title: skill.name,
          href: `/generated/skills/${skillSlug}/`,
          description: skill.description,
          sections: [{ label: "Status effects", html: wikiChipListHtml(statusEffectLinksForSkill(skillSlug, model).split(", ").filter(Boolean)) }]
        };
      }),
      "wiki-reference-grid--skills"
    )
  );
}

function matchedSkillRows(model: ReturnType<typeof extractedModel>, rows: Entity[]) {
  const wanted = new Set(rows.flatMap((row) => [row.name.toLowerCase(), row.slug, ...row.aliases.map((alias) => alias.toLowerCase())]));
  return model.skills.filter((skill) => wanted.has(String(skill.name ?? "").toLowerCase()) || wanted.has(String(skill.id ?? "")));
}

function extractedSkillCategoryIndex(title: string, description: string, model: ReturnType<typeof extractedModel>, rows: Entity[]) {
  const skills = matchedSkillRows(model, rows);
  return (
    frontmatter(title, description) +
    extractedSourceNote() +
    wikiReferenceGrid(
      skills.map((skill) => {
        const skillSlug = slugify(skill.name);
        return {
          title: skill.name,
          href: `/generated/skills/${skillSlug}/`,
          description: skill.description
        };
      }),
      "wiki-reference-grid--skills"
    )
  );
}

function skillPage(skill: Record<string, unknown>, model: ReturnType<typeof extractedModel>) {
  const upgradeSlug = model.upgradeSlugByName.get(String(skill.name ?? "").toLowerCase());
  const upgrade = upgradeSlug ? model.upgrades.find((row) => slugify(row.feature_name ?? row.name ?? row.class) === upgradeSlug) : undefined;
  const skillSlug = slugify(skill.name);
  const statusEffects = [...(model.baseStatusEffectsBySkillSlug.get(skillSlug) ?? []), ...(model.statusEffectsBySkillSlug.get(skillSlug) ?? [])];
  const relatedCharacters = model.characterBySkillSlug.get(skillSlug) ?? [];
  return (
    frontmatter(String(skill.name ?? "Skill"), `${skill.name} skill reference for FROGGY HATES SNOW.`) +
    extractedSourceNote() +
    wikiSummaryTable([
      { label: "Related upgrade", value: upgrade?.feature_name ?? upgrade?.name, href: upgradeSlug ? `/generated/upgrades/${upgradeSlug}/` : undefined }
    ]) +
    `${mdEscape(skill.description)}\n\n` +
    (upgrade && asArray(upgrade.value_ranges).length > 0 ? "## Values\n\n" + valueRangeTableHtml(asArray(upgrade.value_ranges)) : "") +
    (statusEffects.length > 0
      ? "\n## Status Effects\n\n" +
        wikiReferenceGrid(
          statusEffects.map((row) => ({
            title: row.feature_name ?? row.name,
            href: `/generated/status-effects/${slugify(row.feature_name ?? row.name)}/`,
            description: row.feature_description ?? "",
            facts: [["Type", row.damageable_effect_type ?? row.damageable_effect_type_id]]
          })),
          "wiki-reference-grid--status-effects"
        )
      : "") +
    "\n## Related\n\n" +
    relationList([
      pageLink("All skills", "/generated/skills/"),
      upgradeSlug ? pageLink(upgrade?.feature_name ?? upgrade?.name ?? "Upgrade", `/generated/upgrades/${upgradeSlug}/`) : "",
      ...relatedCharacters
    ])
  );
}

function statusEffectsIndex(model: ReturnType<typeof extractedModel>) {
  return (
    frontmatter("Status Effects", "Elemental and crowd-control status-effect upgrades for FROGGY HATES SNOW.") +
    extractedSourceNote() +
    wikiReferenceGrid(
      model.statusEffects.map((effect) => {
        const skillSlug = statusEffectBaseSkillSlug(effect, model.skillSlugByName);
        const skill = skillSlug ? model.skillBySlug.get(skillSlug) : undefined;
        return {
          title: effect.feature_name ?? effect.name,
          href: `/generated/status-effects/${slugify(effect.feature_name ?? effect.name)}/`,
          description: effect.feature_description,
          facts: [["Type", effect.damageable_effect_type ?? effect.damageable_effect_type_id]],
          sections: [{ label: "Base skill", html: skillSlug ? wikiChipListHtml([pageLink(skill?.name ?? effect.feature ?? "Base skill", `/generated/skills/${skillSlug}/`)]) : "" }]
        };
      }),
      "wiki-reference-grid--status-effects"
    )
  );
}

function statusEffectPage(effect: Record<string, unknown>, model: ReturnType<typeof extractedModel>) {
  const skillSlug = statusEffectBaseSkillSlug(effect, model.skillSlugByName);
  const skill = skillSlug ? model.skillBySlug.get(skillSlug) : undefined;
  return (
    frontmatter(String(effect.feature_name ?? effect.name ?? "Status Effect"), `${effect.feature_name ?? effect.name} status-effect reference for FROGGY HATES SNOW.`) +
    extractedSourceNote() +
    wikiSummaryTable([
      { label: "Type", value: effect.damageable_effect_type ?? effect.damageable_effect_type_id },
      { label: "Rarity", value: effect.rarity ?? effect.rarity_id },
      { label: "Base skill", value: skill?.name ?? "", href: skillSlug ? `/generated/skills/${skillSlug}/` : undefined }
    ]) +
    `${mdEscape(effect.feature_description ?? "")}\n\n` +
    "## Related\n\n" +
    relationList([pageLink("All status effects", "/generated/status-effects/"), skillSlug ? pageLink(skill?.name ?? "Base skill", `/generated/skills/${skillSlug}/`) : ""])
  );
}

function enemySpawnLink(enemy: unknown, model: ReturnType<typeof extractedModel>) {
  const enemySlug = model.enemySlugByKey.get(lookupKey(enemy));
  return enemySlug ? pageLink(enemy, `/generated/enemies/${enemySlug}/`) : mdEscape(enemy);
}

function enemySpawnHtmlLink(enemy: unknown, model: ReturnType<typeof extractedModel>) {
  const enemySlug = model.enemySlugByKey.get(lookupKey(enemy));
  return enemySlug ? htmlLink(enemy, `/generated/enemies/${enemySlug}/`) : htmlText(enemy);
}

function spawnSummary(spawns: Array<Record<string, unknown>>, model: ReturnType<typeof extractedModel>) {
  return spawns.map((spawn) => `${enemySpawnLink(spawn.enemy, model)} x${mdEscape(spawn.count)}`).join(", ");
}

function spawnHtmlList(spawns: Array<Record<string, unknown>>, model: ReturnType<typeof extractedModel>) {
  return wikiHtmlList(spawns.map((spawn) => `${enemySpawnHtmlLink(spawn.enemy, model)} <span class="wiki-muted">x${htmlText(spawn.count)}</span>`));
}

function wavesIndex(model: ReturnType<typeof extractedModel>) {
  return (
    frontmatter("Enemy Waves", "Enemy wave tables and map relationships for FROGGY HATES SNOW.") +
    extractedSourceNote() +
    wikiReferenceGrid(
      model.enemyWaves.map((wave) => {
        const slug = slugify(wave.name);
        const firstSpawns = asArray(wave.arenas)
          .slice(0, 2)
          .flatMap((arena) => asArray(arena.total_spawns))
          .slice(0, 8);
        return {
          title: wave.name,
          href: `/generated/waves/${slug}/`,
          facts: [
            ["Arenas", wave.arena_count ?? asArray(wave.arenas).length],
            ["Waves", wave.wave_count],
            ["Maps", (model.locationLinksByWaveSlug.get(slug) ?? []).length]
          ],
          sections: [
            { label: "Common spawns", html: spawnHtmlList(firstSpawns, model) },
            { label: "Used by maps", html: wikiChipListHtml(model.locationLinksByWaveSlug.get(slug) ?? []) }
          ]
        };
      }),
      "wiki-reference-grid--waves"
    )
  );
}

function wavePage(wave: Record<string, unknown>, model: ReturnType<typeof extractedModel>) {
  const slug = slugify(wave.name);
  return (
    frontmatter(String(wave.name ?? "Enemy Wave"), `${wave.name} enemy-wave reference for FROGGY HATES SNOW.`) +
    extractedSourceNote() +
    wikiSummaryTable([
      { label: "Arenas", value: wave.arena_count ?? asArray(wave.arenas).length },
      { label: "Waves", value: wave.wave_count },
      { label: "Used by maps", value: (model.locationLinksByWaveSlug.get(slug) ?? []).length }
    ]) +
    "## Arenas\n\n" +
    wikiReferenceGrid(
      asArray(wave.arenas).map((arena) => ({
        title: `Arena ${displayText(arena.arena)}`,
        facts: [["Size", arena.size]],
        sections: [
          { label: "Total spawns", html: spawnHtmlList(asArray(arena.total_spawns), model) },
          {
            label: "Waves",
            html: wikiHtmlList(
              asArray(arena.waves).map((row) => {
                const spawns = asArray(row.spawns).map((spawn) => `${enemySpawnHtmlLink(spawn.enemy, model)} <span class="wiki-muted">x${htmlText(spawn.count)}</span>`).join(", ");
                return `<strong>Wave ${htmlText(row.wave)}</strong>: ${spawns}`;
              })
            )
          }
        ]
      })),
      "wiki-reference-grid--arenas"
    ) +
    "\n\n## Related\n\n" +
    relationList([pageLink("All enemy waves", "/generated/waves/"), ...(model.locationLinksByWaveSlug.get(slug) ?? [])])
  );
}

function spawnersIndex(model: ReturnType<typeof extractedModel>) {
  return (
    frontmatter("Object Spawners", "Level object spawner rings, collectible pits, traps, and map relationships for FROGGY HATES SNOW.") +
    extractedSourceNote() +
    wikiReferenceGrid(
      model.levelObjectSpawners.map((spawner) => {
        const slug = slugify(spawner.name);
        return {
          title: spawner.name,
          href: `/generated/spawners/${slug}/`,
          facts: [
            ["Sections", spawner.section_count ?? asArray(spawner.sections).length],
            ["Object rules", spawner.object_rule_count],
            ["Maps", (model.locationLinksBySpawnerSlug.get(slug) ?? []).length]
          ],
          sections: [{ label: "Used by maps", html: wikiChipListHtml(model.locationLinksBySpawnerSlug.get(slug) ?? []) }]
        };
      }),
      "wiki-reference-grid--spawners"
    )
  );
}

function spawnerPage(spawner: Record<string, unknown>, model: ReturnType<typeof extractedModel>) {
  const slug = slugify(spawner.name);
  return (
    frontmatter(String(spawner.name ?? "Object Spawner"), `${spawner.name} object-spawner reference for FROGGY HATES SNOW.`) +
    extractedSourceNote() +
    wikiSummaryTable([
      { label: "Sections", value: spawner.section_count ?? asArray(spawner.sections).length },
      { label: "Object rules", value: spawner.object_rule_count },
      { label: "Used by maps", value: (model.locationLinksBySpawnerSlug.get(slug) ?? []).length }
    ]) +
    "## Spawn Sections\n\n" +
    wikiReferenceGrid(
      asArray(spawner.sections).map((section) => ({
        title: section.name,
        facts: [
          ["Radius", `${displayText(section.radius_min)}-${displayText(section.radius_max)}`],
          ["Default", section.enabled_by_default ? "Yes" : "No"]
        ],
        sections: [
          {
            label: "Entries",
            html: wikiTextList(asArray(section.entries).map((entry) => `${entry.category}: ${displayText(entry.object)} x${entry.count}`))
          }
        ]
      })),
      "wiki-reference-grid--spawn-sections"
    ) +
    "\n\n## Related\n\n" +
    relationList([pageLink("All object spawners", "/generated/spawners/"), ...(model.locationLinksBySpawnerSlug.get(slug) ?? [])])
  );
}

function mechanicsHubIndex(model: ReturnType<typeof extractedModel>, snapshot: SteamSnapshot) {
  return (
    frontmatter("Mechanics", "Mechanics reference hub for FROGGY HATES SNOW.") +
    steamScreenshotStrip(snapshot, 1, 3) +
    wikiReferenceGrid(
      [
        {
          title: "Quest Templates",
          href: "/generated/quests/",
          description: `${model.questTemplates.length} objective templates used by maps, achievements, and unlock requirements.`
        },
        {
          title: "Achievement Conditions",
          href: "/generated/achievement-conditions/",
          description: `${model.achievementConditions.length} achievement conditions with parsed requirements.`
        },
        {
          title: "Modes & Difficulty",
          href: "/generated/modes/",
          description: `${model.gameModes.length} game modes and ${model.difficultyLevels.length} difficulty levels.`
        },
        {
          title: "Terrain",
          href: "/generated/terrain/",
          description: `${model.terrainHeightData.length} height patterns and ${model.terrainTextureData.length} texture patterns used by maps.`
        },
        {
          title: "Glossary",
          href: "/generated/glossary/",
          description: "Game terms, resource names, rarity labels, and event text."
        }
      ],
      "wiki-reference-table--mechanics"
    )
  );
}

function questsIndex(model: ReturnType<typeof extractedModel>) {
  return (
    frontmatter("Quest Templates", "Quest objective templates for FROGGY HATES SNOW.") +
    "Quest templates describe reusable objective logic. Map pages show the specific objective targets for each location.\n\n" +
    wikiReferenceGrid(
      model.questTemplates.map((row) => ({
        title: `Logic ${displayText(row.logic_id)}`,
        description: row.text
      })),
      "wiki-reference-table--quests"
    )
  );
}

function achievementConditionsIndex(model: ReturnType<typeof extractedModel>) {
  return (
    frontmatter("Achievement Conditions", "Achievement requirement table for FROGGY HATES SNOW.") +
    "Achievement conditions list the parsed requirement text used by the game. Use the Achievements page for public achievement names and rarity percentages.\n\n" +
    wikiReferenceGrid(
      model.achievementConditions.map((row) => ({
        title: row.title,
        description: row.condition,
        facts: [["Quest ID", row.quest_id]]
      })),
      "wiki-reference-table--achievement-conditions"
    ) +
    "\n\n## Related\n\n" +
    relationList([pageLink("Achievements", "/generated/achievements/"), pageLink("Quest Templates", "/generated/quests/")])
  );
}

function modesIndex(model: ReturnType<typeof extractedModel>) {
  const objectValueCards = (rows: Array<Record<string, unknown>>, titleKeys: string[], className: string) =>
    wikiReferenceGrid(
      rows.map((row) => {
        const title = titleKeys.map((key) => row[key]).find(nonEmptyText) ?? row.object_name ?? "Entry";
        const values = Object.entries(row)
          .filter(([key]) => !["source_asset", "payload_len", "embedded_strings", ...titleKeys].includes(key))
          .slice(0, 10)
          .map(([key, value]) => `${key}: ${compactJson(value)}`);
        return {
          title,
          facts: [["Type", row.class ?? row.mode ?? ""]],
          sections: [{ label: "Values", html: wikiTextList(values) }]
        };
      }),
      className
    );
  return (
    frontmatter("Modes & Difficulty", "Game mode and difficulty settings for FROGGY HATES SNOW.") +
    "## Game Modes\n\n" +
    objectValueCards(model.gameModes, ["name", "mode", "object_name"], "wiki-reference-table--modes") +
    "\n\n## Difficulty Levels\n\n" +
    objectValueCards(model.difficultyLevels, ["name", "object_name"], "wiki-reference-table--modes") +
    "\n"
  );
}

function terrainIndex(model: ReturnType<typeof extractedModel>, snapshot: SteamSnapshot) {
  const terrainRows = [
    ...model.terrainHeightData.map((row) => ({ ...row, terrain_kind: "Height pattern" })),
    ...model.terrainTextureData.map((row) => ({ ...row, terrain_kind: "Texture pattern" }))
  ];
  return (
    frontmatter("Terrain", "Terrain height and texture pattern tables for FROGGY HATES SNOW.") +
    steamScreenshotStrip(snapshot, 4, 3) +
    "Terrain rows describe named generation patterns used by map pages.\n\n" +
    wikiReferenceGrid(
      terrainRows.map((row) => ({
        title: row.name ?? row.object_name,
        facts: [
          ["Kind", row.terrain_kind],
          ["Type", row.class]
        ]
      })),
      "wiki-reference-table--terrain"
    )
  );
}

function glossaryIndex(model: ReturnType<typeof extractedModel>) {
  const local = model.local;
  const groups = [
    ["Game modes", enumValues(local, "GameMode")],
    ["Difficulty levels", enumValues(local, "DifficultyLevel")],
    ["Resources", (local?.localization?.resources ?? []).map((row) => row.name)],
    ["Rarities", (local?.localization?.rarities ?? []).map((row) => row.name)],
    ["End states", (local?.localization?.end_states ?? []).map((row) => row.name)]
  ];
  return (
    frontmatter("Glossary", "Extracted terms for FROGGY HATES SNOW.") +
    wikiReferenceGrid(
      groups.map(([label, values]) => ({
        title: label,
        sections: [{ label: "Values", html: wikiTextList(values as string[]) }]
      })),
      "wiki-reference-grid--glossary"
    ) +
    "\n\n## Quest Text\n\n" +
    wikiReferenceGrid(
      (local?.localization?.quests ?? []).slice(0, 80).map((quest) => ({
        title: quest.id,
        description: displayText(quest.text)
      })),
      "wiki-reference-grid--glossary"
    ) +
    "\n## Event Text\n\n" +
    wikiReferenceGrid(
      (local?.localization?.events ?? []).slice(0, 40).map((event) => ({
        title: event.title,
        description: event.body
      })),
      "wiki-reference-grid--glossary"
    )
  );
}

function bossesIndex(model: ReturnType<typeof extractedModel>, snapshot: SteamSnapshot) {
  const bosses = model.enemyComponents.filter((row) => row.class === "EnemyAttackModuleBoss");
  return (
    frontmatter("Bosses", "Boss attack IDs and phase orders for FROGGY HATES SNOW.") +
    extractedSourceNote() +
    steamScreenshotStrip(snapshot, 7, 3) +
    wikiReferenceGrid(
      bosses.map((boss) => {
        const attacks = asArray(boss.boss_attack_ids).map((row) => `${row.id}: ${row.name}`).join(", ");
        const orders = asArray(boss.boss_phase_orders).map((row) => `${row.label} x${row.repeat_count}`).join("; ");
        return {
          title: boss.name,
          href: `/generated/bosses/${slugify(boss.name)}/`,
          sections: [
            { label: "Attack IDs", html: wikiTextList([attacks]) },
            { label: "Phase orders", html: wikiTextList([orders]) }
          ]
        };
      }),
      "wiki-reference-grid--bosses"
    )
  );
}

function bossPage(boss: Record<string, unknown>) {
  return (
    frontmatter(String(boss.name ?? "Boss"), `${boss.name} boss phase reference for FROGGY HATES SNOW.`) +
    extractedSourceNote() +
    wikiSummaryTable([
      { label: "Attack IDs", value: asArray(boss.boss_attack_ids).length },
      { label: "Phase order rows", value: asArray(boss.boss_phase_orders).length }
    ]) +
    "## Attack IDs\n\n" +
    wikiReferenceGrid(
      asArray(boss.boss_attack_ids).map((row) => ({
        title: row.name,
        facts: [["ID", row.id]]
      })),
      "wiki-reference-grid--bosses"
    ) +
    "\n\n## Phase Orders\n\n" +
    wikiReferenceGrid(
      asArray(boss.boss_phase_orders).map((row) => ({
        title: row.label,
        facts: [["Repeat", row.repeat_count]],
        sections: [{ label: "Attacks", html: wikiTextList(asArray(row.attacks).map((attack) => `${attack.name ?? attack.id}`)) }]
      })),
      "wiki-reference-grid--bosses"
    )
  );
}

function rangeByLabel(rows: Array<Record<string, unknown>>, label: string) {
  return rows.find((row) => String(row.label ?? "").toLowerCase() === label.toLowerCase());
}

function enemySummaryRow(enemy: Record<string, unknown>) {
  const rows = asArray(enemy.value_ranges);
  const stats = wikiTextList(
    [
      ["Health", "MaxHealth"],
      ["Damage", "AttackDamage"],
      ["Cooldown", "AttackCooldown"],
      ["Move", "MovementSpeed"],
      ["Projectile", "ProjectileSpeed"],
      ["Dash", "DashSpeed"]
    ]
      .map(([label, key]) => {
        const row = rangeByLabel(rows, key);
        const value = row ? valueRangeBrief(row) : "";
        return value ? `${label}: ${value}` : "";
      })
      .filter(Boolean)
  );
  const href = `/generated/enemies/${slugify(enemy.name)}/`;
  return [htmlLink(enemy.name, href), stats];
}

function enemiesStatsTable(enemies: Array<Record<string, unknown>>) {
  return wikiDataTable(
    ["Enemy", "Stats"],
    enemies.map(enemySummaryRow),
    "wiki-reference-table--enemies"
  );
}

function enemyStatsFacts(enemy: Record<string, unknown>) {
  const rows = asArray(enemy.value_ranges);
  return [
    ["Health", "MaxHealth"],
    ["Damage", "AttackDamage"],
    ["Cooldown", "AttackCooldown"],
    ["Move", "MovementSpeed"],
    ["Projectile", "ProjectileSpeed"],
    ["Dash", "DashSpeed"]
  ]
    .map(([label, key]) => {
      const row = rangeByLabel(rows, key);
      const value = row ? valueRangeBrief(row) : "";
      return value ? ([label, value] as [string, string]) : undefined;
    })
    .filter(Boolean)
    .map((row) => row as [string, string]);
}

function enemiesIndex(model: ReturnType<typeof extractedModel>, snapshot: SteamSnapshot) {
  const upgrades = model.enemyComponents.filter((row) => row.class === "EnemyUpgradeModule" && asArray(row.value_ranges).length > 0);
  return (
    frontmatter("Enemies", "Enemy stats and wave data for FROGGY HATES SNOW.") +
    extractedSourceNote() +
    steamScreenshotStrip(snapshot, 9, 3) +
    enemiesStatsTable(upgrades) +
    "\n\n## Wave Assets\n\n" +
    wikiReferenceGrid(
      model.enemyWaves.map((wave) => ({
        title: wave.name,
        href: `/generated/waves/${slugify(wave.name)}/`,
        facts: [
          ["Arenas", wave.arena_count ?? asArray(wave.arenas).length],
          ["Waves", wave.wave_count]
        ]
      })),
      "wiki-reference-grid--waves"
    )
  );
}

function enemyPage(enemy: Record<string, unknown>) {
  return (
    frontmatter(String(enemy.name ?? "Enemy"), `${enemy.name} enemy values for FROGGY HATES SNOW.`) +
    extractedSourceNote() +
    wikiSummaryTable([
      { label: "Parameters", value: asArray(enemy.value_ranges).length }
    ]) +
    "## Values\n\n" +
    valueRangeTableHtml(asArray(enemy.value_ranges)) +
    "\n"
  );
}

async function writeExtractedWikiPages(generatedRoot: string, extractedMetadata: ExtractedMetadataSnapshot, rowsByDataset: Map<string, Entity[]>, snapshot: SteamSnapshot) {
  const model = extractedModel(extractedMetadata);
  const ensureDir = async (category: string) => mkdir(path.join(generatedRoot, category), { recursive: true });

  await ensureDir("frogs");
  await writeFile(path.join(generatedRoot, "frogs", "index.md"), frogsIndex(model, snapshot));
  for (const character of model.characters) {
    const dir = path.join(generatedRoot, "frogs", slugify(character.name));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.md"), characterPage(character, model));
  }

  await ensureDir("maps");
  await writeFile(path.join(generatedRoot, "maps", "index.md"), mapsIndex(model, snapshot));
  for (const location of model.locations) {
    const dir = path.join(generatedRoot, "maps", slugify(location.name));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.md"), locationPage(location, model));
  }

  await ensureDir("items");
  await writeFile(path.join(generatedRoot, "items", "index.md"), itemsIndex(model, snapshot));
  for (const artifact of model.artifacts) {
    const dir = path.join(generatedRoot, "items", slugify(artifact.name));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.md"), artifactPage(artifact));
  }

  await ensureDir("upgrades");
  await writeFile(path.join(generatedRoot, "upgrades", "index.md"), upgradesIndex(model, snapshot));
  for (const upgrade of model.upgrades) {
    const dir = path.join(generatedRoot, "upgrades", slugify(upgrade.feature_name ?? upgrade.name ?? upgrade.class));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.md"), upgradePage(upgrade, model));
  }

  await ensureDir("skills");
  await writeFile(path.join(generatedRoot, "skills", "index.md"), skillsIndex(model, snapshot));
  for (const skill of model.skills) {
    const dir = path.join(generatedRoot, "skills", slugify(skill.name));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.md"), skillPage(skill, model));
  }

  await ensureDir("status-effects");
  await writeFile(path.join(generatedRoot, "status-effects", "index.md"), statusEffectsIndex(model));
  for (const effect of model.statusEffects) {
    const dir = path.join(generatedRoot, "status-effects", slugify(effect.feature_name ?? effect.name));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.md"), statusEffectPage(effect, model));
  }

  await ensureDir("tools");
  await writeFile(path.join(generatedRoot, "tools", "index.md"), extractedSkillCategoryIndex("Tools", "Tool reference for FROGGY HATES SNOW.", model, rowsByDataset.get("tools") ?? []));

  await ensureDir("companions");
  await writeFile(path.join(generatedRoot, "companions", "index.md"), extractedSkillCategoryIndex("Companions", "Companion reference for FROGGY HATES SNOW.", model, rowsByDataset.get("companions") ?? []));

  await ensureDir("waves");
  await writeFile(path.join(generatedRoot, "waves", "index.md"), wavesIndex(model));
  for (const wave of model.enemyWaves) {
    const dir = path.join(generatedRoot, "waves", slugify(wave.name));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.md"), wavePage(wave, model));
  }

  await ensureDir("spawners");
  await writeFile(path.join(generatedRoot, "spawners", "index.md"), spawnersIndex(model));
  for (const spawner of model.levelObjectSpawners) {
    const dir = path.join(generatedRoot, "spawners", slugify(spawner.name));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.md"), spawnerPage(spawner, model));
  }

  await ensureDir("mechanics");
  await writeFile(path.join(generatedRoot, "mechanics", "index.md"), mechanicsHubIndex(model, snapshot));

  await ensureDir("quests");
  await writeFile(path.join(generatedRoot, "quests", "index.md"), questsIndex(model));

  await ensureDir("achievement-conditions");
  await writeFile(path.join(generatedRoot, "achievement-conditions", "index.md"), achievementConditionsIndex(model));

  await ensureDir("modes");
  await writeFile(path.join(generatedRoot, "modes", "index.md"), modesIndex(model));

  await ensureDir("terrain");
  await writeFile(path.join(generatedRoot, "terrain", "index.md"), terrainIndex(model, snapshot));

  await ensureDir("glossary");
  await writeFile(path.join(generatedRoot, "glossary", "index.md"), glossaryIndex(model));

  await ensureDir("bosses");
  await writeFile(path.join(generatedRoot, "bosses", "index.md"), bossesIndex(model, snapshot));
  for (const boss of model.enemyComponents.filter((row) => row.class === "EnemyAttackModuleBoss")) {
    const dir = path.join(generatedRoot, "bosses", slugify(boss.name));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.md"), bossPage(boss));
  }

  await ensureDir("enemies");
  await writeFile(path.join(generatedRoot, "enemies", "index.md"), enemiesIndex(model, snapshot));
  for (const enemy of model.enemyComponents.filter((row) => row.class === "EnemyUpgradeModule" && asArray(row.value_ranges).length > 0)) {
    const dir = path.join(generatedRoot, "enemies", slugify(enemy.name));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.md"), enemyPage(enemy));
  }
}

function homepage(snapshot: SteamSnapshot, extractedMetadata: ExtractedMetadataSnapshot) {
  const local = extractedMetadata.local_game_data;
  const localGameplayComponents = local?.serialized_assets?.gameplay_component_summaries?.component_counts ?? {};
  const localGameplayComponentTotal = Object.values(localGameplayComponents).reduce((sum, count) => sum + Number(count ?? 0), 0);
  const stripped = local ? asRecord(local.serialized_assets?.stripped_mono_behaviours) : {};
  const characters = asArray(stripped.characters).filter(isPlayerFacingAsset);
  const locations = asArray(stripped.locations).filter(isPlayerFacingAsset);
  const artifacts = asArray(stripped.artifacts).filter(isPlayerFacingAsset);
  const upgrades = asArray(stripped.upgrade_assets).filter(isPlayerFacingAsset);
  const statusEffects = asArray(stripped.status_effect_upgrades).filter(isPlayerFacingAsset);
  const coreSkills = (local?.localization?.skills ?? [])
    .map((skill) => skill as Record<string, unknown>)
    .filter((skill) => !isStatusEffectVariantSkill(skill, statusEffects));
  const enemyComponents = asArray(stripped.enemy_component_payloads).filter(isPlayerFacingAsset);
  const enemies = enemyComponents.filter((row) => row.class === "EnemyUpgradeModule" && asArray(row.value_ranges).length > 0);
  const bosses = enemyComponents.filter((row) => row.class === "EnemyAttackModuleBoss");
  const enemyWaveRows = asArray(stripped.enemy_wave_data).reduce((sum, row) => sum + asArray(row.arenas).reduce((arenaSum, arena) => arenaSum + asArray(arena.waves).length, 0), 0);
  const referenceRows = [
    ["Media", "/generated/media/", `${snapshot.apps.full_game.screenshots_count} public Steam screenshots`],
    ["Frogs", "/generated/frogs/", `${characters.length} character rows`],
    ["Skills", "/generated/skills/", `${coreSkills.length} core skill rows`],
    ["Tools", "/generated/tools/", "Tool subset"],
    ["Companions", "/generated/companions/", "Companion subset"],
    ["Upgrades", "/generated/upgrades/", `${upgrades.length} upgrade rows`],
    ["Status Effects", "/generated/status-effects/", `${statusEffects.length} status-effect rows`],
    ["Items", "/generated/items/", `${artifacts.length} artifacts plus resources`],
    ["Maps", "/generated/maps/", `${locations.length} location rows`],
    ["Enemy Waves", "/generated/waves/", `${enemyWaveRows} wave rows`],
    ["Object Spawners", "/generated/spawners/", `${local?.addressables?.level_object_prefabs_count ?? 0} level-object prefabs`],
    ["Enemies", "/generated/enemies/", `${enemies.length} enemy rows`],
    ["Bosses", "/generated/bosses/", `${bosses.length} boss rows`],
    ["Achievements", "/generated/achievements/", `${snapshot.achievements.community_rows_count} achievement rows`],
    ["Mechanics", "/generated/mechanics/", "Quests, modes, difficulty, and terrain"],
    ["Quest Templates", "/generated/quests/", `${asArray(stripped.quest_templates).length} objective templates`],
    ["Achievement Conditions", "/generated/achievement-conditions/", `${asArray(stripped.achievement_conditions).length} achievement requirements`],
    ["Modes & Difficulty", "/generated/modes/", "Modes and difficulty levels"],
    ["Terrain", "/generated/terrain/", "Height and texture patterns"],
    ["Glossary", "/generated/glossary/", "System terms"]
  ];
  return (
    frontmatter("FROGGY HATES SNOW Wiki", "Unofficial reference wiki for FROGGY HATES SNOW.") +
    steamHeroImage(snapshot) +
    "Unofficial reference wiki for **FROGGY HATES SNOW**.\n\n" +
    steamScreenshotStrip(snapshot, 0, 4) +
    "## Reference Index\n\n" +
    wikiReferenceGrid(
      referenceRows.map(([label, href, contents]) => ({
        title: label,
        href,
        description: contents
      })),
      "wiki-reference-grid--home"
    )
  );
}

function guidePages() {
  return new Map<string, string>();
}

function staticPages() {
  return new Map<string, string>();
}

export async function generatePages() {
  const outputRoot = path.resolve("src/content/docs");
  const generatedRoot = path.join(outputRoot, "generated");
  await mkdir(outputRoot, { recursive: true });
  await rm(path.join(outputRoot, "guides"), { recursive: true, force: true });
  await Promise.all(
    [
      "faq.md",
      "contribute.md",
      "verification-status.md",
      "game-metadata.md",
      "game-file-extraction.md"
    ].map((fileName) => rm(path.join(outputRoot, fileName), { force: true }))
  );
  await rm(generatedRoot, { recursive: true, force: true });
  await mkdir(generatedRoot, { recursive: true });

  const datasetEntries = await Promise.all(REQUIRED_DATASETS.map(async (dataset) => [dataset, await readDataset(dataset)] as const));
  const steamSnapshot = await readJson<SteamSnapshot>(path.resolve("src/data/steam-snapshot.json"));
  const extractedMetadata = await readJson<ExtractedMetadataSnapshot>(path.resolve("notes/extracted-metadata.json"));
  const rowsByDataset = new Map<string, Entity[]>(datasetEntries);

  await writeFile(path.join(outputRoot, "index.md"), homepage(steamSnapshot, extractedMetadata));
  await mkdir(path.join(generatedRoot, "media"), { recursive: true });
  await writeFile(path.join(generatedRoot, "media", "index.md"), mediaGalleryPage(steamSnapshot));

  for (const [dataset, rows] of datasetEntries) {
    const categoryDir = path.join(generatedRoot, dataset);
    await mkdir(categoryDir, { recursive: true });
    await writeFile(path.join(categoryDir, "index.md"), categoryIndex(dataset, rows, extractedMetadata));
  }

  await writeExtractedWikiPages(generatedRoot, extractedMetadata, rowsByDataset, steamSnapshot);

  for (const [relativePath, contents] of [...guidePages(), ...staticPages()]) {
    const filePath = path.join(outputRoot, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents);
  }

  await clearAstroContentCache();
  console.log(`Generated ${REQUIRED_DATASETS.length} player lookup tables plus extracted detail pages from game-file metadata.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await generatePages();
}
