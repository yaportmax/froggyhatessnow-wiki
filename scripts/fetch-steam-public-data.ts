import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { REQUIRED_DATASETS } from "./validate-data";

const FULL_APP_ID = 3232380;
const DEMO_APP_ID = 4037600;
const ACCESSED_DATE = new Date().toISOString().slice(0, 10);

type SourceType = "game_file" | "public_source" | "gameplay_note" | "inferred" | "unknown";
type VerificationStatus = "Verified" | "Inferred" | "Needs verification";

type Source = {
  type: SourceType;
  path_or_url: string;
  label: string;
  confidence: "high" | "medium" | "low";
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
  verification_status: VerificationStatus;
  last_verified_game_version: string;
  notes: string;
  [key: string]: unknown;
};

type SteamAchievement = {
  name: string;
  percent: string;
};

type AchievementRow = {
  title: string;
  description: string;
  percent: string;
  icon_url: string;
};

type FetchResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
};

type SnapshotAppKind = "full_game" | "demo";

type SnapshotApp = {
  app_id: number;
  kind: SnapshotAppKind;
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

type PublicGameplayClaim = {
  claim: string;
  source_ids: string[];
  confidence: Source["confidence"];
  wiki_targets: string[];
  notes: string;
};

type SteamNewsFindings = {
  source_url: string;
  playable_frogs_count: number;
  locations_count: number;
  minimum_combined_skills_tools_attacks_companions: number;
  demo_progress_carries_over: boolean;
  confirmed_terms: string[];
  notes: string[];
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
    full_game: unknown;
    demo: unknown;
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
    highest_global_percentages: SteamAchievement[];
    lowest_global_percentages: SteamAchievement[];
    notes: string[];
  };
  public_gameplay_claims: PublicGameplayClaim[];
  steam_news_findings: SteamNewsFindings;
  research_gaps: string[];
  refresh_commands: string[];
};

const urls = {
  fullStore: `https://store.steampowered.com/app/${FULL_APP_ID}/FROGGY_HATES_SNOW/`,
  demoStore: `https://store.steampowered.com/app/${DEMO_APP_ID}/FROGGY_HATES_SNOW_Demo/`,
  fullAppDetails: `https://store.steampowered.com/api/appdetails?appids=${FULL_APP_ID}&cc=us&l=english`,
  demoAppDetails: `https://store.steampowered.com/api/appdetails?appids=${DEMO_APP_ID}&cc=us&l=english`,
  fullReviews: `https://store.steampowered.com/appreviews/${FULL_APP_ID}?json=1&language=all&filter=summary&purchase_type=all&num_per_page=0`,
  demoReviews: `https://store.steampowered.com/appreviews/${DEMO_APP_ID}?json=1&language=all&filter=summary&purchase_type=all&num_per_page=0`,
  achievementPercentages: `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=${FULL_APP_ID}&format=json`,
  demoAchievementPercentages: `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=${DEMO_APP_ID}&format=json`,
  achievementsPage: `https://steamcommunity.com/stats/${FULL_APP_ID}/achievements/?l=english`,
  news: `https://steamcommunity.com/app/${FULL_APP_ID}/allnews/?l=english`,
  steamDbFull: `https://steamdb.info/app/${FULL_APP_ID}/`,
  steamDbDemo: `https://steamdb.info/app/${DEMO_APP_ID}/`,
  publisherPage: "https://digitalbandidos.com/games/froggy-hates-snow/"
};

function source(label: string, pathOrUrl: string, notes: string, confidence: Source["confidence"] = "high"): Source {
  return {
    type: "public_source",
    path_or_url: pathOrUrl,
    label,
    confidence,
    notes
  };
}

function inferredSource(label: string, notes: string): Source {
  return {
    type: "inferred",
    path_or_url: "local inference from public-source wording",
    label,
    confidence: "medium",
    notes
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(value: string) {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringArray(value: unknown): string[] {
  return asArray(value)
    .map((item) => String(item))
    .filter(Boolean);
}

function descriptionArray(value: unknown): string[] {
  return asArray(value)
    .map((item) => asRecord(item).description)
    .filter((description): description is string => typeof description === "string" && description.length > 0);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "froggyhatessnow-wiki-metadata/0.1"
    }
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return (await response.json()) as T;
}

async function fetchJsonResult<T>(url: string): Promise<FetchResult<T>> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "froggyhatessnow-wiki-metadata/0.1"
      }
    });
    if (!response.ok) {
      return { ok: false, status: response.status, data: null, error: `${url} returned ${response.status}` };
    }
    return { ok: true, status: response.status, data: (await response.json()) as T, error: null };
  } catch (error) {
    return { ok: false, status: 0, data: null, error: (error as Error).message };
  }
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "froggyhatessnow-wiki-metadata/0.1"
    }
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

function summarizeSteamApp(kind: SnapshotAppKind, appId: number, sourceUrl: string, apiUrl: string, data: Record<string, unknown>): SnapshotApp {
  const screenshots = asArray(data.screenshots);
  const movies = asArray(data.movies);
  const recommendations = asRecord(data.recommendations);
  const achievements = asRecord(data.achievements);

  const app: SnapshotApp = {
    app_id: appId,
    kind,
    title: String(data.name ?? ""),
    type: String(data.type ?? ""),
    source_url: sourceUrl,
    api_url: apiUrl,
    is_free: typeof data.is_free === "boolean" ? data.is_free : null,
    release_date: data.release_date ?? null,
    developer: stringArray(data.developers),
    publisher: stringArray(data.publishers),
    platforms: data.platforms ?? null,
    genres: descriptionArray(data.genres),
    categories: descriptionArray(data.categories),
    supported_languages_text: stripHtml(String(data.supported_languages ?? "")),
    price_overview: Object.keys(asRecord(data.price_overview)).length > 0 ? data.price_overview : null,
    recommendations_total: numberOrNull(recommendations.total),
    achievements_total: numberOrNull(achievements.total),
    screenshots_count: screenshots.length,
    screenshots: screenshots.slice(0, 6).map((screenshot) => {
      const row = asRecord(screenshot);
      return {
        id: (typeof row.id === "number" || typeof row.id === "string") ? row.id : null,
        thumbnail_url: String(row.path_thumbnail ?? ""),
        full_url: String(row.path_full ?? "")
      };
    }),
    movies: movies.map((movie) => {
      const row = asRecord(movie);
      return {
        id: (typeof row.id === "number" || typeof row.id === "string") ? row.id : null,
        name: String(row.name ?? ""),
        thumbnail_url: String(row.thumbnail ?? "")
      };
    }),
    header_image: typeof data.header_image === "string" ? data.header_image : null,
    capsule_image: typeof data.capsule_image === "string" ? data.capsule_image : null,
    website: typeof data.website === "string" ? data.website : null
  };

  if (kind === "demo") app.fullgame = data.fullgame ?? null;
  return app;
}

function parseAchievementRows(html: string): AchievementRow[] {
  const rows: AchievementRow[] = [];
  const rowRegex = /<div class="achieveRow[\s\S]*?<\/div>\s*<div style="clear: both;"><\/div>\s*<\/div>/g;
  const matches = html.match(rowRegex) ?? [];

  for (const row of matches) {
    const icon = row.match(/<img src="([^"]+)"/)?.[1] ?? "";
    const percent = decodeEntities(row.match(/<div class="achievePercent">([\s\S]*?)<\/div>/)?.[1] ?? "").trim();
    const title = stripHtml(row.match(/<h3>([\s\S]*?)<\/h3>/)?.[1] ?? "");
    const description = stripHtml(row.match(/<h5>([\s\S]*?)<\/h5>/)?.[1] ?? "");
    if (title && description) rows.push({ title, description, percent, icon_url: icon });
  }

  return rows;
}

function extractSteamNewsFindings(html: string): SteamNewsFindings {
  const text = stripHtml(html);
  const required: Array<[string, RegExp]> = [
    ["10 playable frogs", /\b10 playable frogs\b/i],
    ["16 locations", /\b16 snow-covered\b/i],
    ["60+ skills/tools/attacks/companions", /\b60\+\s+skills,\s+tools,\s+attacks,\s+and\s+companions\b/i],
    ["demo progress carries over", /progress (?:will )?carr(?:y|ies) over/i],
    ["snow digging core mechanic", /snow digging is the core mechanic/i],
    ["anomalous zones rewards", /Completing an anomalous zone grants you Blue Gems/i],
    ["post-launch update", /First Post-Launch Update/i]
  ];
  const missing = required.filter(([, pattern]) => !pattern.test(text)).map(([label]) => label);
  if (missing.length > 0) {
    throw new Error(`Steam news/devlog source is missing expected public markers: ${missing.join(", ")}`);
  }

  return {
    source_url: urls.news,
    playable_frogs_count: 10,
    locations_count: 16,
    minimum_combined_skills_tools_attacks_companions: 60,
    demo_progress_carries_over: true,
    confirmed_terms: [
      "Zippy",
      "Glider",
      "Snowball Roll",
      "Leap Chain",
      "Delivery Bot",
      "Flamethrower Bot",
      "Scanner Drone",
      "Piercing Icicles",
      "Fireworks",
      "Snowball Volley",
      "Energy Wave",
      "Destructive Field",
      "Invincible Roll",
      "Armor",
      "Drill",
      "Salt Sack",
      "Snowblower",
      "Blue Gems",
      "Common artifacts",
      "Uncommon artifacts",
      "Rare artifacts",
      "Legendary artifacts"
    ],
    notes: [
      "Steam news/devlog text is treated as public first-party source material, but exact numeric balance values still need gameplay or patch-note verification.",
      "Counts from news/devlogs establish scope; they do not provide complete names for every frog, location, skill, tool, attack, or companion."
    ]
  };
}

function entity(base: {
  name: string;
  category: string;
  short_description: string;
  verification_status: VerificationStatus;
  sources: Source[];
  id?: string;
  aliases?: string[];
  effect?: string;
  unlock_method?: string;
  cost?: string;
  mode?: string;
  related_entities?: string[];
  notes?: string;
  last_verified_game_version?: string;
  extra?: Record<string, unknown>;
}): Entity {
  const id = base.id ?? slugify(base.name);
  return {
    id,
    slug: id,
    name: base.name,
    aliases: base.aliases ?? [],
    category: base.category,
    short_description: base.short_description,
    effect: base.effect ?? "Needs verification.",
    unlock_method: base.unlock_method ?? "Needs verification.",
    cost: base.cost ?? "Needs verification.",
    mode: base.mode ?? "Needs verification.",
    related_entities: [...new Set(base.related_entities ?? [])],
    sources: base.sources,
    verification_status: base.verification_status,
    last_verified_game_version: base.last_verified_game_version ?? "Public Steam metadata accessed " + ACCESSED_DATE,
    notes: base.notes ?? "",
    ...(base.extra ?? {})
  };
}

function addUnique(map: Map<string, Entity>, item: Entity) {
  if (!map.has(item.id)) map.set(item.id, item);
}

function classifyName(name: string): keyof typeof datasets {
  const lower = name.toLowerCase();
  if (["penguin", "mole", "owl"].includes(lower)) return "companions";
  if (["map", "scanner", "locator", "shovel", "cart", "pickaxe", "dynamite", "air bomb", "flamethrower", "heater sled", "gloves", "skis", "explosives"].includes(lower)) {
    return "tools";
  }
  if (["hot tea", "energy drink", "poison flask", "frost bomb", "flashbang", "keys", "treasure chests", "gems", "artifacts", "treasures", "traps"].includes(lower)) {
    return "items";
  }
  return "skills";
}

function extractNamesFromAchievement(description: string) {
  const withMatch = description.match(/\bwith\s+(.+)$/i);
  if (!withMatch) return [];
  return withMatch[1]
    .split(/\s*,\s*|\s*&\s*|\s+and\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function comparableAchievementName(value: string) {
  const roman: Record<string, string> = {
    i: "1",
    ii: "2",
    iii: "3",
    iv: "4",
    v: "5"
  };
  const slug = slugify(value.replace(/_/g, " "));
  return slug
    .split("-")
    .map((part, index, parts) => (index === parts.length - 1 && roman[part] ? roman[part] : part))
    .join("-");
}

const datasets: Record<(typeof REQUIRED_DATASETS)[number], Map<string, Entity>> = {
  frogs: new Map(),
  maps: new Map(),
  tools: new Map(),
  items: new Map(),
  skills: new Map(),
  companions: new Map(),
  upgrades: new Map(),
  bosses: new Map(),
  enemies: new Map(),
  achievements: new Map(),
  glossary: new Map()
};

function seedCoreEntities() {
  const fullStore = source("Steam full-game store page", urls.fullStore, "Official public Steam store listing.");
  const demoStore = source("Steam demo store page", urls.demoStore, "Official public Steam demo listing.");
  const steamNews = source("Steam community news/devlogs", urls.news, "Official public Steam news and developer posts for launch, systems, updates, and devlogs.");
  const publisher = source("Digital Bandidos game page", urls.publisherPage, "Publisher page for FROGGY HATES SNOW.", "medium");

  addUnique(
    datasets.frogs,
    entity({
      name: "Froggy",
      category: "frogs",
      short_description: "The public Steam description identifies the player as Froggy, a survivor in a snowy desert.",
      effect: "Playable survivor character.",
      mode: "Core game and demo.",
      verification_status: "Verified",
      sources: [fullStore, demoStore],
      notes: "No public roster of named frog variants was found in the safe metadata pass."
    })
  );

  addUnique(
    datasets.frogs,
    entity({
      name: "Playable characters",
      category: "frogs",
      short_description: "Steam news confirms 10 playable frogs, and public achievements refer to unlocking and upgrading characters.",
      effect: "The full roster has 10 playable frogs; each name, stat line, and attack still needs verification unless listed separately.",
      unlock_method: "Achievements mention unlocking 1, 3, and 9 characters.",
      verification_status: "Verified",
      sources: [steamNews, source("Steam community achievements page", urls.achievementsPage, "Public achievement names and descriptions.")],
      notes: "Use as a roster placeholder until local metadata or gameplay notes identify the remaining character names."
    })
  );

  addUnique(
    datasets.frogs,
    entity({
      name: "Zippy",
      category: "frogs",
      short_description: "The first post-launch Steam update identifies Zippy as a playable character.",
      effect: "The update says Zippy starts with Invincible Roll as a default skill.",
      unlock_method: "Needs verification.",
      related_entities: ["invincible-roll"],
      verification_status: "Verified",
      sources: [steamNews],
      notes: "Exact character stats and attack details need gameplay verification."
    })
  );

  addUnique(
    datasets.maps,
    entity({
      name: "Locations",
      category: "maps",
      short_description: "Steam news confirms 16 snow-covered, treasure-filled, anomaly-hiding locations.",
      effect: "Locations structure progression and completion; exact map names remain unverified.",
      unlock_method: "Achievements mention unlock thresholds at 1, 5, and 15 locations.",
      verification_status: "Verified",
      sources: [steamNews, source("Steam community achievements page", urls.achievementsPage, "Public achievement names and descriptions.")],
      notes: "Individual location names need verification."
    })
  );

  addUnique(
    datasets.maps,
    entity({
      name: "Snowy desert",
      category: "maps",
      short_description: "The official Steam description places the survival loop in a hostile snowy desert.",
      effect: "Primary setting where the player digs, fights, gathers resources, and searches for exits.",
      mode: "Core game and demo.",
      verification_status: "Verified",
      sources: [fullStore, demoStore, steamNews],
      notes: "This is a setting term, not a confirmed map name."
    })
  );

  const snowTools = new Map<string, string>([
    ["Hands", "Always available basic snow removal, but slow and limited."],
    ["Shovel", "Bigger digging area, faster digging, and can hit enemies."],
    ["Pickaxe", "Basic ice-breaking tool."],
    ["Drill", "Fast ice-breaking tool."],
    ["Salt Sack", "Throwable that turns ice into snow."],
    ["Dynamite", "Removes snow and ice in a limited area."],
    ["Air Bomb", "Clears large areas of soft snow, but not ice."],
    ["Snowblower", "Continuous snow removal tool."],
    ["Flamethrower", "Continuous snow removal tool that can melt ice and set enemies on fire."],
    ["Skis", "Movement or traversal tool mentioned in public Steam copy."],
    ["Cart", "Resource-carrying tool mentioned in public Steam copy and anomalous-zone devlog."]
  ]);

  for (const [name, effect] of snowTools) {
    addUnique(
      datasets.tools,
      entity({
        name,
        category: "tools",
        short_description: `${name} is mentioned in official Steam copy or Steam devlogs as part of digging, movement, ice handling, or resource carrying.`,
        effect,
        mode: "Core game and demo.",
        verification_status: "Verified",
        sources: [fullStore, demoStore, steamNews],
        notes: "Specific stats and unlock details need verification from gameplay or safe local metadata."
      })
    );
  }

  const companions = new Map<string, string>([
    ["Penguin", "A companion or ally type; exact behavior needs verification."],
    ["Mole", "A helper that digs tunnels automatically, according to the snow devlog."],
    ["Owl", "A companion or ally type; exact behavior needs verification."],
    ["Delivery Bot", "A robotic helper added for launch, according to the launch devlog."],
    ["Flamethrower Bot", "A robotic helper added for launch, according to the launch devlog."],
    ["Scanner Drone", "A robotic helper added for launch, according to the launch devlog."]
  ]);

  for (const [name, effect] of companions) {
    addUnique(
      datasets.companions,
      entity({
        name,
        category: "companions",
        short_description: `${name} is listed publicly as a companion or ally type.`,
        effect,
        verification_status: "Verified",
        sources: [fullStore, demoStore, steamNews, source("Steam community achievements page", urls.achievementsPage, "The Animal Squad achievement mentions Penguin, Mole, and Owl.")],
        notes: "Specific behavior, rarity, and unlock details need gameplay verification."
      })
    );
  }

  const publicItems = new Map<string, string>([
    ["Gems", "General resource mentioned by official Steam copy."],
    ["Blue Gems", "Meta currency granted by anomalous zones and used to unlock new characters."],
    ["Keys", "Used for the escape door and treasure chests, according to public Steam copy."],
    ["Treasure chests", "Reward container mentioned by public Steam copy and anomalous-zone devlog."],
    ["Treasures", "General hidden reward concept mentioned by official Steam copy."],
    ["Traps", "Hazard concept mentioned by official Steam copy."],
    ["Artifacts", "Permanent build-expanding items granted by anomalous zones; devlog lists Common, Uncommon, Rare, and Legendary rarity tiers."]
  ]);

  for (const [name, effect] of publicItems) {
    addUnique(
      datasets.items,
      entity({
        name,
        category: "items",
        short_description: `${name} are mentioned by official Steam copy or public achievements.`,
        effect,
        verification_status: "Verified",
        sources: [fullStore, demoStore, steamNews, source("Steam community achievements page", urls.achievementsPage, "Public achievement names and descriptions.")],
        notes: "Amounts, drop rules, and exact use cases need verification."
      })
    );
  }

  for (const name of ["Faster digging", "Combat strength", "Cold resistance", "Character upgrades", "Artifact upgrades", "Roll upgrades", "Powerful upgrades"]) {
    addUnique(
      datasets.upgrades,
      entity({
        name,
        category: "upgrades",
        short_description: `${name} is a public upgrade concept from Steam copy or achievements.`,
        effect: "Needs verification.",
        cost: name === "Powerful upgrades" ? "Keys may be spent on treasure chests for powerful upgrades, per official Steam copy." : "Needs verification.",
        verification_status: "Verified",
        sources: [fullStore, demoStore, steamNews, source("Steam community achievements page", urls.achievementsPage, "Public achievement names and descriptions.")],
        notes: "Specific upgrade tree entries need verification."
      })
    );
  }

  const publicSkills = new Map<string, string>([
    ["Glider", "Movement skill added for launch."],
    ["Snowball Roll", "Movement skill that can grow as it collects snow."],
    ["Leap Chain", "Movement skill added for launch."],
    ["Piercing Icicles", "Projectile-based snow digging skill added for launch."],
    ["Fireworks", "Projectile-based snow digging skill added for launch."],
    ["Snowball Volley", "Projectile-based snow digging skill added for launch."],
    ["Energy Wave", "Post-launch update says it destroys all projectiles within its radius."],
    ["Destructive Field", "Post-launch update says it destroys all projectiles within its radius."],
    ["Invincible Roll", "Post-launch update says Zippy starts with this as a default skill."],
    ["Armor", "Post-launch update says this skill is unlocked from the beginning."],
    ["Skill Banishing", "Launch devlog describes removing skills from the pool so preferred builds appear more often."],
    ["In-run skill reordering", "Launch devlog describes reordering skills to match preferred hotkeys."]
  ]);

  for (const [name, effect] of publicSkills) {
    addUnique(
      datasets.skills,
      entity({
        name,
        category: "skills",
        short_description: `${name} is named in official Steam news or devlog copy.`,
        effect,
        verification_status: "Verified",
        sources: [steamNews],
        notes: "Exact rarity, cooldown, scaling, and unlock details need gameplay verification."
      })
    );
  }

  addUnique(
    datasets.bosses,
    entity({
      name: "Final boss",
      category: "bosses",
      short_description: "Official Steam copy says a run can be survived by finding the escape door or defeating the final boss.",
      effect: "Victory path alternative to escaping.",
      mode: "Core game and demo.",
      verification_status: "Verified",
      sources: [fullStore, demoStore],
      notes: "Boss names and encounter details need verification."
    })
  );

  addUnique(
    datasets.bosses,
    entity({
      name: "Location bosses",
      category: "bosses",
      short_description: "Official Steam copy says each new map hides its own boss.",
      effect: "Needs verification.",
      verification_status: "Verified",
      sources: [fullStore, demoStore],
      notes: "Treat as a generic boss category until location-specific boss names are verified."
    })
  );

  for (const name of ["Mystical creatures", "Eerie creatures", "Obsidian creatures"]) {
    addUnique(
      datasets.enemies,
      entity({
        name,
        category: "enemies",
        short_description: `${name} are public enemy descriptors from official Steam copy.`,
        effect: "Hostile enemy category; exact behavior needs verification.",
        mode: "Core game and demo, except Peaceful Mode is described as monster-free.",
        verification_status: "Verified",
        sources: [fullStore, demoStore],
        notes: "Specific enemy names and behaviors need verification."
      })
    );
  }

  const glossaryTerms = [
    ["Warmth", "Survival resource concept; Steam copy says warmth means survival."],
    ["Freezing", "Survival threat; Steam copy says staying too long in the cold can freeze the player."],
    ["Snowbank", "Interactive snow tile or obstacle described as hiding treasures, traps, or enemies."],
    ["Heightmap snow", "The snow devlog describes the world snow as a heightmap texture changed by digging."],
    ["Snow layers", "The snow devlog says different areas can have different layers and density."],
    ["Escape door", "Victory route requiring enough keys, according to Steam copy."],
    ["Anomaly zones", "Risk/reward areas that offer challenges and rewards, according to Steam copy."],
    ["Anomalous zone challenges", "Steam devlog examples include timed survival, hidden-object digging, vanishing-item collection, passcode fragments, totems, stone buttons, timed rolls, and throwable-object interactions."],
    ["Anomalous zone hazards", "Steam devlog examples include lightning strikes, roaming tornadoes, fireballs, rolling obsidian spheres, and laser beams."],
    ["Artifact rarity tiers", "The anomalous-zone devlog lists Common, Uncommon, Rare, and Legendary artifact tiers."],
    ["Elemental status effects", "Launch devlog lists Stun, Fire, Frost, Poison, and Lightning status effects."],
    ["Character leveling", "Launch devlog says characters gain experience by being played and grow stronger over time."],
    ["Peaceful Mode", "Monster-free cozy mode described by Steam copy."],
    ["Survival loop", "Run structure: leave home, dig, fight, collect, return resources, and grow stronger."],
    ["Demo progress carryover", "Steam news states demo progress carries over to the full game."],
    ["Night Mode", "Post-launch update calls out Night Mode as an existing comfort option made more visible by attention badges."],
    ["UI Scale", "Post-launch update says the default UI scale and Steam Deck UI scale were increased."],
    ["Steam demo", `Public demo app ${DEMO_APP_ID}; free Windows demo linked to the full app.`],
    ["Full game", `Public full game app ${FULL_APP_ID}; released on Steam May 7, 2026.`]
  ];

  for (const [name, description] of glossaryTerms) {
    addUnique(
      datasets.glossary,
      entity({
        name,
        category: "glossary",
        short_description: description,
        effect: "Reference term.",
        verification_status: "Verified",
        sources: [fullStore, demoStore, steamNews, publisher],
        notes: "Glossary summary is paraphrased from public pages."
      })
    );
  }
}

async function buildPublicSources(fullDetails: Record<string, unknown>, demoDetails: Record<string, unknown>, fullReviews: Record<string, unknown>, demoReviews: Record<string, unknown>) {
  const fullData = (fullDetails[String(FULL_APP_ID)] as { data?: Record<string, unknown> } | undefined)?.data ?? {};
  const demoData = (demoDetails[String(DEMO_APP_ID)] as { data?: Record<string, unknown> } | undefined)?.data ?? {};
  const fullAchievements = asRecord(fullData.achievements);
  const rows = [
    {
      id: "steam-full-store",
      ...source("Steam full-game store page", urls.fullStore, `Official public Steam listing for app ${FULL_APP_ID}.`)
    },
    {
      id: "steam-demo-store",
      ...source("Steam demo store page", urls.demoStore, `Official public Steam listing for demo app ${DEMO_APP_ID}.`)
    },
    {
      id: "steam-full-appdetails",
      ...source("Steam full-game appdetails API", urls.fullAppDetails, "Public Steam store API data summarized without raw long description dumps.")
    },
    {
      id: "steam-demo-appdetails",
      ...source("Steam demo appdetails API", urls.demoAppDetails, "Public Steam store API data summarized without raw long description dumps.")
    },
    {
      id: "steam-full-achievements-page",
      ...source("Steam community achievements page", urls.achievementsPage, "Public display names, descriptions, icons, and current global percentages.")
    },
    {
      id: "steam-full-global-achievement-percentages",
      ...source("Steam global achievement percentages API", urls.achievementPercentages, "Public no-key endpoint for internal achievement ids and volatile global percentages.")
    },
    {
      id: "steam-news-devlogs",
      ...source("Steam community news/devlogs", urls.news, "Official public Steam news/devlog stream used for launch counts, named mechanics, named skills/tools/companions, update notes, and system descriptions.")
    },
    {
      id: "steam-release-date-news",
      ...source("Steam release-date news post", urls.news, "All-news page includes the public launch-count post: 10 playable frogs, 16 locations, 60+ skills/tools/attacks/companions, and demo progress carryover.")
    },
    {
      id: "steam-launch-devlog",
      ...source("Steam launch devlog", urls.news, "All-news page includes launch additions such as movement skills, robotic helpers, projectile skills, character leveling, artifact upgrades, status effects, roll upgrades, and skill banishing.")
    },
    {
      id: "steam-anomalous-zones-devlog",
      ...source("Steam anomalous zones devlog", urls.news, "All-news page includes anomalous-zone challenge types, hazards, Blue Gems, artifacts, and artifact rarity tiers.")
    },
    {
      id: "steam-snow-devlog",
      ...source("Steam snow systems devlog", urls.news, "All-news page includes snow heightmap behavior, snow density/layers, and named snow or ice tools.")
    },
    {
      id: "steam-post-launch-update",
      ...source("Steam first post-launch update", urls.news, "All-news page includes first update changes for readability, boss projectile speed, projectile defense skills, Zippy, early unlocks, location progression, and UI scale.")
    },
    {
      id: "steam-full-review-summary",
      ...source("Steam full-game review summary API", urls.fullReviews, `Summary fetched only; review text not redistributed. Current summary: ${JSON.stringify((fullReviews as { query_summary?: unknown }).query_summary ?? {})}.`, "medium")
    },
    {
      id: "steam-demo-review-summary",
      ...source("Steam demo review summary API", urls.demoReviews, `Summary fetched only; review text not redistributed. Current summary: ${JSON.stringify((demoReviews as { query_summary?: unknown }).query_summary ?? {})}.`, "medium")
    },
    {
      id: "steamdb-full",
      ...source("SteamDB full-game page", urls.steamDbFull, "Third-party corroboration for app metadata, changenumbers, technologies, depots, and timestamps.", "medium")
    },
    {
      id: "steamdb-demo",
      ...source("SteamDB demo page", urls.steamDbDemo, "Third-party corroboration for demo metadata, parent app, depot, build, and timestamps.", "medium")
    },
    {
      id: "digital-bandidos-page",
      ...source("Digital Bandidos game page", urls.publisherPage, "Publisher page for platforms, price, genre, and one-player listing.", "medium")
    }
  ];

  rows.push({
    id: "steam-full-appdetails-summary",
    ...source(
      "Steam full-game appdetails summary",
      urls.fullAppDetails,
      `Summarized facts: type=${String(fullData.type)}, name=${String(fullData.name)}, release=${JSON.stringify(fullData.release_date)}, achievements_total=${String(fullAchievements.total ?? "not listed")}, screenshots=${asArray(fullData.screenshots).length}, platforms=${JSON.stringify(fullData.platforms)}.`,
      "high"
    )
  });
  rows.push({
    id: "steam-demo-appdetails-summary",
    ...source(
      "Steam demo appdetails summary",
      urls.demoAppDetails,
      `Summarized facts: type=${String(demoData.type)}, name=${String(demoData.name)}, fullgame=${JSON.stringify(demoData.fullgame)}, release=${JSON.stringify(demoData.release_date)}, platforms=${JSON.stringify(demoData.platforms)}.`,
      "high"
    )
  });

  return rows;
}

function buildSteamSnapshot(args: {
  fullDetails: Record<string, unknown>;
  demoDetails: Record<string, unknown>;
  fullReviews: Record<string, unknown>;
  demoReviews: Record<string, unknown>;
  achievementRows: AchievementRow[];
  achievementPercentages: SteamAchievement[];
  demoAchievementPercentages: SteamAchievement[];
  demoAchievementPercentagesResult: FetchResult<{ achievementpercentages?: { achievements?: SteamAchievement[] } }>;
  newsFindings: SteamNewsFindings;
}): SteamSnapshot {
  const fullData = (args.fullDetails[String(FULL_APP_ID)] as { data?: Record<string, unknown> } | undefined)?.data ?? {};
  const demoData = (args.demoDetails[String(DEMO_APP_ID)] as { data?: Record<string, unknown> } | undefined)?.data ?? {};
  const sortedPercentages = [...args.achievementPercentages].sort((a, b) => Number.parseFloat(b.percent) - Number.parseFloat(a.percent));

  return {
    accessed_date: ACCESSED_DATE,
    generated_at: new Date().toISOString(),
    source_policy: [
      "Prefer official public Steam endpoints and pages for game metadata.",
      "Do not copy raw long descriptions, review text, proprietary assets, binaries, source code, or decompiled content.",
      "Treat prices, review counts, recommendations, player counts, and achievement percentages as volatile as-of metadata.",
      "Treat achievement names as public names; classify gameplay effects only when another source or safe local metadata confirms them."
    ],
    sources: {
      full_store: urls.fullStore,
      demo_store: urls.demoStore,
      full_appdetails: urls.fullAppDetails,
      demo_appdetails: urls.demoAppDetails,
      full_reviews: urls.fullReviews,
      demo_reviews: urls.demoReviews,
      full_achievements_page: urls.achievementsPage,
      full_global_achievement_percentages: urls.achievementPercentages,
      demo_global_achievement_percentages: urls.demoAchievementPercentages,
      steam_news_devlogs: urls.news,
      publisher_page: urls.publisherPage,
      steamdb_full: urls.steamDbFull,
      steamdb_demo: urls.steamDbDemo
    },
    apps: {
      full_game: summarizeSteamApp("full_game", FULL_APP_ID, urls.fullStore, urls.fullAppDetails, fullData),
      demo: summarizeSteamApp("demo", DEMO_APP_ID, urls.demoStore, urls.demoAppDetails, demoData)
    },
    reviews: {
      full_game: (args.fullReviews as { query_summary?: unknown }).query_summary ?? null,
      demo: (args.demoReviews as { query_summary?: unknown }).query_summary ?? null
    },
    achievements: {
      community_page_url: urls.achievementsPage,
      global_percentages_api_url: urls.achievementPercentages,
      demo_global_percentages_api_url: urls.demoAchievementPercentages,
      demo_global_percentages_api_status: args.demoAchievementPercentagesResult.status,
      demo_global_percentages_api_error: args.demoAchievementPercentagesResult.error,
      community_rows_count: args.achievementRows.length,
      full_game_api_ids_count: args.achievementPercentages.length,
      demo_api_ids_count: args.demoAchievementPercentages.length,
      highest_global_percentages: sortedPercentages.slice(0, 8),
      lowest_global_percentages: sortedPercentages.slice(-8).reverse(),
      notes: [
        "The full game has public achievement display rows and no-key global percentage data.",
        "The demo global percentage endpoint is recorded with its current HTTP status and currently contributes no achievement ids.",
        "Community-page percentages and API percentages can differ slightly due to cache timing or rounding."
      ]
    },
    public_gameplay_claims: [
      {
        claim: "The player controls Froggy in a snowy desert survival loop.",
        source_ids: ["steam-full-store", "steam-demo-store"],
        confidence: "high",
        wiki_targets: ["frogs", "maps", "glossary"],
        notes: "Public store copy supports the protagonist and setting; exact character roster remains unverified."
      },
      {
        claim: "Runs involve digging through snow, collecting resources, returning value home, and growing stronger.",
        source_ids: ["steam-full-store", "steam-demo-store"],
        confidence: "high",
        wiki_targets: ["guides", "tools", "items", "upgrades"],
        notes: "Use as high-level loop wording only; exact stats and route optimization need gameplay verification."
      },
      {
        claim: "Warmth/freezing is a survival pressure.",
        source_ids: ["steam-full-store", "steam-demo-store"],
        confidence: "high",
        wiki_targets: ["guides", "glossary", "upgrades"],
        notes: "Exact meter thresholds and upgrade effects remain unverified."
      },
      {
        claim: "Keys, treasure chests, artifacts, gems, traps, anomaly zones, bosses, and an escape door are public concepts.",
        source_ids: ["steam-full-store", "steam-demo-store", "steam-full-achievements-page"],
        confidence: "high",
        wiki_targets: ["items", "bosses", "glossary", "guides"],
        notes: "Use as entity scaffolding; do not invent quantities, costs, or drop rates."
      },
      {
        claim: "Peaceful Mode is public and described as monster-free.",
        source_ids: ["steam-full-store", "steam-demo-store"],
        confidence: "high",
        wiki_targets: ["guides", "glossary"],
        notes: "Mode-specific rewards, unlocks, and achievement eligibility still need verification."
      },
      {
        claim: "The full game exposes 42 public Steam achievements.",
        source_ids: ["steam-full-appdetails", "steam-full-achievements-page", "steam-full-global-achievement-percentages"],
        confidence: "high",
        wiki_targets: ["achievements", "unlocks"],
        notes: "Achievement percentages are volatile and should be refreshed before percentage-based claims."
      },
      {
        claim: "Steam news confirms 10 playable frogs, 16 locations, 60+ skills/tools/attacks/companions, and demo progress carryover.",
        source_ids: ["steam-release-date-news", "steam-news-devlogs"],
        confidence: "high",
        wiki_targets: ["frogs", "maps", "skills", "tools", "companions", "guides"],
        notes: "Use these as scope counts only; the complete named roster still needs verification."
      },
      {
        claim: "Steam devlogs confirm specific launch additions including Glider, Snowball Roll, Leap Chain, Delivery Bot, Flamethrower Bot, Scanner Drone, Piercing Icicles, Fireworks, and Snowball Volley.",
        source_ids: ["steam-launch-devlog", "steam-news-devlogs"],
        confidence: "high",
        wiki_targets: ["skills", "companions", "guides"],
        notes: "Names and broad categories are public; exact stats, rarity, and unlock requirements need gameplay verification."
      },
      {
        claim: "Steam devlogs confirm anomalous zones as short challenge areas with rewards including Blue Gems and artifacts in Common, Uncommon, Rare, and Legendary tiers.",
        source_ids: ["steam-anomalous-zones-devlog", "steam-news-devlogs"],
        confidence: "high",
        wiki_targets: ["items", "glossary", "guides"],
        notes: "Challenge examples are public; exact layouts, timers, and reward quantities need verification."
      },
      {
        claim: "Steam snow-system devlog confirms snow as an interactable heightmap-like material with density/layers and named digging or ice tools.",
        source_ids: ["steam-snow-devlog", "steam-news-devlogs"],
        confidence: "high",
        wiki_targets: ["tools", "glossary", "guides"],
        notes: "Use for mechanics scaffolding; exact tool stats and upgrade scaling need verification."
      },
      {
        claim: "The first post-launch Steam update confirms Zippy, Invincible Roll, Energy Wave, Destructive Field, Armor, and early location progression changes.",
        source_ids: ["steam-post-launch-update", "steam-news-devlogs"],
        confidence: "high",
        wiki_targets: ["frogs", "skills", "maps", "guides"],
        notes: "This is a post-launch state source and should be refreshed when later patch notes are added."
      }
    ],
    steam_news_findings: args.newsFindings,
    research_gaps: [
      "Exact character/frog roster beyond Froggy, Zippy, and the verified 10-playable-frog count.",
      "Named map/location roster, map unlock order beyond public thresholds/update notes, and location-specific boss names.",
      "Named enemy roster and enemy behavior.",
      "Exact stats, costs, cooldowns, drop rates, and upgrade tree order.",
      "Whether demo metadata differs from the released full game after SteamCMD/local file extraction works.",
      "Gameplay screenshots or short notes that can confirm inferred achievement-derived categories."
    ],
    refresh_commands: ["npm run fetch:steam", "npm run scan", "npm run validate", "npm run generate", "npm run build"]
  };
}

function addAchievementData(rows: AchievementRow[], percentages: SteamAchievement[]) {
  const percentageByComparableName = new Map(percentages.map((achievement) => [comparableAchievementName(achievement.name), achievement]));
  const achievementsSource = source("Steam community achievements page", urls.achievementsPage, "Public achievement display names and descriptions.");
  const percentSource = source("Steam global achievement percentages API", urls.achievementPercentages, "Public no-key endpoint with volatile global percentages.", "medium");
  const generatedEntities = new Map<string, string>();

  rows.forEach((row) => {
    const titleSlug = slugify(row.title);
    const internal = percentageByComparableName.get(comparableAchievementName(row.title));
    const id = titleSlug;
    const names = extractNamesFromAchievement(row.description);
    const related: string[] = [];

    for (const name of names) {
      const category = classifyName(name);
      const slug = slugify(name);
      related.push(slug);
      if (generatedEntities.has(slug)) continue;
      generatedEntities.set(slug, category);
      addUnique(
        datasets[category],
        entity({
          id: slug,
          name,
          category,
          short_description: `${name} is named in a public achievement condition.`,
          effect: "Needs verification.",
          unlock_method: "Needs verification.",
          verification_status: category === "companions" ? "Verified" : "Inferred",
          sources: [achievementsSource, inferredSource("Achievement condition classification", `Classified as ${category} from public achievement wording; exact in-game type needs verification.`)],
          notes: "Name is public; category/effect details may need gameplay or local metadata verification."
        })
      );
    }

    addUnique(
      datasets.achievements,
      entity({
        id,
        name: row.title,
        category: "achievements",
        short_description: row.description,
        effect: `Steam achievement condition: ${row.description}`,
        unlock_method: row.description,
        mode: "Full game.",
        related_entities: related,
        verification_status: "Verified",
        sources: [achievementsSource, percentSource],
        notes: "Global percentage is volatile; refresh before publishing exact percentage-driven claims.",
        extra: {
          steam_internal_name: internal?.name ?? null,
          steam_global_percent_api: internal?.percent ?? null,
          steam_community_percent: row.percent,
          icon_url: row.icon_url
        }
      })
    );
  });
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function buildPublicResearchMarkdown(args: {
  fullDetails: Record<string, unknown>;
  demoDetails: Record<string, unknown>;
  fullReviews: Record<string, unknown>;
  demoReviews: Record<string, unknown>;
  achievementRows: AchievementRow[];
  achievementPercentages: SteamAchievement[];
  demoAchievementPercentages: SteamAchievement[];
  demoAchievementPercentagesResult: FetchResult<{ achievementpercentages?: { achievements?: SteamAchievement[] } }>;
  newsFindings: SteamNewsFindings;
}) {
  const fullData = (args.fullDetails[String(FULL_APP_ID)] as { data?: Record<string, unknown> } | undefined)?.data ?? {};
  const demoData = (args.demoDetails[String(DEMO_APP_ID)] as { data?: Record<string, unknown> } | undefined)?.data ?? {};
  const fullSummary = (args.fullReviews as { query_summary?: Record<string, unknown> }).query_summary ?? {};
  const demoSummary = (args.demoReviews as { query_summary?: Record<string, unknown> }).query_summary ?? {};
  const fullScreenshots = Array.isArray(fullData.screenshots) ? fullData.screenshots.length : 0;
  const demoScreenshots = Array.isArray(demoData.screenshots) ? demoData.screenshots.length : 0;
  const fullLanguages = stripHtml(String(fullData.supported_languages ?? ""));
  const demoLanguages = stripHtml(String(demoData.supported_languages ?? ""));
  const fullPrice = asRecord(fullData.price_overview);
  const fullRecommendations = asRecord(fullData.recommendations);

  const lines = [
    "# Public Research",
    "",
    `Accessed: ${ACCESSED_DATE}`,
    "",
    "This note summarizes public metadata used to seed the wiki. It intentionally avoids raw long store-description dumps and raw review text.",
    "",
    "## High-Confidence Sources",
    "",
    `- Steam full-game store page: ${urls.fullStore}`,
    `- Steam demo store page: ${urls.demoStore}`,
    `- Steam appdetails API, full game: ${urls.fullAppDetails}`,
    `- Steam appdetails API, demo: ${urls.demoAppDetails}`,
    `- Steam community achievements page: ${urls.achievementsPage}`,
    `- Steam global achievement percentages API: ${urls.achievementPercentages}`,
    `- Steam community news/devlogs: ${urls.news}`,
    "",
    "## Game-Level Facts",
    "",
    `- Full game app ID: ${FULL_APP_ID}`,
    `- Demo app ID: ${DEMO_APP_ID}`,
    `- Full game title: ${String(fullData.name ?? "FROGGY HATES SNOW")}`,
    `- Demo title: ${String(demoData.name ?? "FROGGY HATES SNOW Demo")}`,
    `- Developer: ${Array.isArray(fullData.developers) ? fullData.developers.join(", ") : "CRYING BRICK"}`,
    `- Publisher: ${Array.isArray(fullData.publishers) ? fullData.publishers.join(", ") : "Digital Bandidos"}`,
    `- Full game release date: ${JSON.stringify(fullData.release_date ?? {})}`,
    `- Demo release date: ${JSON.stringify(demoData.release_date ?? {})}`,
    `- Platforms from Steam appdetails: full=${JSON.stringify(fullData.platforms ?? {})}; demo=${JSON.stringify(demoData.platforms ?? {})}`,
    `- Genres from Steam appdetails: ${JSON.stringify(fullData.genres ?? [])}`,
    `- Categories from Steam appdetails: ${JSON.stringify(fullData.categories ?? [])}`,
    `- Full game current US price from Steam appdetails: ${Object.keys(fullPrice).length > 0 ? JSON.stringify(fullPrice) : "not listed"}`,
    `- Full game Steam recommendations total from appdetails: ${String(fullRecommendations.total ?? "not listed")}`,
    `- Full game screenshots listed by appdetails: ${fullScreenshots}`,
    `- Demo screenshots listed by appdetails: ${demoScreenshots}`,
    `- Full-game languages: ${fullLanguages}`,
    `- Demo languages: ${demoLanguages}`,
    `- Playable frogs confirmed by Steam news/devlogs: ${args.newsFindings.playable_frogs_count}`,
    `- Locations confirmed by Steam news/devlogs: ${args.newsFindings.locations_count}`,
    `- Minimum combined skills/tools/attacks/companions confirmed by Steam news/devlogs: ${args.newsFindings.minimum_combined_skills_tools_attacks_companions}+`,
    `- Demo progress carryover confirmed by Steam news/devlogs: ${args.newsFindings.demo_progress_carries_over ? "yes" : "no"}`,
    "",
    "## Public Gameplay Concepts",
    "",
    "- Verified from official Steam copy: digging through snow, warmth/freezing as survival pressure, gems, keys, treasure chests, artifacts, anomaly zones, escape door, bosses, enemies, Peaceful Mode, upgrades, tools, companions, and a snowy-desert setting.",
    "- Verified from official Steam news/devlogs: 10 playable frogs, 16 locations, 60+ skills/tools/attacks/companions, demo progress carryover, launch movement/projectile skills, robotic helpers, elemental status effects, anomalous-zone rewards, snow heightmap behavior, and first post-launch update changes.",
    "- Verified named companions/tools/items from public copy or achievements include Penguin, Mole, Owl, Map, Shovel, Cart, Scanner, Locator, Pickaxe, Dynamite, Air Bomb, Flamethrower, Heater Sled, Gloves, Hot Tea, Energy Drink, Poison Flask, Frost Bomb, and Flashbang.",
    `- Steam news/devlog confirmed terms added to the wiki: ${args.newsFindings.confirmed_terms.join(", ")}.`,
    "- Exact stats, unlock costs, complete named map roster, named boss roster, named enemy roster, and the remaining frog/character roster remain Needs verification unless local metadata or gameplay notes confirm them.",
    "",
    "## Achievements",
    "",
    `- Public community page rows parsed: ${args.achievementRows.length}`,
    `- Public global achievement API ids parsed: ${args.achievementPercentages.length}`,
    `- Demo global achievement API status: ${args.demoAchievementPercentagesResult.status}${args.demoAchievementPercentagesResult.error ? ` (${args.demoAchievementPercentagesResult.error})` : ""}`,
    `- Demo global achievement API ids parsed: ${args.demoAchievementPercentages.length}`,
    "- Achievement percentages are volatile and may differ slightly by endpoint/cache. Use them as as-of metadata only.",
    "",
    "## Review Summaries",
    "",
    `- Full game review summary: ${JSON.stringify(fullSummary)}`,
    `- Demo review summary: ${JSON.stringify(demoSummary)}`,
    "",
    "## SteamCMD / Local Demo Acquisition Status",
    "",
    "- Homebrew SteamCMD was installed successfully.",
    "- Attempted command: `steamcmd +@sSteamCmdForcePlatformType windows +force_install_dir ./game-files +login anonymous +app_update 4037600 validate +quit`.",
    "- Result: blocked in this macOS environment. The command produced repeated Steam launch/assertion output and left `game-files/` empty.",
    "- A Docker SteamCMD fallback was attempted, but Docker/Rancher Desktop was not running, so the Docker API socket was unavailable.",
    "- SteamDB indicates demo app 4037600 has Windows 64-bit depot 4037601, total size about 822.98 MiB and download size about 365.64 MiB. This is third-party corroboration, not Valve-official metadata.",
    "",
    "## Cautions",
    "",
    "- Do not infer entity effects, unlock costs, or roster completeness from names alone.",
    "- Do not redistribute proprietary assets, binaries, source code, or large raw text excerpts from local game files.",
    "- Refresh prices, review counts, player counts, and achievement percentages before using them in visible copy."
  ];

  return `${lines.join("\n")}\n`;
}

async function main() {
  await mkdir(path.resolve("src/data"), { recursive: true });
  await mkdir(path.resolve("notes"), { recursive: true });
  seedCoreEntities();

  const [fullDetails, demoDetails, fullReviews, demoReviews, achievementPercentagesRaw, demoAchievementPercentagesResult, achievementsHtml, newsHtml] = await Promise.all([
    fetchJson<Record<string, unknown>>(urls.fullAppDetails),
    fetchJson<Record<string, unknown>>(urls.demoAppDetails),
    fetchJson<Record<string, unknown>>(urls.fullReviews),
    fetchJson<Record<string, unknown>>(urls.demoReviews),
    fetchJson<{ achievementpercentages?: { achievements?: SteamAchievement[] } }>(urls.achievementPercentages),
    fetchJsonResult<{ achievementpercentages?: { achievements?: SteamAchievement[] } }>(urls.demoAchievementPercentages),
    fetchText(urls.achievementsPage),
    fetchText(urls.news)
  ]);

  const achievementRows = parseAchievementRows(achievementsHtml);
  const achievementPercentages = achievementPercentagesRaw.achievementpercentages?.achievements ?? [];
  const demoAchievementPercentages = demoAchievementPercentagesResult.data?.achievementpercentages?.achievements ?? [];
  const newsFindings = extractSteamNewsFindings(newsHtml);
  addAchievementData(achievementRows, achievementPercentages);

  const publicSources = await buildPublicSources(fullDetails, demoDetails, fullReviews, demoReviews);
  await writeJson(path.resolve("src/data/public-sources.json"), publicSources);
  await writeJson(
    path.resolve("src/data/steam-snapshot.json"),
    buildSteamSnapshot({
      fullDetails,
      demoDetails,
      fullReviews,
      demoReviews,
      achievementRows,
      achievementPercentages,
      demoAchievementPercentages,
      demoAchievementPercentagesResult,
      newsFindings
    })
  );

  for (const dataset of REQUIRED_DATASETS) {
    await writeJson(path.resolve("src/data", `${dataset}.json`), [...datasets[dataset].values()].sort((a, b) => a.name.localeCompare(b.name)));
  }

  await writeFile(
    path.resolve("notes/public-research.md"),
    buildPublicResearchMarkdown({
      fullDetails,
      demoDetails,
      fullReviews,
      demoReviews,
      achievementRows,
      achievementPercentages,
      demoAchievementPercentages,
      demoAchievementPercentagesResult,
      newsFindings
    })
  );

  console.log(
    `Wrote public Steam research: ${achievementRows.length} achievement rows, ${achievementPercentages.length} full-game API percentage ids, ${demoAchievementPercentages.length} demo API ids, ${newsFindings.confirmed_terms.length} Steam news/devlog terms.`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
