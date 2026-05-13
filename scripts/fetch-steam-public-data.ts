import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { REQUIRED_DATASETS } from "./validate-data";

const FULL_APP_ID = 3232380;
const DEMO_APP_ID = 4037600;
const ACCESSED_DATE = new Date().toISOString().slice(0, 10);

type SourceType = "game_file" | "public_source" | "gameplay_note" | "inferred" | "unknown";
type VerificationStatus = "Verified" | "Inferred" | "Needs verification";
type Dataset = (typeof REQUIRED_DATASETS)[number];

type Source = {
  source_id: string;
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
  verified_fields: string[];
  unverified_fields: string[];
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

type AchievementMentionedEntity = {
  name: string;
  id: string;
  category: Dataset;
  certainty: "name_verified_category_verified" | "name_verified_category_inferred";
  notes: string;
};

type AchievementFact = {
  title: string;
  slug: string;
  description: string;
  steam_internal_name: string | null;
  steam_global_percent_api: string | null;
  steam_community_percent: string;
  mentioned_entities: AchievementMentionedEntity[];
  source_ids: string[];
  notes: string;
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
  api_url: string;
  news_item_count: number;
  playable_frogs_count: number;
  locations_count: number;
  minimum_combined_skills_tools_attacks_companions: number;
  demo_progress_carries_over: boolean;
  confirmed_terms: string[];
  news_items: SteamNewsItemSummary[];
  notes: string[];
};

type SteamNewsApiItem = {
  gid?: string;
  title?: string;
  url?: string;
  date?: number;
  author?: string;
  feedname?: string;
  contents?: string;
};

type SteamNewsApiResponse = {
  appnews?: {
    newsitems?: SteamNewsApiItem[];
  };
};

type SteamNewsItemSummary = {
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
    facts: AchievementFact[];
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
  newsApi: `https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=${FULL_APP_ID}&count=20&maxlength=50000&format=json`,
  steamDbFull: `https://steamdb.info/app/${FULL_APP_ID}/`,
  steamDbDemo: `https://steamdb.info/app/${DEMO_APP_ID}/`,
  publisherPage: "https://digitalbandidos.com/games/froggy-hates-snow/",
  xboxWireInterview: "https://news.xbox.com/en-us/2026/05/05/froggy-hates-snow-interview/"
};

const FIXED_SOURCE_IDS = new Map<string, string>([
  ["Steam full-game store page", "steam-full-store"],
  ["Steam demo store page", "steam-demo-store"],
  ["Steam full-game appdetails API", "steam-full-appdetails"],
  ["Steam demo appdetails API", "steam-demo-appdetails"],
  ["Steam community achievements page", "steam-full-achievements-page"],
  ["Steam global achievement percentages API", "steam-full-global-achievement-percentages"],
  ["Steam community news/devlogs", "steam-news-devlogs"],
  ["Steam News API", "steam-news-api"],
  ["Steam full-game review summary API", "steam-full-review-summary"],
  ["Steam demo review summary API", "steam-demo-review-summary"],
  ["SteamDB full-game page", "steamdb-full"],
  ["SteamDB demo page", "steamdb-demo"],
  ["Digital Bandidos game page", "digital-bandidos-page"],
  ["Xbox Wire developer interview", "xbox-wire-interview"],
  ["Steam full-game appdetails summary", "steam-full-appdetails-summary"],
  ["Steam demo appdetails summary", "steam-demo-appdetails-summary"]
]);

function sourceIdFor(label: string, pathOrUrl: string) {
  const fixed = FIXED_SOURCE_IDS.get(label);
  if (fixed) return fixed;
  if (pathOrUrl === urls.newsApi) return "steam-news-api";
  if (pathOrUrl === urls.xboxWireInterview) return "xbox-wire-interview";
  return slugify(label);
}

function source(label: string, pathOrUrl: string, notes: string, confidence: Source["confidence"] = "high", sourceId = sourceIdFor(label, pathOrUrl)): Source {
  return {
    source_id: sourceId,
    type: "public_source",
    path_or_url: pathOrUrl,
    label,
    confidence,
    notes
  };
}

function inferredSource(label: string, notes: string): Source {
  return {
    source_id: "achievement-condition-classification",
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

function stripSteamNews(value: string) {
  return stripHtml(value.replace(/\[\/?[^\]]+\]/g, " "));
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

function requireSteamAppDetails(response: Record<string, unknown>, appId: number, expectedType: string, expectedTitle: string, minimumScreenshots: number, minimumAchievements = 0) {
  const envelope = asRecord(response[String(appId)]);
  if (envelope.success !== true) {
    throw new Error(`Steam appdetails ${appId}: expected success=true, got ${String(envelope.success)}`);
  }

  const data = asRecord(envelope.data);
  if (String(data.name ?? "") !== expectedTitle) {
    throw new Error(`Steam appdetails ${appId}: expected title ${expectedTitle}, got ${String(data.name ?? "")}`);
  }
  if (String(data.type ?? "") !== expectedType) {
    throw new Error(`Steam appdetails ${appId}: expected type ${expectedType}, got ${String(data.type ?? "")}`);
  }
  if (asArray(data.screenshots).length < minimumScreenshots) {
    throw new Error(`Steam appdetails ${appId}: expected at least ${minimumScreenshots} screenshots, got ${asArray(data.screenshots).length}`);
  }

  const achievements = asRecord(data.achievements);
  if (minimumAchievements > 0 && numberOrNull(achievements.total) !== minimumAchievements) {
    throw new Error(`Steam appdetails ${appId}: expected ${minimumAchievements} achievements, got ${String(achievements.total ?? "missing")}`);
  }

  return data;
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
    screenshots: screenshots.map((screenshot) => {
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

const STEAM_NEWS_SOURCE_RULES: Array<{
  source_id: string;
  titlePattern: RegExp;
  required: boolean;
  requiredTerms: string[];
  wiki_targets: string[];
  verified_terms: string[];
  supports: string;
}> = [
  {
    source_id: "steam-post-launch-update",
    titlePattern: /first update|what comes next|incredible launch/i,
    required: true,
    requiredTerms: ["Zippy", "Invincible Roll", "Energy Wave", "Destructive Field", "Armor"],
    wiki_targets: ["frogs", "skills", "maps", "guides", "glossary"],
    verified_terms: ["Zippy", "Invincible Roll", "Energy Wave", "Destructive Field", "Armor", "Night Mode", "UI Scale"],
    supports: "First post-launch update with Zippy, projectile-defense skills, early unlock/progression adjustments, Night Mode visibility, and UI scale changes."
  },
  {
    source_id: "steam-launch-news",
    titlePattern: /out now/i,
    required: false,
    requiredTerms: ["live"],
    wiki_targets: ["glossary", "guides"],
    verified_terms: ["full game launch"],
    supports: "Launch announcement for the released full game."
  },
  {
    source_id: "steam-launch-devlog",
    titlePattern: /devlog #7|what'?s new for launch/i,
    required: true,
    requiredTerms: ["Glider", "Snowball Roll", "Leap Chain", "Delivery Bot", "Flamethrower Bot", "Scanner Drone", "Piercing Icicles", "Fireworks", "Snowball Volley"],
    wiki_targets: ["skills", "companions", "upgrades", "glossary", "guides"],
    verified_terms: [
      "Glider",
      "Snowball Roll",
      "Leap Chain",
      "Delivery Bot",
      "Flamethrower Bot",
      "Scanner Drone",
      "Piercing Icicles",
      "Fireworks",
      "Snowball Volley",
      "Skill Banishing",
      "Stun",
      "Fire",
      "Frost",
      "Poison",
      "Lightning"
    ],
    supports: "Launch devlog naming movement skills, projectile skills, robotic helpers, status effects, and skill-management systems."
  },
  {
    source_id: "steam-anomalous-zones-devlog",
    titlePattern: /devlog #6|anomalous zones/i,
    required: true,
    requiredTerms: ["Anomalous Zones", "Blue Gems", "Common", "Uncommon", "Rare", "Legendary"],
    wiki_targets: ["items", "glossary", "guides"],
    verified_terms: ["Anomalous Zones", "Blue Gems", "Common artifacts", "Uncommon artifacts", "Rare artifacts", "Legendary artifacts"],
    supports: "Anomalous-zone devlog with challenge examples, hazards, Blue Gems, artifacts, and artifact rarity tiers."
  },
  {
    source_id: "steam-release-date-news",
    titlePattern: /release date revealed/i,
    required: true,
    requiredTerms: ["10 playable frogs", "16", "60+", "progress"],
    wiki_targets: ["frogs", "maps", "skills", "tools", "companions", "guides"],
    verified_terms: ["10 playable frogs", "16 locations", "60+ skills/tools/attacks/companions", "demo progress carryover"],
    supports: "Release-date post with launch scope counts and demo progress carryover."
  },
  {
    source_id: "steam-snow-devlog",
    titlePattern: /devlog #5|how snow works/i,
    required: true,
    requiredTerms: ["Snow digging is the core mechanic", "heightmap", "layers", "Dynamite", "Air Bomb", "Snowblower", "Flamethrower"],
    wiki_targets: ["tools", "glossary", "guides"],
    verified_terms: ["heightmap snow", "snow layers", "Dynamite", "Air Bomb", "Snowblower", "Flamethrower"],
    supports: "Snow-system devlog explaining snow interaction, density/layers, and named snow/ice tools."
  },
  {
    source_id: "steam-demo-overhaul-news",
    titlePattern: /demo is back|major overhaul/i,
    required: false,
    requiredTerms: ["Puff", "ranged poison spit", "Blue Gems", "unlock new characters, abilities, and locations"],
    wiki_targets: ["frogs", "items", "guides", "glossary"],
    verified_terms: ["Puff", "ranged poison spit", "quests", "Blue Gems", "abilities", "locations", "first two arenas"],
    supports: "Updated-demo announcement describing Puff, ranged poison spit, quest-based progress, Blue Gems, and unlocks for characters, abilities, and locations."
  },
  {
    source_id: "steam-next-demo-devlog",
    titlePattern: /devlog #3|next demo/i,
    required: true,
    requiredTerms: ["ten playable frog characters", "unique specialization", "main attack", "starting skillset", "blue gems"],
    wiki_targets: ["frogs", "skills", "items", "glossary", "guides"],
    verified_terms: [
      "10 playable frog characters",
      "unique specialization",
      "main attack",
      "starting skillset",
      "tongue attacks",
      "spits",
      "snow minigun",
      "electric staff",
      "hockey stick",
      "Blue Gems",
      "quest-based meta-progression"
    ],
    supports: "Pre-demo devlog describing ten frogs, unique specializations, main attacks, starting skillsets, and Blue Gem/quest meta-progression."
  },
  {
    source_id: "steam-demo-update-devlog",
    titlePattern: /devlog #2|quick update.*demo/i,
    required: false,
    requiredTerms: ["quest-based meta-progression", "ten playable characters", "unique skin", "skills", "main attack"],
    wiki_targets: ["frogs", "skills", "glossary"],
    verified_terms: ["quest-based meta-progression", "10 playable characters", "unique skin", "main attack"],
    supports: "Demo update devlog previewing quest-based meta-progression and ten planned characters with unique skins, skills, and main attacks."
  },
  {
    source_id: "steam-developer-intro-devlog",
    titlePattern: /devlog #1|meet the developer/i,
    required: false,
    requiredTerms: ["interactive snow", "digging"],
    wiki_targets: ["glossary", "guides"],
    verified_terms: ["interactive snow", "digging"],
    supports: "Developer introduction describing the game's interactive snow and digging ideas."
  }
];

function buildSteamNewsItems(response: SteamNewsApiResponse): SteamNewsItemSummary[] {
  const items = response.appnews?.newsitems ?? [];
  const summaries: SteamNewsItemSummary[] = [];
  const missingRequired: string[] = [];

  for (const rule of STEAM_NEWS_SOURCE_RULES) {
    const item = items.find((candidate) => rule.titlePattern.test(String(candidate.title ?? "")));
    if (!item) {
      if (rule.required) missingRequired.push(rule.source_id);
      continue;
    }

    const text = stripSteamNews(String(item.contents ?? ""));
    const missingTerms = rule.requiredTerms.filter((term) => !text.toLowerCase().includes(term.toLowerCase()));
    if (missingTerms.length > 0) {
      throw new Error(`Steam news item ${rule.source_id} is missing expected public markers: ${missingTerms.join(", ")}`);
    }

    summaries.push({
      source_id: rule.source_id,
      gid: String(item.gid ?? ""),
      title: String(item.title ?? rule.source_id),
      date: item.date ? new Date(item.date * 1000).toISOString().slice(0, 10) : "unknown",
      url: String(item.url ?? urls.news),
      feedname: String(item.feedname ?? ""),
      author: String(item.author ?? ""),
      wiki_targets: rule.wiki_targets,
      verified_terms: rule.verified_terms,
      supports: rule.supports
    });
  }

  if (missingRequired.length > 0) {
    throw new Error(`Steam News API is missing required public source items: ${missingRequired.join(", ")}`);
  }

  return summaries.sort((a, b) => b.date.localeCompare(a.date));
}

function extractSteamNewsFindings(html: string, newsItems: SteamNewsItemSummary[]): SteamNewsFindings {
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

  const requiredNewsSources = ["steam-post-launch-update", "steam-launch-devlog", "steam-anomalous-zones-devlog", "steam-release-date-news", "steam-snow-devlog", "steam-next-demo-devlog"];
  const newsSourceIds = new Set(newsItems.map((item) => item.source_id));
  const missingNewsSources = requiredNewsSources.filter((sourceId) => !newsSourceIds.has(sourceId));
  if (missingNewsSources.length > 0) {
    throw new Error(`Steam news direct-source map is missing expected public source ids: ${missingNewsSources.join(", ")}`);
  }

  const confirmedTerms = [
      "Zippy",
      "Puff",
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
      "ranged poison spit",
      "Drill",
    "Salt Sack",
    "Snowblower",
    "Blue Gems",
    "Common artifacts",
    "Uncommon artifacts",
    "Rare artifacts",
    "Legendary artifacts",
    ...newsItems.flatMap((item) => item.verified_terms)
  ];

  return {
    source_url: urls.news,
    api_url: urls.newsApi,
    news_item_count: newsItems.length,
    playable_frogs_count: 10,
    locations_count: 16,
    minimum_combined_skills_tools_attacks_companions: 60,
    demo_progress_carries_over: true,
    confirmed_terms: [...new Set(confirmedTerms)],
    news_items: newsItems,
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
  verified_fields?: string[];
  unverified_fields?: string[];
  extra?: Record<string, unknown>;
}): Entity {
  const id = base.id ?? slugify(base.name);
  const unverifiedFields = base.unverified_fields ?? [
    ...(base.effect?.toLowerCase().includes("needs verification") ?? true ? ["effect"] : []),
    ...(base.unlock_method?.toLowerCase().includes("needs verification") ?? true ? ["unlock_method"] : []),
    ...(base.cost?.toLowerCase().includes("needs verification") ?? true ? ["cost"] : []),
    ...(base.mode?.toLowerCase().includes("needs verification") ?? true ? ["mode"] : [])
  ];
  const verifiedFields = base.verified_fields ?? [
    "name",
    "category",
    ...(unverifiedFields.includes("effect") ? [] : ["effect"]),
    ...(unverifiedFields.includes("unlock_method") ? [] : ["unlock_method"]),
    ...(unverifiedFields.includes("cost") ? [] : ["cost"]),
    ...(unverifiedFields.includes("mode") ? [] : ["mode"])
  ];
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
    verified_fields: [...new Set(verifiedFields)],
    unverified_fields: [...new Set(unverifiedFields)],
    ...(base.extra ?? {})
  };
}

function addUnique(map: Map<string, Entity>, item: Entity) {
  if (!map.has(item.id)) map.set(item.id, item);
}

function classifyName(name: string): Dataset {
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

function achievementPercentageByComparableName(percentages: SteamAchievement[]) {
  return new Map(percentages.map((achievement) => [comparableAchievementName(achievement.name), achievement]));
}

function buildAchievementFacts(rows: AchievementRow[], percentages: SteamAchievement[]): AchievementFact[] {
  const percentageByComparableName = achievementPercentageByComparableName(percentages);

  return rows.map((row) => {
    const mentioned_entities = extractNamesFromAchievement(row.description).map((name) => {
      const category = classifyName(name);
      const id = slugify(name);
      const certainty: AchievementMentionedEntity["certainty"] =
        category === "companions" ? "name_verified_category_verified" : "name_verified_category_inferred";

      return {
        name,
        id,
        category,
        certainty,
        notes:
          certainty === "name_verified_category_verified"
            ? "Achievement wording names this as part of a companion loadout condition."
            : "Achievement wording verifies the name appears in a condition; gameplay type/effect still needs confirmation."
      };
    });
    const internal = percentageByComparableName.get(comparableAchievementName(row.title));

    return {
      title: row.title,
      slug: slugify(row.title),
      description: row.description,
      steam_internal_name: internal?.name ?? null,
      steam_global_percent_api: internal?.percent ?? null,
      steam_community_percent: row.percent,
      mentioned_entities,
      source_ids: ["steam-full-achievements-page", "steam-full-global-achievement-percentages"],
      notes:
        mentioned_entities.length > 0
          ? "Use mentioned entities as source-backed names only unless another source verifies behavior."
          : "Achievement row verifies this progression/milestone condition; no named loadout entities were parsed from it."
    };
  });
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
  const xboxWire = source("Xbox Wire developer interview", urls.xboxWireInterview, "Developer interview corroborating launch counts, snow tech, skill/tool variety, companions, and Peaceful Mode.", "medium");

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
      short_description: "Steam news confirms 10 playable frogs; devlogs say each frog has its own specialization, main attack, and starting skillset.",
      effect: "The full roster has 10 playable frogs with distinct public loadout concepts; each name, stat line, and exact attack behavior still needs verification unless listed separately.",
      unlock_method: "Achievements mention unlocking 1, 3, and 9 characters.",
      verification_status: "Verified",
      sources: [steamNews, source("Steam community achievements page", urls.achievementsPage, "Public achievement names and descriptions."), xboxWire],
      notes: "Public devlogs mention examples such as tongue attacks, spits, snow minigun, electric staff, and hockey stick, but do not map them to named frogs in the available source pass."
    })
  );

  addUnique(
    datasets.frogs,
    entity({
      name: "Unnamed frog roster slots",
      category: "frogs",
      short_description: "Steam/Xbox public sources confirm 10 playable frogs, but this source pass has verified only Froggy, Puff, and Zippy by name.",
      effect: "Seven playable frog names, stat lines, main attacks, and starting skillsets still need direct verification.",
      unlock_method: "Needs verification.",
      verification_status: "Needs verification",
      sources: [steamNews, xboxWire],
      notes: "Tracker entry for missing roster coverage; do not convert the remaining slots into named pages until a source names them."
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
    datasets.frogs,
    entity({
      name: "Puff",
      category: "frogs",
      short_description: "The Steam demo overhaul announcement identifies Puff as a playable character added to the updated demo.",
      effect: "The announcement says Puff has a ranged poison spit attack.",
      unlock_method: "The announcement says Puff can be unlocked in the updated demo; exact unlock condition needs verification.",
      mode: "Updated Steam demo; full-game status needs verification.",
      related_entities: ["poison-infusion"],
      verification_status: "Verified",
      sources: [source("The Froggy Hates Snow demo is back – and it’s had a major overhaul", "https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1823825466505761", "2026-02-09 updated-demo announcement.", "high", "steam-demo-overhaul-news")],
      notes: "Exact full-game stats, starting skillset, and full-game unlock cost need gameplay or safe metadata verification."
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
      name: "Unnamed location roster slots",
      category: "maps",
      short_description: "Steam/Xbox public sources confirm 16 locations/maps, but the current safe source pass has not verified individual location names.",
      effect: "Location names, location order, completion requirements, and boss links still need direct verification.",
      unlock_method: "Achievements mention unlock thresholds at 1, 5, and 15 locations.",
      verification_status: "Needs verification",
      sources: [steamNews, source("Steam community achievements page", urls.achievementsPage, "Public location unlock/completion achievement names and descriptions."), xboxWire],
      notes: "Tracker entry for missing map roster coverage; individual location pages should be added only after names are sourced."
    })
  );

  addUnique(
    datasets.maps,
    entity({
      name: "Location unlock pacing",
      category: "maps",
      short_description: "The first post-launch Steam update describes changed location unlock pacing for early and later locations.",
      effect: "The update says the first five locations unlock after one successful run, while Location 7 onward requires two completed runs by boss defeat or escape.",
      unlock_method: "Progress by completing runs.",
      mode: "Full game post-launch state.",
      verification_status: "Verified",
      sources: [source("Thank You for an Incredible Launch — First Update and What Comes Next", "https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1832065502824701", "2026-05-12 first post-launch update.", "high", "steam-post-launch-update")],
      notes: "This is progression metadata, not an individual map name."
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

  addUnique(
    datasets.maps,
    entity({
      name: "Points of interest",
      category: "maps",
      short_description: "Steam devlog #3 describes richer location points of interest in the updated demo/full-game direction.",
      effect: "Examples include a crashed satellite or UFO, a school bus in snow, a phone booth, and theme-specific structures for forest, East Asia-inspired, and desert locations.",
      unlock_method: "Needs verification.",
      mode: "Updated demo/full-game direction from public devlog.",
      verification_status: "Verified",
      sources: [source("Devlog #3: What to expect from the next demo", "https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1823825466494740", "2026-02-04 pre-demo devlog.", "high", "steam-next-demo-devlog")],
      notes: "These are point-of-interest and theme examples, not confirmed individual map names."
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
    ["Blue Gems", "Meta currency granted by anomalous zones and described in public demo/devlog posts as unlocking characters, abilities, and locations."],
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
      name: "Boss projectile speed tuning",
      category: "bosses",
      short_description: "The first post-launch Steam update records boss projectile speed reductions on lower difficulties.",
      effect: "Post-launch update says boss projectile speeds were reduced by 30% on Easy and 15% on Medium.",
      mode: "Full game post-launch state.",
      verification_status: "Verified",
      sources: [source("Thank You for an Incredible Launch — First Update and What Comes Next", "https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1832065502824701", "2026-05-12 first post-launch update.", "high", "steam-post-launch-update")],
      notes: "This entry tracks patch-state boss behavior, not a named boss."
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
    ["Character specializations", "Demo/devlog posts say the ten playable frogs have unique specializations, main attacks, and starting skillsets."],
    ["Character main attacks", "Demo/devlog examples include tongue attacks, spits, snow minigun, electric staff, and hockey stick."],
    ["Core attacks", "Launch devlog examples include tongue, spit, and baseball bat style core attacks, while the updated demo announcement identifies Puff's ranged poison spit."],
    ["Attacks", "The public Steam release-scope wording counts attacks alongside skills, tools, and companions; this wiki currently folds attack-style facts into Skills and Glossary until a standalone attack roster is sourced."],
    ["Quest-based meta-progression", "Demo/devlog posts describe quests and Blue Gems unlocking characters, abilities, and locations."],
    ["Local metadata unavailable", "The local game-files scan currently found zero readable files, so the wiki is populated from public sources until SteamCMD/local extraction succeeds."],
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

async function buildPublicSources(fullDetails: Record<string, unknown>, demoDetails: Record<string, unknown>, fullReviews: Record<string, unknown>, demoReviews: Record<string, unknown>, newsItems: SteamNewsItemSummary[]) {
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
      id: "steam-news-api",
      ...source("Steam News API", urls.newsApi, "Public Steam News API used to map individual news/devlog posts to direct source records.")
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
    },
    {
      id: "xbox-wire-interview",
      ...source("Xbox Wire developer interview", urls.xboxWireInterview, "Public developer interview covering solo developer context, launch scope counts, snow technology, skill/tool variety, companions, and Peaceful Mode.", "medium")
    },
    {
      id: "achievement-condition-classification",
      ...inferredSource("Achievement condition classification", "Local classification of public achievement loadout names into wiki categories; exact in-game type and effect still need gameplay or safe metadata verification.")
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

  for (const item of newsItems) {
    rows.push({
      id: item.source_id,
      ...source(item.title, item.url, `${item.date}: ${item.supports}`, "high", item.source_id)
    });
  }

  return rows;
}

function buildSteamSnapshot(args: {
  fullDetails: Record<string, unknown>;
  demoDetails: Record<string, unknown>;
  fullReviews: Record<string, unknown>;
  demoReviews: Record<string, unknown>;
  achievementRows: AchievementRow[];
  achievementPercentages: SteamAchievement[];
  achievementFacts: AchievementFact[];
  demoAchievementPercentages: SteamAchievement[];
  demoAchievementPercentagesResult: FetchResult<{ achievementpercentages?: { achievements?: SteamAchievement[] } }>;
  newsFindings: SteamNewsFindings;
  newsItems: SteamNewsItemSummary[];
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
      steam_news_api: urls.newsApi,
      publisher_page: urls.publisherPage,
      xbox_wire_interview: urls.xboxWireInterview,
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
      facts: args.achievementFacts,
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
        source_ids: ["steam-release-date-news", "steam-news-devlogs", "steam-news-api"],
        confidence: "high",
        wiki_targets: ["frogs", "maps", "skills", "tools", "companions", "guides"],
        notes: "Use these as scope counts only; the complete named roster still needs verification."
      },
      {
        claim: "Steam devlogs say the ten playable frogs have unique specializations, main attacks, and starting skillsets, with public examples including tongue attacks, spits, snow minigun, electric staff, and hockey stick.",
        source_ids: ["steam-next-demo-devlog", "steam-demo-update-devlog", "xbox-wire-interview"],
        confidence: "high",
        wiki_targets: ["frogs", "skills", "glossary"],
        notes: "Examples are public, but exact character-to-attack mapping still needs gameplay or safe local metadata verification."
      },
      {
        claim: "Steam demo/devlog posts describe Puff, quest-based meta-progression, and Blue Gems as unlock resources for characters, abilities, and locations.",
        source_ids: ["steam-demo-overhaul-news", "steam-next-demo-devlog", "steam-anomalous-zones-devlog"],
        confidence: "high",
        wiki_targets: ["frogs", "items", "guides", "glossary"],
        notes: "Exact quest names, Blue Gem costs, and unlock order still need verification."
      },
      {
        claim: "An Xbox Wire developer interview corroborates 16 maps, ten frogs, more than 60 tools/skills/companions, and companion roles including digging, gem collection, and environment scanning.",
        source_ids: ["xbox-wire-interview"],
        confidence: "medium",
        wiki_targets: ["frogs", "maps", "tools", "companions", "guides"],
        notes: "Use as an official interview cross-check behind primary Steam sources."
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
      "Exact character/frog roster beyond Froggy, Puff, Zippy, and the verified 10-playable-frog count, including which frog uses each public main-attack example.",
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
  const percentageByComparableName = achievementPercentageByComparableName(percentages);
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
  newsItems: SteamNewsItemSummary[];
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
    `- Steam News API: ${urls.newsApi}`,
    `- Xbox Wire developer interview: ${urls.xboxWireInterview}`,
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
    "- Verified from official Steam news/devlogs: 10 playable frogs, 16 locations, 60+ skills/tools/attacks/companions, demo progress carryover, launch movement/projectile skills, robotic helpers, elemental status effects, anomalous-zone rewards, snow heightmap behavior, character main-attack examples, quest-based meta-progression, Blue Gem unlock scope, and first post-launch update changes.",
    "- Corroborated by Xbox Wire developer interview: 10 frogs, 16 maps, 60+ tools/skills/companions, snow heightmap-style technology, companion roles, and Peaceful Mode purpose.",
    "- Verified named companions/tools/items from public copy or achievements include Penguin, Mole, Owl, Map, Shovel, Cart, Scanner, Locator, Pickaxe, Dynamite, Air Bomb, Flamethrower, Heater Sled, Gloves, Hot Tea, Energy Drink, Poison Flask, Frost Bomb, and Flashbang.",
    `- Steam news/devlog confirmed terms added to the wiki: ${args.newsFindings.confirmed_terms.join(", ")}.`,
    "- Exact stats, unlock costs, complete named map roster, named boss roster, named enemy roster, and the remaining frog/character roster remain Needs verification unless local metadata or gameplay notes confirm them.",
    "",
    "## Steam News / Devlog Source Items",
    "",
    `- Direct news/devlog records parsed from Steam News API: ${args.newsFindings.news_item_count}`,
    ...args.newsItems.map((item) => `- ${item.date} - ${item.title}: ${item.url} (${item.supports})`),
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

  const [fullDetails, demoDetails, fullReviews, demoReviews, achievementPercentagesRaw, demoAchievementPercentagesResult, achievementsHtml, newsHtml, newsApiRaw] = await Promise.all([
    fetchJson<Record<string, unknown>>(urls.fullAppDetails),
    fetchJson<Record<string, unknown>>(urls.demoAppDetails),
    fetchJson<Record<string, unknown>>(urls.fullReviews),
    fetchJson<Record<string, unknown>>(urls.demoReviews),
    fetchJson<{ achievementpercentages?: { achievements?: SteamAchievement[] } }>(urls.achievementPercentages),
    fetchJsonResult<{ achievementpercentages?: { achievements?: SteamAchievement[] } }>(urls.demoAchievementPercentages),
    fetchText(urls.achievementsPage),
    fetchText(urls.news),
    fetchJson<SteamNewsApiResponse>(urls.newsApi)
  ]);

  requireSteamAppDetails(fullDetails, FULL_APP_ID, "game", "FROGGY HATES SNOW", 10, 42);
  requireSteamAppDetails(demoDetails, DEMO_APP_ID, "demo", "FROGGY HATES SNOW Demo", 8);

  const achievementRows = parseAchievementRows(achievementsHtml);
  const achievementPercentages = achievementPercentagesRaw.achievementpercentages?.achievements ?? [];
  const demoAchievementPercentages = demoAchievementPercentagesResult.data?.achievementpercentages?.achievements ?? [];
  if (achievementRows.length !== 42) {
    throw new Error(`Steam achievements page: expected 42 rows, got ${achievementRows.length}`);
  }
  if (achievementPercentages.length !== 42) {
    throw new Error(`Steam global achievement percentages API: expected 42 ids, got ${achievementPercentages.length}`);
  }
  const achievementFacts = buildAchievementFacts(achievementRows, achievementPercentages);
  const unmatchedAchievements = achievementFacts.filter((fact) => !fact.steam_internal_name);
  if (unmatchedAchievements.length > 0) {
    throw new Error(`Steam achievement fact matrix could not map community rows to API ids: ${unmatchedAchievements.map((fact) => fact.title).join(", ")}`);
  }
  const duplicateAchievementSlugs = achievementFacts
    .map((fact) => fact.slug)
    .filter((slug, index, slugs) => slugs.indexOf(slug) !== index);
  if (duplicateAchievementSlugs.length > 0) {
    throw new Error(`Steam achievement fact matrix has duplicate slugs: ${[...new Set(duplicateAchievementSlugs)].join(", ")}`);
  }
  const newsItems = buildSteamNewsItems(newsApiRaw);
  const newsFindings = extractSteamNewsFindings(newsHtml, newsItems);
  addAchievementData(achievementRows, achievementPercentages);

  const publicSources = await buildPublicSources(fullDetails, demoDetails, fullReviews, demoReviews, newsItems);
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
      achievementFacts,
      demoAchievementPercentages,
      demoAchievementPercentagesResult,
      newsFindings,
      newsItems
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
      newsFindings,
      newsItems
    })
  );

  console.log(
    `Wrote public Steam research: ${achievementRows.length} achievement rows, ${achievementPercentages.length} full-game API percentage ids, ${demoAchievementPercentages.length} demo API ids, ${newsFindings.confirmed_terms.length} Steam news/devlog terms across ${newsFindings.news_item_count} direct news items.`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
