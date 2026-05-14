import { access, mkdir, readFile, readdir, stat, writeFile, lstat } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const READABLE_EXTENSIONS = new Set([".json", ".xml", ".yaml", ".yml", ".csv", ".txt", ".ini", ".cfg", ".toml", ".md"]);
const OBVIOUS_BINARY_EXTENSIONS = new Set([
  ".exe",
  ".dll",
  ".pdb",
  ".bundle",
  ".assets",
  ".resource",
  ".resS",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".mp3",
  ".ogg",
  ".wav",
  ".bank",
  ".mp4",
  ".webm",
  ".unity3d",
  ".dat",
  ".bin"
]);

const MAX_READ_BYTES = 256 * 1024;
const execFileAsync = promisify(execFile);

export type ScanOptions = {
  gameFilesDir?: string;
  notesDir?: string;
  enablePythonExtractors?: boolean;
};

type ReadableFile = {
  relative_path: string;
  extension: string;
  size_bytes: number;
  detected_keys: string[];
  short_labels: string[];
  notes: string;
};

type SkippedFile = {
  relative_path: string;
  extension: string;
  size_bytes?: number;
  reason: string;
};

type LocalizedSkill = {
  id: string;
  name: string;
  description: string;
  source_keys: string[];
};

type LocalizedCharacter = {
  id: string;
  name: string;
  specialty: string;
  source_keys: string[];
};

type LocalGameData = {
  build: {
    app_id: string | null;
    app_name: string | null;
    build_id: string | null;
    app_info_name: string | null;
    build_target: string | null;
    addressables_version: string | null;
    locator_id: string | null;
  };
  addressables: {
    catalog_present: boolean;
    internal_id_count: number;
    scenes: string[];
    level_object_prefabs_count: number;
    level_object_groups: Array<{ group: string; count: number; examples: string[] }>;
  };
  localization: {
    english_pairs_count: number;
    prefix_counts: Record<string, number>;
    languages_seen: string[];
    skills: LocalizedSkill[];
    characters: LocalizedCharacter[];
    locations: Array<{ id: string; name: string; source_key: string }>;
    artifacts: Array<{ id: string; name: string; source_key: string }>;
    stats: Array<{ id: string; name: string; source_key: string }>;
    resources: Array<{ id: string; name: string; source_key: string }>;
    quests: Array<{ id: string; text: string; source_key: string }>;
    events: Array<{ id: string; title: string; body: string; source_keys: string[] }>;
    rarities: Array<{ id: string; name: string; source_key: string }>;
    end_states: Array<{ id: string; name: string; source_key: string }>;
    source_paths: string[];
  };
  managed_code: {
    source_path: string | null;
    detected_type_names: string[];
    detected_markers: string[];
    enum_groups?: Array<{ name: string; owner?: string | null; display_name?: string; value_count: number; values: string[]; value_map?: Array<{ name: string; value: unknown }>; truncated?: boolean }>;
    scriptable_object_types?: Array<{ name: string; owner?: string | null; display_name?: string; fields: string[]; field_count: number; truncated?: boolean }>;
    important_type_fields?: Array<{ name: string; owner?: string | null; display_name?: string; extends?: string; fields: string[]; field_count: number; truncated?: boolean }>;
    important_type_names?: string[];
    type_counts?: Record<string, number>;
    extractor_errors?: string[];
  };
  serialized_assets: {
    object_counts?: Array<{ path: string; objects: number; top_types: Array<{ type: string; count: number }> }>;
    collectible_lists?: Array<{ name: string; source_path: string; items: Array<{ name: string; type_id?: unknown; type?: unknown; count: unknown }>; item_count: number }>;
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
    stripped_mono_behaviours?: {
      summary?: Record<string, unknown>;
      script_counts?: Array<Record<string, unknown>>;
      core_counts?: Record<string, number>;
      characters?: Array<Record<string, unknown>>;
      locations?: Array<Record<string, unknown>>;
      artifacts?: Array<Record<string, unknown>>;
      quest_templates?: Array<Record<string, unknown>>;
      achievement_conditions?: Array<Record<string, unknown>>;
      game_modes?: Array<Record<string, unknown>>;
      difficulty_levels?: Array<Record<string, unknown>>;
      stat_modifiers?: Array<Record<string, unknown>>;
      rarity_tables?: Array<Record<string, unknown>>;
      upgrade_assets?: Array<Record<string, unknown>>;
      status_effect_upgrades?: Array<Record<string, unknown>>;
      enemy_component_payloads?: Array<Record<string, unknown>>;
      enemy_wave_data?: Array<Record<string, unknown>>;
      enemy_arena_spawner_data?: Array<Record<string, unknown>>;
      level_object_spawner_data?: Array<Record<string, unknown>>;
      level_object_preset_data?: Array<Record<string, unknown>>;
      terrain_height_data?: Array<Record<string, unknown>>;
      terrain_texture_data?: Array<Record<string, unknown>>;
      raw_parse_warnings?: string[];
      parse_errors?: string[];
    };
    extractor_errors?: string[];
  };
};

export type ScanResult = {
  generated_at: string;
  gameFilesPresent: boolean;
  gameFilesContainFiles: boolean;
  root: string;
  rules: string[];
  filesScanned: number;
  directoriesScanned: number;
  extension_counts: Record<string, number>;
  top_level_entries: string[];
  readable_files: ReadableFile[];
  skipped_files: SkippedFile[];
  local_game_data?: LocalGameData;
};

function normalizeExt(filePath: string) {
  return path.extname(filePath).toLowerCase() || "(none)";
}

function safeRelative(root: string, filePath: string) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanLabel(value: string) {
  return decodeEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectJsonMetadata(value: unknown, keys: Set<string>, labels: Set<string>, depth = 0) {
  if (depth > 6 || labels.size >= 40 || keys.size >= 120) return;

  if (Array.isArray(value)) {
    for (const item of value.slice(0, 100)) collectJsonMetadata(item, keys, labels, depth + 1);
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    keys.add(key);
    const keyLooksNamed = /(^|_)(id|name|title|label|slug|type|category|display)(_|$)/i.test(key);
    if (keyLooksNamed && typeof child === "string") {
      const label = cleanLabel(child);
      if (label.length > 0 && label.length <= 80) labels.add(label);
    }
    collectJsonMetadata(child, keys, labels, depth + 1);
  }
}

function collectTextMetadata(raw: string, keys: Set<string>, labels: Set<string>) {
  const lines = raw.split(/\r?\n/).slice(0, 2000);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;

    const keyValue = trimmed.match(/^([A-Za-z0-9_. -]{1,60})\s*[:=]\s*(.{1,120})$/);
    if (keyValue) {
      const key = cleanLabel(keyValue[1]);
      const value = cleanLabel(keyValue[2]);
      keys.add(key);
      if (/name|title|label|id|type|category/i.test(key) && value.length <= 80) labels.add(value);
      continue;
    }

    if (trimmed.length <= 60 && /^[\p{L}\p{N}][\p{L}\p{N} ._'&:-]+$/u.test(trimmed)) {
      labels.add(cleanLabel(trimmed));
    }
  }
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfExists(filePath: string) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function parseAcfValue(raw: string, key: string) {
  const match = raw.match(new RegExp(`"${key}"\\s+"([^"]+)"`, "i"));
  return match?.[1] ?? null;
}

function normalizeGameText(value: string) {
  return cleanLabel(value.replace(/\\n/g, " ").replace(/\\t/g, " "));
}

function slugFromKey(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function basenameWithoutExt(value: string) {
  return path.basename(value).replace(/\.[^.]+$/, "");
}

async function commandLines(command: string, args: string[], options: { maxBuffer?: number; timeout?: number } = {}) {
  try {
    const { stdout } = await execFileAsync(command, args, {
      maxBuffer: options.maxBuffer ?? 96 * 1024 * 1024,
      timeout: options.timeout ?? 120_000
    });
    return stdout.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

async function stringsLines(filePath: string, minLength = 5) {
  if (!(await fileExists(filePath))) return [];
  return commandLines("strings", ["-n", String(minLength), filePath], { maxBuffer: 128 * 1024 * 1024, timeout: 120_000 });
}

async function extractBuildInfo(gameFilesDir: string) {
  const manifest = await readTextIfExists(path.join(gameFilesDir, "steamapps", "appmanifest_4037600.acf"));
  const appInfo = await readTextIfExists(path.join(gameFilesDir, "FROGGY HATES SNOW_Data", "app.info"));
  const bootConfig = await readTextIfExists(path.join(gameFilesDir, "FROGGY HATES SNOW_Data", "boot.config"));
  const settingsPath = path.join(gameFilesDir, "FROGGY HATES SNOW_Data", "StreamingAssets", "aa", "settings.json");
  let addressablesVersion: string | null = null;
  let settingsBuildTarget: string | null = null;
  try {
    const settings = JSON.parse(await readTextIfExists(settingsPath));
    addressablesVersion = typeof settings.m_AddressablesVersion === "string" ? settings.m_AddressablesVersion : null;
    settingsBuildTarget = typeof settings.m_buildTarget === "string" ? settings.m_buildTarget : null;
  } catch {
    // Optional Unity Addressables settings file.
  }

  const appInfoLines = appInfo.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const bootTarget = bootConfig.match(/^buildtarget=(.+)$/m)?.[1]?.trim() ?? null;
  return {
    app_id: parseAcfValue(manifest, "appid") ?? appInfoLines.find((line) => /^\d+$/.test(line)) ?? null,
    app_name: parseAcfValue(manifest, "name") ?? null,
    build_id: parseAcfValue(manifest, "buildid") ?? null,
    app_info_name: appInfoLines.find((line) => !/^\d+$/.test(line)) ?? null,
    build_target: settingsBuildTarget ?? bootTarget,
    addressables_version: addressablesVersion,
    locator_id: null as string | null
  };
}

async function extractAddressables(gameFilesDir: string) {
  const catalogPath = path.join(gameFilesDir, "FROGGY HATES SNOW_Data", "StreamingAssets", "aa", "catalog.json");
  const empty = {
    catalog_present: false,
    internal_id_count: 0,
    scenes: [] as string[],
    level_object_prefabs_count: 0,
    level_object_groups: [] as Array<{ group: string; count: number; examples: string[] }>,
    locator_id: null as string | null
  };
  try {
    const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
    const ids = Array.isArray(catalog.m_InternalIds) ? catalog.m_InternalIds.map((id: unknown) => String(id)) : [];
    const scenes = ids.filter((id) => /(^|\/)Scenes\//.test(id) || /^FirstParty\/Scenes\//.test(id)).sort();
    const groupMap = new Map<string, string[]>();
    for (const id of ids) {
      const normalized = id.replace(/\\/g, "/");
      const match = normalized.match(/^Assets\/FirstParty\/Prefabs\/LevelObjects\/([^/]+)\/(.+)\.prefab$/);
      if (!match) continue;
      const group = match[1];
      const label = basenameWithoutExt(match[2]);
      const existing = groupMap.get(group) ?? [];
      existing.push(label);
      groupMap.set(group, existing);
    }
    const level_object_groups = [...groupMap.entries()]
      .map(([group, values]) => ({
        group,
        count: values.length,
        examples: values.sort((a, b) => a.localeCompare(b)).slice(0, 8)
      }))
      .sort((a, b) => a.group.localeCompare(b.group));
    return {
      catalog_present: true,
      internal_id_count: ids.length,
      scenes,
      level_object_prefabs_count: [...groupMap.values()].reduce((sum, values) => sum + values.length, 0),
      level_object_groups,
      locator_id: typeof catalog.m_LocatorId === "string" ? catalog.m_LocatorId : null
    };
  } catch {
    return empty;
  }
}

function parseLocalizationPairs(lines: string[]) {
  const pairs = new Map<string, string>();
  const languagesSeen = new Set<string>();
  let pendingKey: string | null = null;
  let activeLanguage: string | null = null;
  let collectEnglish = false;

  for (const line of lines) {
    const keyMatch = line.match(/"key"\s*:\s*"([^"]+)"/);
    if (keyMatch) {
      pendingKey = keyMatch[1];
      continue;
    }

    const valueMatch = line.match(/"value"\s*:\s*"([^"]*)"/);
    if (!valueMatch || pendingKey === null) continue;

    const value = normalizeGameText(valueMatch[1]);
    if (pendingKey === "key") {
      activeLanguage = value;
      languagesSeen.add(value);
      collectEnglish = activeLanguage === "en";
    } else if (collectEnglish && value) {
      pairs.set(pendingKey, value);
    }
    pendingKey = null;
  }

  return { pairs, languages_seen: [...languagesSeen].sort() };
}

function prefixOfKey(key: string) {
  return key.split("_")[0] || "unknown";
}

function sourceKeys(...keys: string[]) {
  return keys.filter(Boolean);
}

function extractLocalizedGroups(pairs: Map<string, string>, sourcePaths: string[]) {
  const prefix_counts: Record<string, number> = {};
  for (const key of pairs.keys()) prefix_counts[prefixOfKey(key)] = (prefix_counts[prefixOfKey(key)] ?? 0) + 1;

  const skillMap = new Map<string, Partial<LocalizedSkill>>();
  const characterMap = new Map<string, Partial<LocalizedCharacter>>();
  const locations: Array<{ id: string; name: string; source_key: string }> = [];
  const artifacts: Array<{ id: string; name: string; source_key: string }> = [];
  const stats: Array<{ id: string; name: string; source_key: string }> = [];
  const resources: Array<{ id: string; name: string; source_key: string }> = [];
  const quests: Array<{ id: string; text: string; source_key: string }> = [];
  const eventMap = new Map<string, { id: string; title?: string; body?: string; source_keys: string[] }>();
  const rarities: Array<{ id: string; name: string; source_key: string }> = [];
  const endStates: Array<{ id: string; name: string; source_key: string }> = [];

  for (const [key, value] of pairs.entries()) {
    let match = key.match(/^skill_(.+)_name$/);
    if (match) {
      const id = slugFromKey(match[1]);
      const row = skillMap.get(id) ?? { id, source_keys: [] };
      row.name = value;
      row.source_keys = sourceKeys(...(row.source_keys ?? []), key);
      skillMap.set(id, row);
      continue;
    }
    match = key.match(/^skill_(.+)_description$/);
    if (match) {
      const id = slugFromKey(match[1]);
      const row = skillMap.get(id) ?? { id, source_keys: [] };
      row.description = value;
      row.source_keys = sourceKeys(...(row.source_keys ?? []), key);
      skillMap.set(id, row);
      continue;
    }
    match = key.match(/^character_(\d+)_name$/);
    if (match) {
      const id = `character_${match[1]}`;
      const row = characterMap.get(id) ?? { id, source_keys: [] };
      row.name = value;
      row.source_keys = sourceKeys(...(row.source_keys ?? []), key);
      characterMap.set(id, row);
      continue;
    }
    match = key.match(/^character_(\d+)_specialty$/);
    if (match) {
      const id = `character_${match[1]}`;
      const row = characterMap.get(id) ?? { id, source_keys: [] };
      row.specialty = value;
      row.source_keys = sourceKeys(...(row.source_keys ?? []), key);
      characterMap.set(id, row);
      continue;
    }
    match = key.match(/^location_(\d+)_name$/);
    if (match) {
      locations.push({ id: `location_${match[1]}`, name: value, source_key: key });
      continue;
    }
    match = key.match(/^artifact_(\d+)_name$/);
    if (match) {
      artifacts.push({ id: `artifact_${match[1]}`, name: value, source_key: key });
      continue;
    }
    match = key.match(/^stats_(.+)$/);
    if (match) {
      stats.push({ id: slugFromKey(match[1]), name: value, source_key: key });
      continue;
    }
    match = key.match(/^res_(.+)$/);
    if (match) {
      resources.push({ id: slugFromKey(match[1]), name: value, source_key: key });
      continue;
    }
    match = key.match(/^quest_(.+)$/);
    if (match) {
      quests.push({ id: slugFromKey(match[1]), text: value, source_key: key });
      continue;
    }
    match = key.match(/^event_(.+)_(title|body)$/);
    if (match) {
      const id = slugFromKey(match[1]);
      const row = eventMap.get(id) ?? { id, source_keys: [] };
      row[match[2] as "title" | "body"] = value;
      row.source_keys = sourceKeys(...row.source_keys, key);
      eventMap.set(id, row);
      continue;
    }
    match = key.match(/^rarity_(.+)$/);
    if (match) {
      rarities.push({ id: slugFromKey(match[1]), name: value, source_key: key });
      continue;
    }
    match = key.match(/^game_end_(.+)$/);
    if (match) {
      endStates.push({ id: slugFromKey(match[1]), name: value, source_key: key });
    }
  }

  const skills = [...skillMap.values()]
    .filter((row): row is LocalizedSkill => Boolean(row.id && row.name && row.description) && row.id !== "none")
    .sort((a, b) => a.name.localeCompare(b.name));
  const characters = [...characterMap.values()]
    .filter((row): row is LocalizedCharacter => Boolean(row.id && row.name))
    .map((row) => ({ ...row, specialty: row.specialty ?? "Needs gameplay verification." }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  return {
    english_pairs_count: pairs.size,
    prefix_counts,
    skills,
    characters,
    locations: locations.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
    artifacts: artifacts.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
    stats: stats.sort((a, b) => a.name.localeCompare(b.name)),
    resources: resources.sort((a, b) => a.name.localeCompare(b.name)),
    quests: quests.sort((a, b) => a.text.localeCompare(b.text)),
    events: [...eventMap.values()]
      .map((event) => ({ id: event.id, title: event.title ?? "Untitled", body: event.body ?? "", source_keys: event.source_keys }))
      .sort((a, b) => a.title.localeCompare(b.title)),
    rarities: rarities.sort((a, b) => a.name.localeCompare(b.name)),
    end_states: endStates.sort((a, b) => a.name.localeCompare(b.name)),
    source_paths: sourcePaths
  };
}

async function extractLocalization(gameFilesDir: string) {
  const sourcePaths = [
    path.join(gameFilesDir, "FROGGY HATES SNOW_Data", "sharedassets0.assets"),
    path.join(gameFilesDir, "FROGGY HATES SNOW_Data", "sharedassets1.assets")
  ];
  const linesByFile = await Promise.all(sourcePaths.map((filePath) => stringsLines(filePath, 5)));
  const allPairs = new Map<string, string>();
  const allLanguages = new Set<string>();
  for (let index = 0; index < sourcePaths.length; index += 1) {
    const { pairs, languages_seen } = parseLocalizationPairs(linesByFile[index]);
    for (const [key, value] of pairs.entries()) allPairs.set(key, value);
    for (const language of languages_seen) allLanguages.add(language);
  }
  return {
    ...extractLocalizedGroups(
      allPairs,
      sourcePaths.map((filePath) => safeRelative(gameFilesDir, filePath)).filter(Boolean)
    ),
    languages_seen: [...allLanguages].sort()
  };
}

const MANAGED_MARKERS = ["FeatureID", "ArtifactID", "QuestLogicsID", "CompanionID", "VisualsID", "AchievementDataSO", "LocationDataSO", "CharacterDataSO", "SkillData"];

async function extractManagedStringHints(gameFilesDir: string) {
  const assemblyPath = path.join(gameFilesDir, "FROGGY HATES SNOW_Data", "Managed", "Assembly-CSharp.dll");
  const lines = await stringsLines(assemblyPath, 3);
  const detectedTypeNames = new Set<string>();
  const detectedMarkers = new Set<string>();
  const interestingType = /^(?:[A-Za-z_][A-Za-z0-9_+`]*)(?:DataSO|Manager|Controller|Upgrade|Data|Feature|Companion|Collectible)$/;
  for (const line of lines) {
    const text = line.trim().replace(/^[^A-Za-z_]+/, "");
    if (MANAGED_MARKERS.includes(text)) detectedMarkers.add(text);
    if (interestingType.test(text) && /Achievement|Location|Character|Artifact|Quest|Skill|Enemy|Froggy|Meta|Unlock|Companion|Upgrade|Collectible|GameMode|Difficulty/.test(text)) {
      detectedTypeNames.add(text);
    }
  }
  return {
    source_path: (await fileExists(assemblyPath)) ? safeRelative(gameFilesDir, assemblyPath) : null,
    detected_type_names: [...detectedTypeNames].sort(),
    detected_markers: [...detectedMarkers].sort()
  };
}

async function ensurePythonExtractor(repoRoot: string) {
  const envPython = process.env.FHS_PYTHON;
  if (envPython && (await fileExists(envPython))) return envPython;

  const cachedPython = path.join(repoRoot, "node_modules", ".cache", "fhs-unity-extractor-venv", "bin", "python");
  if (await fileExists(cachedPython)) return cachedPython;

  const venvDir = path.dirname(path.dirname(cachedPython));
  await mkdir(path.dirname(venvDir), { recursive: true });
  await execFileAsync("python3", ["-m", "venv", venvDir], { timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
  await execFileAsync(cachedPython, ["-m", "pip", "install", "dnfile", "UnityPy"], { timeout: 180_000, maxBuffer: 64 * 1024 * 1024 });
  return cachedPython;
}

async function extractPythonMetadata(gameFilesDir: string, enablePythonExtractors: boolean | undefined) {
  if (enablePythonExtractors === false) return null;

  const assemblyPath = path.join(gameFilesDir, "FROGGY HATES SNOW_Data", "Managed", "Assembly-CSharp.dll");
  try {
    const assemblyStat = await stat(assemblyPath);
    if (assemblyStat.size < 1024 * 1024) return null;
  } catch {
    return null;
  }

  try {
    const repoRoot = process.cwd();
    const python = await ensurePythonExtractor(repoRoot);
    const script = path.join(repoRoot, "scripts", "extract-unity-metadata.py");
    const { stdout } = await execFileAsync(python, [script, gameFilesDir], { timeout: 180_000, maxBuffer: 96 * 1024 * 1024 });
    return JSON.parse(stdout);
  } catch (error) {
    return {
      managed_code: { errors: [`Python Unity extractor failed: ${(error as Error).message}`] },
      serialized_assets: { errors: [`Python Unity extractor failed: ${(error as Error).message}`] }
    };
  }
}

async function extractLocalGameData(gameFilesDir: string, options: ScanOptions): Promise<LocalGameData> {
  const [build, addressables, localization, managedHints, pythonMetadata] = await Promise.all([
    extractBuildInfo(gameFilesDir),
    extractAddressables(gameFilesDir),
    extractLocalization(gameFilesDir),
    extractManagedStringHints(gameFilesDir),
    extractPythonMetadata(gameFilesDir, options.enablePythonExtractors)
  ]);
  build.locator_id = addressables.locator_id;

  const pythonManaged = pythonMetadata?.managed_code ?? {};
  const pythonSerialized = pythonMetadata?.serialized_assets ?? {};
  const enumGroups = Array.isArray(pythonManaged.enums)
    ? pythonManaged.enums.map((row: Record<string, unknown>) => ({
        name: String(row.name),
        owner: row.owner === null || row.owner === undefined ? null : String(row.owner),
        display_name: row.display_name === undefined ? String(row.name) : String(row.display_name),
        value_count: Number(row.value_count ?? 0),
        values: Array.isArray(row.values) ? row.values.map(String) : [],
        value_map: Array.isArray(row.value_map)
          ? row.value_map.map((item) => ({
              name: String((item as Record<string, unknown>).name ?? ""),
              value: (item as Record<string, unknown>).value
            }))
          : undefined,
        truncated: row.truncated === true
      }))
    : undefined;
  const scriptableObjectTypes = Array.isArray(pythonManaged.scriptable_object_types)
    ? pythonManaged.scriptable_object_types.map((row: Record<string, unknown>) => ({
        name: String(row.name),
        owner: row.owner === null || row.owner === undefined ? null : String(row.owner),
        display_name: row.display_name === undefined ? String(row.name) : String(row.display_name),
        extends: row.extends === undefined ? undefined : String(row.extends),
        fields: Array.isArray(row.fields) ? row.fields.map(String) : [],
        field_count: Number(row.field_count ?? 0),
        truncated: row.truncated === true
      }))
    : undefined;
  const importantTypeFields = Array.isArray(pythonManaged.important_type_fields)
    ? pythonManaged.important_type_fields.map((row: Record<string, unknown>) => ({
        name: String(row.name),
        owner: row.owner === null || row.owner === undefined ? null : String(row.owner),
        display_name: row.display_name === undefined ? String(row.name) : String(row.display_name),
        fields: Array.isArray(row.fields) ? row.fields.map(String) : [],
        field_count: Number(row.field_count ?? 0),
        truncated: row.truncated === true
      }))
    : undefined;

  return {
    build,
    addressables: {
      catalog_present: addressables.catalog_present,
      internal_id_count: addressables.internal_id_count,
      scenes: addressables.scenes,
      level_object_prefabs_count: addressables.level_object_prefabs_count,
      level_object_groups: addressables.level_object_groups
    },
    localization,
    managed_code: {
      ...managedHints,
      enum_groups: enumGroups,
      scriptable_object_types: scriptableObjectTypes,
      important_type_fields: importantTypeFields,
      important_type_names: Array.isArray(pythonManaged.important_type_names) ? pythonManaged.important_type_names.map(String) : undefined,
      type_counts: typeof pythonManaged.type_counts === "object" && pythonManaged.type_counts !== null ? (pythonManaged.type_counts as Record<string, number>) : undefined,
      extractor_errors: Array.isArray(pythonManaged.errors) ? pythonManaged.errors.map(String) : undefined
    },
    serialized_assets: {
      object_counts: Array.isArray(pythonSerialized.object_counts) ? pythonSerialized.object_counts : undefined,
      collectible_lists: Array.isArray(pythonSerialized.collectible_lists) ? pythonSerialized.collectible_lists : undefined,
      gameplay_component_summaries:
        typeof pythonSerialized.gameplay_component_summaries === "object" && pythonSerialized.gameplay_component_summaries !== null
          ? (pythonSerialized.gameplay_component_summaries as LocalGameData["serialized_assets"]["gameplay_component_summaries"])
          : undefined,
      stripped_mono_behaviours:
        typeof pythonSerialized.stripped_mono_behaviours === "object" && pythonSerialized.stripped_mono_behaviours !== null
          ? (pythonSerialized.stripped_mono_behaviours as LocalGameData["serialized_assets"]["stripped_mono_behaviours"])
          : undefined,
      extractor_errors: Array.isArray(pythonSerialized.errors) ? pythonSerialized.errors.map(String) : undefined
    }
  };
}

async function analyzeReadableFile(filePath: string, relativePath: string, extension: string, size: number): Promise<ReadableFile> {
  const rawBuffer = await readFile(filePath);
  const raw = rawBuffer.subarray(0, MAX_READ_BYTES).toString("utf8").replace(/\0/g, "");
  const keys = new Set<string>();
  const labels = new Set<string>();
  const notes: string[] = [];

  if (size > MAX_READ_BYTES) notes.push(`Read first ${MAX_READ_BYTES} bytes only.`);

  if (extension === ".json") {
    try {
      collectJsonMetadata(JSON.parse(raw), keys, labels);
    } catch {
      notes.push("JSON parse failed; scanned as plain text.");
      collectTextMetadata(raw, keys, labels);
    }
  } else {
    collectTextMetadata(raw, keys, labels);
  }

  return {
    relative_path: relativePath,
    extension,
    size_bytes: size,
    detected_keys: [...keys].slice(0, 40).sort(),
    short_labels: [...labels].slice(0, 30).sort(),
    notes: notes.length > 0 ? notes.join(" ") : "Safe readable metadata summary only; no raw file dump emitted."
  };
}

async function walk(root: string, current: string, result: ScanResult) {
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    const relativePath = safeRelative(root, fullPath);
    const entryLstat = await lstat(fullPath);

    if (entryLstat.isSymbolicLink()) {
      result.skipped_files.push({
        relative_path: relativePath,
        extension: normalizeExt(fullPath),
        reason: "Skipped symlink; scanner does not follow symlinks."
      });
      continue;
    }

    if (entry.isDirectory()) {
      result.directoriesScanned += 1;
      await walk(root, fullPath, result);
      continue;
    }

    if (!entry.isFile()) continue;

    const extension = normalizeExt(fullPath);
    result.filesScanned += 1;
    result.extension_counts[extension] = (result.extension_counts[extension] ?? 0) + 1;

    const fileStat = await stat(fullPath);
    if (READABLE_EXTENSIONS.has(extension)) {
      result.readable_files.push(await analyzeReadableFile(fullPath, relativePath, extension, fileStat.size));
      continue;
    }

    result.skipped_files.push({
      relative_path: relativePath,
      extension,
      size_bytes: fileStat.size,
      reason: OBVIOUS_BINARY_EXTENSIONS.has(extension)
        ? "Skipped obvious binary/proprietary asset extension."
        : "Skipped extension outside readable metadata allowlist."
    });
  }
}

function markdownReport(result: ScanResult) {
  const lines = [
    "# Extracted Metadata",
    "",
    `Generated: ${result.generated_at}`,
    "",
    "This report summarizes safe, readable metadata only. It does not redistribute game assets, binaries, program code, or large raw text dumps.",
    ""
  ];

  if (!result.gameFilesPresent) {
    lines.push("The game-files directory was not found or is not readable. Run `npm run scan` again after acquiring the demo files.");
    return `${lines.join("\n")}\n`;
  }

  if (!result.gameFilesContainFiles) {
    lines.push("The game-files directory exists, but it currently contains no files. No local game metadata contributed facts to the wiki.");
    lines.push("");
  }

  lines.push(`- Files scanned: ${result.filesScanned}`);
  lines.push(`- Directories scanned: ${result.directoriesScanned}`);
  lines.push(`- Readable metadata files summarized: ${result.readable_files.length}`);
  lines.push(`- Skipped files: ${result.skipped_files.length}`);
  lines.push("");
  lines.push("## Top-Level Entries");
  lines.push("");
  for (const entry of result.top_level_entries) lines.push(`- ${entry}`);
  lines.push("");
  lines.push("## Extension Counts");
  lines.push("");
  for (const [extension, count] of Object.entries(result.extension_counts).sort()) {
    lines.push(`- \`${extension}\`: ${count}`);
  }
  lines.push("");
  lines.push("## Readable Files");
  lines.push("");

  if (result.readable_files.length === 0) {
    lines.push("No allowlisted readable metadata files were found.");
  } else {
    for (const file of result.readable_files) {
      lines.push(`### ${file.relative_path}`);
      lines.push("");
      lines.push(`- Size: ${file.size_bytes} bytes`);
      lines.push(`- Detected keys: ${file.detected_keys.length > 0 ? file.detected_keys.map((key) => `\`${key}\``).join(", ") : "none"}`);
      lines.push(`- Short labels: ${file.short_labels.length > 0 ? file.short_labels.map((label) => `\`${label}\``).join(", ") : "none"}`);
      lines.push(`- Notes: ${file.notes}`);
      lines.push("");
    }
  }

  if (result.local_game_data) {
    const data = result.local_game_data;
    lines.push("## Local Game Data");
    lines.push("");
    lines.push("| Field | Value |");
    lines.push("|---|---|");
    lines.push(`| App ID | ${mdInline(data.build.app_id ?? "not detected")} |`);
    lines.push(`| App name | ${mdInline(data.build.app_name ?? data.build.app_info_name ?? "not detected")} |`);
    lines.push(`| Steam build ID | ${mdInline(data.build.build_id ?? "not detected")} |`);
    lines.push(`| Build target | ${mdInline(data.build.build_target ?? "not detected")} |`);
    lines.push(`| Addressables version | ${mdInline(data.build.addressables_version ?? "not detected")} |`);
    lines.push(`| Addressables internal IDs | ${data.addressables.internal_id_count} |`);
    lines.push(`| Level-object prefabs | ${data.addressables.level_object_prefabs_count} |`);
    lines.push(`| English localization pairs | ${data.localization.english_pairs_count} |`);
    lines.push(`| Localized skills | ${data.localization.skills.length} |`);
    lines.push(`| Localized characters | ${data.localization.characters.length} |`);
    lines.push(`| Localized locations | ${data.localization.locations.length} |`);
    lines.push(`| Localized artifacts | ${data.localization.artifacts.length} |`);
    lines.push(`| Localized resources | ${data.localization.resources.length} |`);
    lines.push(`| Localized quest strings | ${data.localization.quests.length} |`);
    lines.push(`| Localized event notifications | ${data.localization.events.length} |`);
    if (data.serialized_assets.gameplay_component_summaries?.component_counts) {
      const componentTotal = Object.values(data.serialized_assets.gameplay_component_summaries.component_counts).reduce((sum, count) => sum + Number(count ?? 0), 0);
      lines.push(`| Decoded gameplay component instances | ${componentTotal} |`);
    }
    if (data.serialized_assets.stripped_mono_behaviours?.summary) {
      const strippedSummary = data.serialized_assets.stripped_mono_behaviours.summary;
      lines.push(`| Raw stripped MonoBehaviour payloads | ${mdInline(strippedSummary.typetree_failures ?? "not detected")} |`);
    }
    lines.push("");

    if (data.addressables.scenes.length > 0) {
      lines.push("### Scenes");
      lines.push("");
      for (const scene of data.addressables.scenes) lines.push(`- ${mdInline(scene)}`);
      lines.push("");
    }

    if (data.addressables.level_object_groups.length > 0) {
      lines.push("### Addressable Level Objects");
      lines.push("");
      lines.push("| Group | Count | Examples |");
      lines.push("|---|---:|---|");
      for (const group of data.addressables.level_object_groups) {
        lines.push(`| ${mdInline(group.group)} | ${group.count} | ${mdInline(group.examples.join(", "))} |`);
      }
      lines.push("");
    }

    if (data.localization.characters.length > 0) {
      lines.push("### Localized Characters");
      lines.push("");
      lines.push("| ID | Name | Specialty |");
      lines.push("|---|---|---|");
      for (const character of data.localization.characters) {
        lines.push(`| ${mdInline(character.id)} | ${mdInline(character.name)} | ${mdInline(character.specialty)} |`);
      }
      lines.push("");
    }

    if (data.localization.locations.length > 0) {
      lines.push("### Localized Locations");
      lines.push("");
      lines.push("| ID | Name |");
      lines.push("|---|---|");
      for (const location of data.localization.locations) {
        lines.push(`| ${mdInline(location.id)} | ${mdInline(location.name)} |`);
      }
      lines.push("");
    }

    if (data.localization.skills.length > 0) {
      lines.push("### Localized Skills And Tools");
      lines.push("");
      lines.push("| Name | Short Effect | Localization Key |");
      lines.push("|---|---|---|");
      for (const skill of data.localization.skills.slice(0, 140)) {
        lines.push(`| ${mdInline(skill.name)} | ${mdInline(skill.description)} | ${mdInline(skill.source_keys[0] ?? skill.id)} |`);
      }
      if (data.localization.skills.length > 140) lines.push(`| ${data.localization.skills.length - 140} additional localized skills omitted | See JSON | |`);
      lines.push("");
    }

    if (data.localization.quests.length > 0) {
      lines.push("### Localized Quest Strings");
      lines.push("");
      lines.push("| Quest key | Text |");
      lines.push("|---|---|");
      for (const quest of data.localization.quests) lines.push(`| ${mdInline(quest.id)} | ${mdInline(quest.text)} |`);
      lines.push("");
    }

    if (data.localization.events.length > 0) {
      lines.push("### Localized Event Notifications");
      lines.push("");
      lines.push("| Event | Body |");
      lines.push("|---|---|");
      for (const event of data.localization.events) lines.push(`| ${mdInline(event.title)} | ${mdInline(event.body)} |`);
      lines.push("");
    }

    if (data.managed_code.enum_groups && data.managed_code.enum_groups.length > 0) {
      lines.push("### Managed Assembly Enums");
      lines.push("");
      lines.push("| Enum | Values |");
      lines.push("|---|---|");
      for (const group of data.managed_code.enum_groups.slice(0, 60)) {
        lines.push(`| ${mdInline(group.display_name ?? group.name)} | ${mdInline(group.values.slice(0, 35).join(", "))}${group.truncated ? " ..." : ""} |`);
      }
      lines.push("");
    }

    if (data.managed_code.important_type_fields && data.managed_code.important_type_fields.length > 0) {
      const typeFields = data.managed_code.important_type_fields.filter((row) => row.field_count > 0);
      if (typeFields.length > 0) {
        lines.push("### Managed Type Field Inventory");
        lines.push("");
        lines.push("| Type | Extends | Fields |");
        lines.push("|---|---|---|---|");
        for (const row of typeFields.slice(0, 100)) {
          lines.push(`| ${mdInline(row.display_name ?? row.name)} | ${mdInline(row.extends ?? "")} | ${mdInline(row.fields.slice(0, 24).join(", "))}${row.truncated ? " ..." : ""} |`);
        }
        if (typeFields.length > 100) lines.push(`| ${typeFields.length - 100} more rows |  | See JSON for the full managed field inventory. |`);
        lines.push("");
      }
    }

    const componentSummaries = data.serialized_assets.gameplay_component_summaries;
    if (componentSummaries?.component_counts && Object.keys(componentSummaries.component_counts).length > 0) {
      lines.push("### Decoded Gameplay Components");
      lines.push("");
      lines.push("| Component | Instances |");
      lines.push("|---|---:|");
      for (const [component, count] of Object.entries(componentSummaries.component_counts).sort()) {
        lines.push(`| ${mdInline(component)} | ${count} |`);
      }
      lines.push("");

      if (componentSummaries.chest_controllers && componentSummaries.chest_controllers.length > 0) {
        lines.push("#### Chest Controllers");
        lines.push("");
        lines.push("| Occurrences | Key count | Chest type | Examples |");
        lines.push("|---:|---:|---|---|");
        for (const row of componentSummaries.chest_controllers.slice(0, 20)) {
          lines.push(`| ${row.occurrences ?? ""} | ${row.key_count_to_open ?? ""} | ${mdInline(row.chest_type ?? row.chest_type_id ?? "")} | ${mdInline(Array.isArray(row.examples) ? row.examples.join(", ") : "")} |`);
        }
        lines.push("");
      }

      if (componentSummaries.collectible_heaps && componentSummaries.collectible_heaps.length > 0) {
        lines.push("#### Collectible Heaps");
        lines.push("");
        lines.push("| Occurrences | Type | Default count | Active range | Max radius | Examples |");
        lines.push("|---:|---|---:|---|---:|---|");
        for (const row of componentSummaries.collectible_heaps.slice(0, 20)) {
          lines.push(
            `| ${row.occurrences ?? ""} | ${mdInline(row.type ?? row.type_id ?? "")} | ${row.default_count ?? ""} | ${row.min_active_collectibles ?? ""}-${row.max_active_collectibles ?? ""} | ${row.max_radius ?? ""} | ${mdInline(Array.isArray(row.examples) ? row.examples.join(", ") : "")} |`
          );
        }
        lines.push("");
      }

      if (componentSummaries.collectible_challenges && componentSummaries.collectible_challenges.length > 0) {
        lines.push("#### Collectible Challenges");
        lines.push("");
        lines.push("| Occurrences | Target count | Completion delay | Examples |");
        lines.push("|---:|---:|---:|---|");
        for (const row of componentSummaries.collectible_challenges.slice(0, 20)) {
          lines.push(`| ${row.occurrences ?? ""} | ${row.target_activated_count ?? ""} | ${row.on_complete_delay ?? ""} | ${mdInline(Array.isArray(row.examples) ? row.examples.join(", ") : "")} |`);
        }
        lines.push("");
      }

      if (componentSummaries.collectible_pits && componentSummaries.collectible_pits.length > 0) {
        lines.push("#### Collectible Pits");
        lines.push("");
        lines.push("| Occurrences | Raw type id | Examples |");
        lines.push("|---:|---|---|");
        for (const row of componentSummaries.collectible_pits.slice(0, 20)) {
          lines.push(`| ${row.occurrences ?? ""} | ${mdInline(row.type_id ?? "")} | ${mdInline(Array.isArray(row.examples) ? row.examples.join(", ") : "")} |`);
        }
        lines.push("");
      }

      if (componentSummaries.quick_collectible_spawners && componentSummaries.quick_collectible_spawners.length > 0) {
        lines.push("#### Quick Collectible Spawners");
        lines.push("");
        lines.push("| Occurrences | Type | Count | Cooldown | Distance range | Examples |");
        lines.push("|---:|---|---:|---:|---|---|");
        for (const row of componentSummaries.quick_collectible_spawners.slice(0, 20)) {
          lines.push(`| ${row.occurrences ?? ""} | ${mdInline(row.type ?? row.type_id ?? "")} | ${row.count ?? ""} | ${row.spawn_cooldown ?? ""} | ${mdInline(row.distance_range ?? "")} | ${mdInline(Array.isArray(row.examples) ? row.examples.join(", ") : "")} |`);
        }
        lines.push("");
      }

      if (componentSummaries.tree_spawn_point_roots && componentSummaries.tree_spawn_point_roots.length > 0) {
        lines.push("#### Tree Spawn Point Roots");
        lines.push("");
        lines.push("| Occurrences | Percent range | Count range | Examples |");
        lines.push("|---:|---|---|---|");
        for (const row of componentSummaries.tree_spawn_point_roots.slice(0, 20)) {
          lines.push(`| ${row.occurrences ?? ""} | ${row.min_percent ?? ""}-${row.max_percent ?? ""} | ${row.min_count ?? ""}-${row.max_count ?? ""} | ${mdInline(Array.isArray(row.examples) ? row.examples.join(", ") : "")} |`);
        }
        lines.push("");
      }

      if (componentSummaries.heap_spawners && componentSummaries.heap_spawners.length > 0) {
        lines.push("#### Heap Spawners");
        lines.push("");
        lines.push("| Occurrences | Radius range | Count range | Y range | Enabled count | Examples |");
        lines.push("|---:|---|---|---|---:|---|");
        for (const row of componentSummaries.heap_spawners.slice(0, 20)) {
          lines.push(`| ${row.occurrences ?? ""} | ${row.min_radius ?? ""}-${row.max_radius ?? ""} | ${mdInline(row.count_range ?? "")} | ${row.min_y ?? ""}-${row.max_y ?? ""} | ${row.enabled_count ?? ""} | ${mdInline(Array.isArray(row.examples) ? row.examples.join(", ") : "")} |`);
        }
        lines.push("");
      }
    }

    const stripped = data.serialized_assets.stripped_mono_behaviours;
    if (stripped && stripped.core_counts && Object.keys(stripped.core_counts).length > 0) {
      const characters = asRecords(stripped.characters);
      const playableCharacters = characters.filter((character) => character.debug_or_test_asset !== true);
      const locations = asRecords(stripped.locations);
      const artifacts = asRecords(stripped.artifacts);
      const questTemplates = asRecords(stripped.quest_templates);
      const achievements = asRecords(stripped.achievement_conditions);
      const gameModes = asRecords(stripped.game_modes);
      const difficulties = asRecords(stripped.difficulty_levels);
      const statModifiers = asRecords(stripped.stat_modifiers);
      const rarities = asRecords(stripped.rarity_tables);
      const upgradeAssets = asRecords(stripped.upgrade_assets);
      const statusEffectUpgrades = asRecords(stripped.status_effect_upgrades);
      const enemyComponentPayloads = asRecords(stripped.enemy_component_payloads);
      const enemyWaveData = asRecords(stripped.enemy_wave_data);
      const enemyArenaSpawnerData = asRecords(stripped.enemy_arena_spawner_data);
      const levelObjectSpawnerData = asRecords(stripped.level_object_spawner_data);
      const levelObjectPresetData = asRecords(stripped.level_object_preset_data);
      const terrainHeightData = asRecords(stripped.terrain_height_data);
      const terrainTextureData = asRecords(stripped.terrain_texture_data);
      const characterValueRangeCount = nestedRecordCount(characters, "value_ranges");
      const characterUnlockConditionCount = nestedRecordCount(characters, "unlock_conditions");
      const characterBonusCount = nestedRecordCount(characters, "character_bonuses");
      const characterSkillProgressionCount = nestedRecordCount(characters, "skill_progression");
      const characterXpArrayCount = characters.filter((character) => asRecords([character.level_upgrade_experience])[0]?.values).length;
      const characterStructuredCompleteCount = characters.filter((character) => character.structured_payload_complete === true).length;
      const artifactValueRangeCount = nestedRecordCount(artifacts, "value_ranges");
      const artifactStructuredStatCount = nestedRecordCount(artifacts, "upgradable_stats");
      const artifactStructuredCompleteCount = artifacts.filter((artifact) => artifact.structured_payload_complete === true).length;
      const upgradeValueRangeCount = nestedRecordCount(upgradeAssets, "value_ranges");
      const upgradeUnlockConditionCount = nestedRecordCount(upgradeAssets, "unlock_conditions");
      const enemyComponentValueRangeCount = nestedRecordCount(enemyComponentPayloads, "value_ranges");
      const bossAttackIdCount = nestedRecordCount(enemyComponentPayloads, "boss_attack_ids");
      const bossPhaseOrderCount = nestedRecordCount(enemyComponentPayloads, "boss_phase_orders");
      const enemyArenaCount = nestedRecordCount(enemyWaveData, "arenas");
      const enemyWaveRowCount = enemyWaveData.reduce((sum, waveAsset) => sum + asRecords(waveAsset.arenas).reduce((arenaSum, arena) => arenaSum + recordCount(arena.waves), 0), 0);

      lines.push("### Raw Stripped MonoBehaviour Data");
      lines.push("");
      lines.push("Unity type trees are stripped for the core data assets, so this section records decoded leading fields and embedded strings from the raw serialized payloads.");
      lines.push("");

      if (stripped.summary) {
        lines.push("| Field | Value |");
        lines.push("|---|---:|");
        lines.push(`| Combined Unity files | ${stripped.summary.combined_files ?? ""} |`);
        lines.push(`| Objects scanned in combined Unity environment | ${stripped.summary.objects ?? ""} |`);
        lines.push(`| MonoBehaviours scanned | ${stripped.summary.mono_behaviours ?? ""} |`);
        lines.push(`| MonoBehaviour typetree failures decoded through raw payloads | ${stripped.summary.typetree_failures ?? ""} |`);
        lines.push(`| Unknown script failures | ${stripped.summary.unknown_script_failures ?? ""} |`);
        lines.push("");
      }

      lines.push("#### Core Stripped Class Counts");
      lines.push("");
      lines.push("| Class | Instances |");
      lines.push("|---|---:|");
      for (const [klass, count] of Object.entries(stripped.core_counts).sort((a, b) => a[0].localeCompare(b[0]))) {
        lines.push(`| ${mdInline(klass)} | ${count} |`);
      }
      lines.push("");

      lines.push("#### Parsed Payload Coverage");
      lines.push("");
      lines.push("| Dataset | Rows |");
      lines.push("|---|---:|");
      lines.push(`| Characters | ${characters.length} |`);
      lines.push(`| Playable character assets | ${playableCharacters.length} |`);
      lines.push(`| Structurally complete character payloads | ${characterStructuredCompleteCount} |`);
      lines.push(`| Character XP value arrays | ${characterXpArrayCount} |`);
      lines.push(`| Character progression value ranges | ${characterValueRangeCount} |`);
      lines.push(`| Character unlock/progression conditions | ${characterUnlockConditionCount} |`);
      lines.push(`| Character bonus rows | ${characterBonusCount} |`);
      lines.push(`| Character skill progression rows | ${characterSkillProgressionCount} |`);
      lines.push(`| Locations | ${locations.length} |`);
      lines.push(`| Artifacts | ${artifacts.length} |`);
      lines.push(`| Structurally complete artifact payloads | ${artifactStructuredCompleteCount} |`);
      lines.push(`| Artifact structured stat rows | ${artifactStructuredStatCount} |`);
      lines.push(`| Artifact value ranges | ${artifactValueRangeCount} |`);
      lines.push(`| Quest templates | ${questTemplates.length} |`);
      lines.push(`| Achievement conditions | ${achievements.length} |`);
      lines.push(`| Game modes | ${gameModes.length} |`);
      lines.push(`| Difficulty levels | ${difficulties.length} |`);
      lines.push(`| Stat modifier sets | ${statModifiers.length} |`);
      lines.push(`| Rarity tables | ${rarities.length} |`);
      lines.push(`| Upgrade payload summaries | ${upgradeAssets.length} |`);
      lines.push(`| Upgrade value ranges | ${upgradeValueRangeCount} |`);
      lines.push(`| Upgrade unlock conditions | ${upgradeUnlockConditionCount} |`);
      lines.push(`| Status effect upgrade payloads | ${statusEffectUpgrades.length} |`);
      lines.push(`| Enemy component payload summaries | ${enemyComponentPayloads.length} |`);
      lines.push(`| Enemy component value ranges | ${enemyComponentValueRangeCount} |`);
      lines.push(`| Boss attack ID rows | ${bossAttackIdCount} |`);
      lines.push(`| Boss phase order rows | ${bossPhaseOrderCount} |`);
      lines.push(`| Enemy wave data payloads | ${enemyWaveData.length} |`);
      lines.push(`| Enemy arena wave groups | ${enemyArenaCount} |`);
      lines.push(`| Enemy wave rows | ${enemyWaveRowCount} |`);
      lines.push(`| Enemy arena spawner payloads | ${enemyArenaSpawnerData.length} |`);
      lines.push(`| Level object spawner payloads | ${levelObjectSpawnerData.length} |`);
      lines.push(`| Level object preset payloads | ${levelObjectPresetData.length} |`);
      lines.push(`| Terrain height payloads | ${terrainHeightData.length} |`);
      lines.push(`| Terrain texture payloads | ${terrainTextureData.length} |`);
      lines.push(`| Parse errors | ${recordCount(stripped.parse_errors)} |`);
      lines.push("");

      if (playableCharacters.length > 0) {
        lines.push("#### Parsed Characters");
        lines.push("");
        lines.push("| ID | Name | Specialty | Unlock cost | XP values | Unlock quests | Stat bonuses |");
        lines.push("|---:|---|---|---:|---|---|---|");
        for (const character of playableCharacters) {
          const quests = asRecords(character.character_quests)
            .map((quest) => quest.condition ?? quest.text)
            .join("; ");
          const bonuses = asRecords(character.character_bonuses).map(formatCharacterBonus).join("; ");
          lines.push(
            `| ${character.id ?? ""} | ${mdInline(character.name)} | ${mdInline(character.specialty)} | ${character.unlock_cost ?? ""} | ${mdInline(formatProgressionValues(character.level_upgrade_experience))} | ${mdInline(quests)} | ${mdInline(bonuses)} |`
          );
        }
        lines.push("");

        lines.push("#### Parsed Character Stats And Skill Progression");
        lines.push("");
        lines.push("| Character | Exact stat rows | Skill progression rows |");
        lines.push("|---|---|---|");
        for (const character of playableCharacters) {
          const stats = asRecords(character.character_stats).map(formatCharacterStat).join("; ");
          const skillRows = asRecords(character.skill_progression)
            .filter((row) => row.empty_slot !== true)
            .map(formatSkillProgressionRow)
            .join("; ");
          lines.push(`| ${mdInline(character.name)} | ${mdInline(stats)} | ${mdInline(skillRows)} |`);
        }
        lines.push("");
      }

      if (locations.length > 0) {
        lines.push("#### Parsed Locations");
        lines.push("");
        lines.push("| ID | Name | Unlock cost | Quest lines | Generation refs | Game settings | Completion reward |");
        lines.push("|---:|---|---:|---|---|---|---|");
        for (const location of locations) {
          const quests = asRecords(location.parsed_quests).map((quest) => `${quest.logic_id ?? "?"}: ${quest.text ?? ""}`).join("; ") || stringList(location.quest_lines, 6).join("; ");
          const generation = formatLocationGeneration(location.level_generation);
          const settings = formatLocationSettings(location.game_settings);
          const reward = formatLocationReward(location.location_reward);
          lines.push(`| ${location.id ?? ""} | ${mdInline(location.name)} | ${location.unlock_cost ?? ""} | ${mdInline(quests)} | ${mdInline(generation)} | ${mdInline(settings)} | ${mdInline(reward)} |`);
        }
        lines.push("");
      }

      if (artifacts.length > 0) {
        lines.push("#### Parsed Artifacts");
        lines.push("");
        lines.push("| ID | Name | Rarity | Weight | Levels | Structured stats |");
        lines.push("|---:|---|---|---:|---:|---|");
        for (const artifact of artifacts) {
          const structuredStats = asRecords(artifact.upgradable_stats).map(formatArtifactStat).join("; ");
          lines.push(
            `| ${artifact.id ?? ""} | ${mdInline(artifact.name)} | ${mdInline(artifact.rarity ?? artifact.rarity_id)} | ${artifact.weight ?? ""} | ${artifact.level_count ?? ""} | ${mdInline(structuredStats || stringList(artifact.embedded_stat_strings, 5).join("; "))} |`
          );
        }
        lines.push("");
      }

      if (gameModes.length > 0 || difficulties.length > 0 || rarities.length > 0) {
        lines.push("#### Modes, Difficulties, And Rarities");
        lines.push("");
        if (gameModes.length > 0) {
          lines.push("| Game mode ID | Label | Localization key |");
          lines.push("|---:|---|---|");
          for (const mode of gameModes) lines.push(`| ${mode.id ?? ""} | ${mdInline(mode.enum_label)} | ${mdInline(mode.localization_key)} |`);
          lines.push("");
        }
        if (difficulties.length > 0) {
          lines.push("| Difficulty ID | Label | Localization key |");
          lines.push("|---:|---|---|");
          for (const difficulty of difficulties) lines.push(`| ${difficulty.id ?? ""} | ${mdInline(difficulty.enum_label)} | ${mdInline(difficulty.localization_key)} |`);
          lines.push("");
        }
        if (rarities.length > 0) {
          lines.push("| Rarity | Upgrade chance | Upgrade count percent | Exact count |");
          lines.push("|---|---:|---:|---:|");
          for (const rarity of rarities) {
            lines.push(`| ${mdInline(rarity.rarity ?? rarity.name)} | ${rarity.upgrade_chance_percent ?? ""} | ${rarity.upgrade_count_percent ?? ""} | ${rarity.actual_upgrade_count ?? ""} |`);
          }
          lines.push("");
        }
      }

      if (statModifiers.length > 0) {
        lines.push("#### Parsed Stat Modifiers");
        lines.push("");
        lines.push("| Modifier set | Modifiers |");
        lines.push("|---|---|");
        for (const modifierSet of statModifiers) {
          const modifiers = asRecords(modifierSet.modifiers)
            .map((modifier) => `${modifier.label ?? `stat ${modifier.stat_id}`}: ${modifier.value_percent ?? ""}%`)
            .join("; ");
          lines.push(`| ${mdInline(modifierSet.name)} | ${mdInline(modifiers)} |`);
        }
        lines.push("");
      }

      if (questTemplates.length > 0) {
        lines.push("#### Parsed Quest Templates");
        lines.push("");
        lines.push("| Index | Logic ID | Text |");
        lines.push("|---:|---:|---|");
        for (const quest of questTemplates) lines.push(`| ${quest.index ?? ""} | ${quest.logic_id ?? ""} | ${mdInline(quest.text)} |`);
        lines.push("");
      }

      if (achievements.length > 0) {
        lines.push("#### Parsed Achievement Conditions");
        lines.push("");
        lines.push("| Quest ID | Title | Condition |");
        lines.push("|---:|---|---|");
        for (const achievement of achievements) lines.push(`| ${achievement.quest_id ?? ""} | ${mdInline(achievement.title)} | ${mdInline(achievement.condition)} |`);
        lines.push("");
      }

      if (upgradeAssets.length > 0) {
        lines.push("#### Upgrade Payload Summaries");
        lines.push("");
        lines.push("| Class | Feature | Rarity | Exact value ranges | Unlock conditions |");
        lines.push("|---|---|---|---|---|");
        for (const upgrade of upgradeAssets) {
          lines.push(
            `| ${mdInline(upgrade.class)} | ${mdInline(upgrade.feature_name ?? upgrade.name)} | ${mdInline(upgrade.rarity ?? "")} | ${mdInline(asRecords(upgrade.value_ranges).map(formatValueRange).join("; "))} | ${mdInline(asRecords(upgrade.unlock_conditions).map((condition) => condition.condition ?? "").join("; "))} |`
          );
        }
        lines.push("");
      }

      if (statusEffectUpgrades.length > 0) {
        lines.push("#### Status Effect Upgrade Payloads");
        lines.push("");
        lines.push("| Asset | Feature | Effect type | Extracted effect text |");
        lines.push("|---|---|---|---|");
        for (const upgrade of statusEffectUpgrades) {
          const strings = stringList(upgrade.embedded_strings, 4);
          lines.push(`| ${mdInline(upgrade.name)} | ${mdInline(upgrade.feature_name ?? upgrade.feature ?? "")} | ${mdInline(upgrade.damageable_effect_type ?? upgrade.damageable_effect_type_id ?? "")} | ${mdInline(strings.join("; "))} |`);
        }
        lines.push("");
      }

      if (enemyWaveData.length > 0) {
        lines.push("#### Enemy Wave Payloads");
        lines.push("");
        lines.push("| Asset | Arenas | Structured wave summary |");
        lines.push("|---|---:|---|");
        for (const wave of enemyWaveData) {
          const arenas = asRecords(wave.arenas);
          const summary = arenas
            .slice(0, 8)
            .map((arena) => {
              const waves = asRecords(arena.waves)
                .map((waveRow) => `W${waveRow.wave}: ${formatSpawnList(waveRow.spawns)}`)
                .join("; ");
              return `A${arena.arena} ${arena.size}: ${waves}`;
            })
            .join(" | ");
          lines.push(`| ${mdInline(wave.name)} | ${wave.arena_count ?? arenas.length} | ${mdInline(summary || stringList(wave.embedded_strings, 30).join("; "))} |`);
        }
        lines.push("");
      }

      if (enemyComponentPayloads.length > 0) {
        lines.push("#### Enemy And Boss Component Payloads");
        lines.push("");
        lines.push("| Component | Object | Exact value ranges | Extracted strings |");
        lines.push("|---|---|---|---|");
        for (const component of enemyComponentPayloads) {
          const strings = stringList(component.embedded_strings, 14).join("; ");
          if (!strings && !component.name) continue;
          lines.push(`| ${mdInline(component.class)} | ${mdInline(component.name)} | ${mdInline(asRecords(component.value_ranges).map(formatValueRange).join("; "))} | ${mdInline(strings)} |`);
        }
        lines.push("");
      }

      const bossPhasePayloads = enemyComponentPayloads.filter((component) => recordCount(component.boss_attack_ids) > 0 || recordCount(component.boss_phase_orders) > 0);
      if (bossPhasePayloads.length > 0) {
        lines.push("#### Boss Phase Payloads");
        lines.push("");
        lines.push("| Boss | Attack IDs | Phase order rows |");
        lines.push("|---|---|---|");
        for (const component of bossPhasePayloads) {
          lines.push(`| ${mdInline(component.name)} | ${mdInline(formatBossAttackIds(component.boss_attack_ids))} | ${mdInline(formatBossPhaseOrders(component.boss_phase_orders))} |`);
        }
        lines.push("");
      }

      if (levelObjectSpawnerData.length > 0 || enemyArenaSpawnerData.length > 0 || levelObjectPresetData.length > 0 || terrainHeightData.length > 0 || terrainTextureData.length > 0) {
        lines.push("#### Level And Arena Spawner Payloads");
        lines.push("");
        lines.push("| Dataset | Asset | Structured summary | Extracted strings |");
        lines.push("|---|---|---|---|");
        for (const row of enemyArenaSpawnerData) lines.push(`| Enemy arena spawner | ${mdInline(row.name)} |  | ${mdInline(stringList(row.embedded_strings, 24).join("; "))} |`);
        for (const row of levelObjectSpawnerData) lines.push(`| Level object spawner | ${mdInline(row.name)} | ${mdInline(formatLevelObjectSections(row.sections))} | ${mdInline(stringList(row.embedded_strings, 16).join("; "))} |`);
        for (const row of levelObjectPresetData) lines.push(`| Level object preset | ${mdInline(row.name)} | ${mdInline(formatPresetCollectibles(row.collectible_presets))} | ${mdInline(stringList(row.embedded_strings, 16).join("; "))} |`);
        for (const row of terrainHeightData) lines.push(`| Terrain height | ${mdInline(row.name)} |  | ${mdInline(stringList(row.embedded_strings, 16).join("; "))} |`);
        for (const row of terrainTextureData) lines.push(`| Terrain texture | ${mdInline(row.name)} |  | ${mdInline(stringList(row.embedded_strings, 16).join("; "))} |`);
        lines.push("");
      }

      if (upgradeAssets.length > 0 || statusEffectUpgrades.length > 0 || enemyWaveData.length > 0 || enemyComponentPayloads.length > 0 || levelObjectSpawnerData.length > 0 || terrainHeightData.length > 0) {
        lines.push("#### Additional Raw Payload Summaries");
        lines.push("");
        lines.push("| Dataset | Rows | Example names |");
        lines.push("|---|---:|---|");
        lines.push(`| Upgrade assets | ${upgradeAssets.length} | ${mdInline(upgradeAssets.slice(0, 12).map((row) => row.name).join(", "))} |`);
        lines.push(`| Status effect upgrades | ${statusEffectUpgrades.length} | ${mdInline(statusEffectUpgrades.slice(0, 12).map((row) => row.name).join(", "))} |`);
        lines.push(`| Enemy component payloads | ${enemyComponentPayloads.length} | ${mdInline(enemyComponentPayloads.slice(0, 12).map((row) => `${row.class}:${row.name ?? ""}`).join(", "))} |`);
        lines.push(`| Enemy wave data | ${enemyWaveData.length} | ${mdInline(enemyWaveData.slice(0, 12).map((row) => row.name).join(", "))} |`);
        lines.push(`| Enemy arena spawner data | ${enemyArenaSpawnerData.length} | ${mdInline(enemyArenaSpawnerData.slice(0, 12).map((row) => row.name).join(", "))} |`);
        lines.push(`| Level object spawner data | ${levelObjectSpawnerData.length} | ${mdInline(levelObjectSpawnerData.slice(0, 12).map((row) => row.name).join(", "))} |`);
        lines.push(`| Level object preset data | ${levelObjectPresetData.length} | ${mdInline(levelObjectPresetData.slice(0, 12).map((row) => row.name).join(", "))} |`);
        lines.push(`| Terrain height data | ${terrainHeightData.length} | ${mdInline(terrainHeightData.slice(0, 12).map((row) => row.name).join(", "))} |`);
        lines.push(`| Terrain texture data | ${terrainTextureData.length} | ${mdInline(terrainTextureData.slice(0, 12).map((row) => row.name).join(", "))} |`);
        lines.push("");
      }

      if (Array.isArray(stripped.parse_errors) && stripped.parse_errors.length > 0) {
        lines.push("#### Raw Parse Errors");
        lines.push("");
        for (const error of stripped.parse_errors.slice(0, 20)) lines.push(`- ${mdInline(error)}`);
        if (stripped.parse_errors.length > 20) lines.push(`- ${stripped.parse_errors.length - 20} additional parse errors omitted from Markdown; see JSON.`);
        lines.push("");
      }
    }

    if (data.serialized_assets.collectible_lists && data.serialized_assets.collectible_lists.length > 0) {
      lines.push("### Serialized Collectible Lists");
      lines.push("");
      lines.push("| List | Items | Bundle Path |");
      lines.push("|---|---|---|");
      for (const list of data.serialized_assets.collectible_lists) {
        lines.push(`| ${mdInline(list.name)} | ${mdInline(list.items.map(formatCollectibleItem).join(", "))} | ${mdInline(list.source_path)} |`);
      }
      lines.push("");
    }
  }

  lines.push("## Skipped Files");
  lines.push("");
  for (const skipped of result.skipped_files.slice(0, 200)) {
    lines.push(`- \`${skipped.relative_path}\` (${skipped.extension}): ${skipped.reason}`);
  }
  if (result.skipped_files.length > 200) {
    lines.push(`- ${result.skipped_files.length - 200} additional skipped files omitted from Markdown; see JSON for full list.`);
  }

  return `${lines.join("\n")}\n`;
}

function formatCollectibleItem(item: { name: string; count: unknown; type?: unknown; type_id?: unknown }) {
  const name = String(item.name ?? "").trim();
  const count = item.count ?? "?";
  const hasCountInName = new RegExp(`\\bx\\s*${String(count).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i").test(name);
  const type = item.type ? ` (${item.type})` : item.type_id !== undefined ? ` (type ${item.type_id})` : "";
  return `${name}${hasCountInName ? "" : ` x${count}`}${type}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecords(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringList(value: unknown, limit = 6) {
  return Array.isArray(value) ? value.slice(0, limit).map((item) => String(item)).filter(Boolean) : [];
}

function recordCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function nestedRecordCount(rows: Array<Record<string, unknown>>, key: string) {
  return rows.reduce((sum, row) => sum + recordCount(row[key]), 0);
}

function formatNumberList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).join(", ") : "";
}

function formatProgressionValues(value: unknown) {
  if (!isRecord(value)) return "";
  return formatNumberList(value.values);
}

function formatCharacterBonus(bonus: Record<string, unknown>) {
  const label = bonus.display_label || bonus.stat || bonus.stat_key || `stat ${bonus.stat_id ?? ""}`;
  const delta = bonus.display_delta || bonus.value || "";
  return `${label}: ${delta}`;
}

function formatCharacterStat(stat: Record<string, unknown>) {
  const label = stat.display_label || stat.stat || stat.stat_key || `stat ${stat.stat_id ?? ""}`;
  const value = stat.display_delta || stat.value || "";
  return `${label} (${stat.stat ?? stat.stat_id ?? "unknown"}): ${value}`;
}

function formatSkillProgressionRow(row: Record<string, unknown>) {
  const resolved = row.resolved_upgrade_name && row.resolved_upgrade_name !== row.label ? ` -> ${row.resolved_upgrade_name}` : "";
  return `G${row.group ?? "?"}/${row.unlock_step}: ${row.label}${resolved}`;
}

function formatArtifactStat(stat: Record<string, unknown>) {
  const label = stat.stat || stat.stat_id || "unknown";
  const values = asRecords(stat.parameter_values).map((parameter) => {
    const title = parameter.title || parameter.editor_name || "value";
    return `${title}: ${formatProgressionValues(parameter.progression_value)}`;
  });
  return `${label}: ${values.join(", ")}`;
}

function formatLocationGeneration(value: unknown) {
  if (!isRecord(value)) return "";
  const parts = [
    `height ${value.height_data_name ?? value.height_data_ref ?? ""}`,
    `texture ${value.texture_data_name ?? value.texture_data_ref ?? ""}`,
    `objects ${value.main_level_object_spawner_name ?? ""}/${value.secondary_level_object_spawner_name ?? ""}`,
    `enemies ${value.enemy_spawner_name ?? ""}`
  ];
  const pitHints = asRecords(value.pit_hint_rings)
    .slice(0, 3)
    .map((ring) => {
      const hints = asRecords(ring.hints)
        .filter((hint) => Number(hint.chance ?? 0) > 0)
        .map((hint) => `${hint.type_id}:${hint.chance}`)
        .join(",");
      return `R${ring.ring}[${hints}]`;
    })
    .join(" ");
  if (pitHints) parts.push(`pit hints ${pitHints}`);
  return parts.filter((part) => !part.endsWith(" ") && !part.endsWith("/")).join("; ");
}

function formatLocationSettings(value: unknown) {
  if (!isRecord(value)) return "";
  const resources = asRecords(value.start_resources)
    .map((resource) => `${resource.label ?? `res ${resource.resource_id ?? ""}`}`)
    .join(", ");
  const enemyParams = isRecord(value.enemy_upgrade_level_params) ? `enemy upgrade ${value.enemy_upgrade_level_params.start}->${value.enemy_upgrade_level_params.end}` : "";
  const arenaParams = isRecord(value.arena_spawn_time_params) ? `arena spawn ${value.arena_spawn_time_params.start}->${value.arena_spawn_time_params.end}s` : "";
  return [`resources ${resources}`, `cards ${value.upgrade_card_spawn_count_on_arena_end ?? ""}`, enemyParams, arenaParams].filter(Boolean).join("; ");
}

function formatLocationReward(value: unknown) {
  if (!isRecord(value)) return "";
  return [
    value.completion_reward_name ? `reward ${value.completion_reward_name}` : "",
    value.unlock_location_runs_completed_target_count !== undefined ? `runs ${value.unlock_location_runs_completed_target_count}` : "",
    value.tree_scale !== undefined ? `tree scale ${value.tree_scale}` : "",
    value.enabled_tree_percent !== undefined ? `trees ${value.enabled_tree_percent}` : ""
  ]
    .filter(Boolean)
    .join("; ");
}

function formatValueRange(row: Record<string, unknown>) {
  const suffix = Array.isArray(row.values) && row.values.length > 0 ? ` [${formatNumberList(row.values)}]` : "";
  return `${row.label ?? "value"} ${row.start ?? ""}->${row.end ?? ""}${suffix}`;
}

function formatBossAttackIds(value: unknown) {
  return asRecords(value)
    .map((row) => `${row.id ?? "?"}: ${row.name ?? ""}`.trim())
    .join("; ");
}

function formatBossPhaseOrders(value: unknown) {
  return asRecords(value)
    .map((row) => {
      const attacks = asRecords(row.attacks)
        .map((attack) => (attack.name ? `${attack.name} (${attack.id ?? "?"})` : `${attack.id ?? "?"}`))
        .join(" + ");
      return `${row.label ?? ""} x${row.repeat_count ?? "?"}${attacks ? ` -> ${attacks}` : ""}`;
    })
    .join("; ");
}

function formatSpawnList(value: unknown) {
  return asRecords(value)
    .map((spawn) => `${spawn.enemy ?? "enemy"} x${spawn.count ?? "?"}`)
    .join(", ");
}

function formatLevelObjectSections(value: unknown) {
  return asRecords(value)
    .slice(0, 6)
    .map((section) => {
      const entries = asRecords(section.entries)
        .slice(0, 5)
        .map((entry) => `${entry.category ?? "Object"}:${entry.object ?? "?"} x${entry.count ?? "?"}`)
        .join(", ");
      return `${section.name ?? `section ${section.index ?? "?"}`} ${section.radius_min ?? "?"}-${section.radius_max ?? "?"}: ${entries}`;
    })
    .join("; ");
}

function formatPresetCollectibles(value: unknown) {
  return asRecords(value)
    .slice(0, 24)
    .map((preset) => `${preset.name ?? "preset"} ${preset.resource ?? "item"} x${preset.count ?? "?"}`)
    .join("; ");
}

function mdInline(value: unknown) {
  return mdEscape(String(value ?? ""));
}

function mdEscape(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

export async function scanGameFiles(options: ScanOptions = {}): Promise<ScanResult> {
  const gameFilesDir = path.resolve(options.gameFilesDir ?? "game-files");
  const notesDir = path.resolve(options.notesDir ?? "notes");
  await mkdir(notesDir, { recursive: true });

  const result: ScanResult = {
    generated_at: new Date().toISOString(),
    gameFilesPresent: false,
    gameFilesContainFiles: false,
    root: gameFilesDir,
    rules: [
      "Read only allowlisted text/metadata extensions.",
      "Do not follow symlinks.",
      "Do not copy assets, binaries, program code, or large raw text dumps.",
      "Emit short labels, keys, paths, counts, and compact evidence references only."
    ],
    filesScanned: 0,
    directoriesScanned: 0,
    extension_counts: {},
    top_level_entries: [],
    readable_files: [],
    skipped_files: []
  };

  try {
    const rootStat = await stat(gameFilesDir);
    if (!rootStat.isDirectory()) throw new Error("game-files path exists but is not a directory");
    result.gameFilesPresent = true;
  } catch {
    await writeFile(path.join(notesDir, "extracted-metadata.json"), `${JSON.stringify(result, null, 2)}\n`);
    await writeFile(path.join(notesDir, "extracted-metadata.md"), markdownReport(result));
    return result;
  }

  result.top_level_entries = (await readdir(gameFilesDir)).sort();
  await walk(gameFilesDir, gameFilesDir, result);
  result.gameFilesContainFiles = result.filesScanned > 0;
  if (result.gameFilesContainFiles) {
    result.local_game_data = await extractLocalGameData(gameFilesDir, options);
  }
  await writeFile(path.join(notesDir, "extracted-metadata.json"), `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(path.join(notesDir, "extracted-metadata.md"), markdownReport(result));

  const localCounts = result.local_game_data
    ? `; extracted ${result.local_game_data.localization.skills.length} localized skill/tool rows, ${result.local_game_data.localization.characters.length} characters, ${result.local_game_data.localization.locations.length} locations`
    : "";
  console.log(`Scanned ${result.filesScanned} files; summarized ${result.readable_files.length} readable metadata files${localCounts}.`);
  return result;
}

async function main() {
  await scanGameFiles();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
