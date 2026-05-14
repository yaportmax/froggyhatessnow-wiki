import { execFile } from "node:child_process";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { REQUIRED_DATASETS } from "./validate-data.ts";

const execFileAsync = promisify(execFile);

const DOMAIN = "froggyhatessnow-wiki.vercel.app";
const CUSTOM_SITE = `https://${DOMAIN}`;
const REQUIRED_PATHS = [
  ".gitignore",
  "README.md",
  "AGENTS.md",
  "package.json",
  "astro.config.mjs",
  "scripts/scan-game-files.ts",
  "scripts/generate-pages.ts",
  "scripts/validate-data.ts",
  "scripts/completion-audit.ts",
  "scripts/domain-health.ts",
  "scripts/domain-commit-canonical.ts",
  "src/pages/robots.txt.ts",
  "src/pages/llms.txt.ts",
  "scripts/r2-offload.ts",
  "notes/public-research.md",
  "notes/extracted-metadata.md",
  "notes/extracted-metadata.json",
  "notes/domain-options.md",
  "notes/porkbun-verification-support.md",
  "notes/final-handoff.md",
  "notes/completion-audit.md",
  "src/content/docs/404.md",
  "src/content/docs/index.md",
  "src/content/docs/generated/media/index.md",
  "src/content/docs/generated/achievements/index.md",
  "src/content/docs/generated/frogs/index.md",
  "src/content/docs/generated/skills/index.md",
  "src/content/docs/generated/upgrades/index.md",
  "src/content/docs/generated/items/index.md",
  "src/content/docs/generated/maps/index.md",
  "src/content/docs/generated/enemies/index.md",
  "src/content/docs/generated/bosses/index.md",
  "src/content/docs/generated/waves/index.md",
  "src/content/docs/generated/mechanics/index.md",
  "src/content/docs/generated/quests/index.md",
  "src/content/docs/generated/achievement-conditions/index.md",
  "src/content/docs/generated/modes/index.md",
  "src/content/docs/generated/terrain/index.md"
];
const REQUIRED_SCRIPTS = ["dev", "build", "preview", "scan", "fetch:steam", "refresh:data", "generate", "validate", "build:verified"];
const SUPPORTING_SCRIPTS = [
  "test",
  "deploy:status",
  "deploy:publish",
  "domain:check",
  "domain:status",
  "domain:account",
  "domain:register",
  "domain:dns",
  "domain:finish",
  "domain:finish:post-verification",
  "domain:vercel-price",
  "domain:vercel-buy",
  "domain:finish:vercel-post-purchase",
  "domain:health",
  "domain:commit-canonical",
  "r2:offload",
  "r2:offload:tmp",
  "r2:offload:tmp:prune",
  "audit:completion"
];

type Check = {
  name: string;
  ok: boolean;
  details: Record<string, unknown>;
};

type CommandResult = {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
};

async function run(command: string, args: string[]): Promise<CommandResult> {
  const rendered = [command, ...args].join(" ");
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      maxBuffer: 50 * 1024 * 1024
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

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function jsonFromCommand(raw: string) {
  const start = raw.indexOf("{");
  if (start < 0) return null;
  try {
    return JSON.parse(raw.slice(start)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function pathChecks(): Promise<Check[]> {
  const checks: Check[] = [];
  for (const filePath of REQUIRED_PATHS) {
    checks.push({
      name: `path:${filePath}`,
      ok: await exists(filePath),
      details: { path: filePath }
    });
  }
  for (const dataset of REQUIRED_DATASETS) {
    const dataPath = `src/data/${dataset}.json`;
    const indexPath = `src/content/docs/generated/${dataset}/index.md`;
    checks.push({ name: `data:${dataset}`, ok: await exists(dataPath), details: { path: dataPath } });
    checks.push({ name: `generated-index:${dataset}`, ok: await exists(indexPath), details: { path: indexPath } });
  }
  checks.push({
    name: "data:public-sources",
    ok: await exists("src/data/public-sources.json"),
    details: { path: "src/data/public-sources.json" }
  });
  checks.push({
    name: "data:steam-snapshot",
    ok: await exists("src/data/steam-snapshot.json"),
    details: { path: "src/data/steam-snapshot.json" }
  });
  return checks;
}

async function packageChecks(): Promise<Check[]> {
  const raw = await readFile("package.json", "utf8");
  const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
  const scripts = pkg.scripts ?? {};
  return [...REQUIRED_SCRIPTS, ...SUPPORTING_SCRIPTS].map((script) => ({
    name: `package-script:${script}`,
    ok: script in scripts,
    details: { script, command: scripts[script] ?? null, required: REQUIRED_SCRIPTS.includes(script) }
  }));
}

async function dataCoverageCheck(): Promise<Check> {
  const counts: Record<string, number> = {};
  const statuses: Record<string, number> = {};
  let total = 0;
  for (const dataset of REQUIRED_DATASETS) {
    const rows = JSON.parse(await readFile(`src/data/${dataset}.json`, "utf8")) as Array<Record<string, unknown>>;
    counts[dataset] = rows.length;
    total += rows.length;
    for (const row of rows) {
      const status = String(row.verification_status ?? "unknown");
      statuses[status] = (statuses[status] ?? 0) + 1;
    }
  }
  return {
    name: "data-coverage",
    ok: total > 0 && counts.tools > 0,
    details: { totalEntities: total, counts, verificationStatuses: statuses }
  };
}

async function localExtractionCheck(): Promise<Check> {
  const raw = await readFile("notes/extracted-metadata.json", "utf8");
  const metadata = JSON.parse(raw) as {
    gameFilesContainFiles?: boolean;
    local_game_data?: {
      localization?: {
        skills?: unknown[];
        characters?: unknown[];
        locations?: unknown[];
        artifacts?: unknown[];
        stats?: unknown[];
        resources?: unknown[];
        quests?: unknown[];
        events?: unknown[];
        rarities?: unknown[];
        end_states?: unknown[];
      };
      addressables?: { level_object_prefabs_count?: number };
      managed_code?: { enum_groups?: unknown[] };
      serialized_assets?: {
        object_counts?: unknown[];
        collectible_lists?: unknown[];
        gameplay_component_summaries?: {
          component_counts?: Record<string, number>;
        };
        stripped_mono_behaviours?: {
          characters?: unknown[];
          locations?: unknown[];
          artifacts?: unknown[];
          upgrade_assets?: unknown[];
          status_effect_upgrades?: unknown[];
          enemy_component_payloads?: unknown[];
          enemy_wave_data?: unknown[];
          enemy_arena_spawner_data?: unknown[];
          level_object_spawner_data?: unknown[];
          level_object_preset_data?: unknown[];
          quest_templates?: unknown[];
          achievement_conditions?: unknown[];
          game_modes?: unknown[];
          difficulty_levels?: unknown[];
          rarity_tables?: unknown[];
          terrain_height_data?: unknown[];
          terrain_texture_data?: unknown[];
          parse_errors?: unknown[];
        };
      };
    };
  };
  const local = metadata.local_game_data;
  const gameplayComponentCounts = local?.serialized_assets?.gameplay_component_summaries?.component_counts ?? {};
  const stripped = local?.serialized_assets?.stripped_mono_behaviours;
  const requiredGameplayComponents = [
    "ChestController",
    "CollectibleHeap",
    "CollectibleChallenge",
    "CollectiblePit",
    "QuickCollectibleSpawner",
    "TreeSpawnPointRoot",
    "HeapSpawner",
    "SpawnSlotsManager",
    "SimpleSpawnSlotManager",
    "StatusEffectBarsController",
    "CollectibleListSO"
  ];
  const missingGameplayComponents = requiredGameplayComponents.filter((component) => !gameplayComponentCounts[component]);
  const gameplayComponentTotal = Object.values(gameplayComponentCounts).reduce((sum, count) => sum + Number(count ?? 0), 0);
  const details = {
    gameFilesContainFiles: metadata.gameFilesContainFiles === true,
    localizedSkills: local?.localization?.skills?.length ?? 0,
    characters: local?.localization?.characters?.length ?? 0,
    locations: local?.localization?.locations?.length ?? 0,
    artifacts: local?.localization?.artifacts?.length ?? 0,
    stats: local?.localization?.stats?.length ?? 0,
    resources: local?.localization?.resources?.length ?? 0,
    quests: local?.localization?.quests?.length ?? 0,
    events: local?.localization?.events?.length ?? 0,
    rarities: local?.localization?.rarities?.length ?? 0,
    endStates: local?.localization?.end_states?.length ?? 0,
    levelObjectPrefabs: local?.addressables?.level_object_prefabs_count ?? 0,
    managedEnumGroups: local?.managed_code?.enum_groups?.length ?? 0,
    serializedObjectCountFiles: local?.serialized_assets?.object_counts?.length ?? 0,
    collectibleLists: local?.serialized_assets?.collectible_lists?.length ?? 0,
    extractedCharacterPayloads: stripped?.characters?.length ?? 0,
    extractedLocationPayloads: stripped?.locations?.length ?? 0,
    extractedArtifactPayloads: stripped?.artifacts?.length ?? 0,
    extractedUpgradePayloads: stripped?.upgrade_assets?.length ?? 0,
    extractedStatusEffectPayloads: stripped?.status_effect_upgrades?.length ?? 0,
    extractedEnemyPayloads: stripped?.enemy_component_payloads?.length ?? 0,
    extractedWaveTables: stripped?.enemy_wave_data?.length ?? 0,
    extractedLevelObjectSpawners: stripped?.level_object_spawner_data?.length ?? 0,
    extractedQuestTemplates: stripped?.quest_templates?.length ?? 0,
    extractedAchievementConditions: stripped?.achievement_conditions?.length ?? 0,
    extractedGameModes: stripped?.game_modes?.length ?? 0,
    extractedDifficultyLevels: stripped?.difficulty_levels?.length ?? 0,
    extractedRarityTables: stripped?.rarity_tables?.length ?? 0,
    extractedTerrainHeightRows: stripped?.terrain_height_data?.length ?? 0,
    extractedTerrainTextureRows: stripped?.terrain_texture_data?.length ?? 0,
    strippedParseErrors: stripped?.parse_errors?.length ?? 0,
    gameplayComponentTotal,
    gameplayComponentCounts,
    missingGameplayComponents
  };
  return {
    name: "local-game-file-extraction",
    ok:
      details.gameFilesContainFiles &&
      details.localizedSkills >= 100 &&
      details.characters >= 10 &&
      details.locations >= 16 &&
      details.artifacts >= 30 &&
      details.stats >= 40 &&
      details.resources >= 5 &&
      details.quests >= 40 &&
      details.events >= 10 &&
      details.rarities >= 4 &&
      details.endStates >= 3 &&
      details.levelObjectPrefabs >= 100 &&
      details.managedEnumGroups >= 120 &&
      details.serializedObjectCountFiles >= 7 &&
      details.collectibleLists >= 1 &&
      details.gameplayComponentTotal >= 300 &&
      details.missingGameplayComponents.length === 0 &&
      details.extractedCharacterPayloads >= 10 &&
      details.extractedLocationPayloads >= 16 &&
      details.extractedArtifactPayloads >= 30 &&
      details.extractedUpgradePayloads >= 60 &&
      details.extractedStatusEffectPayloads >= 60 &&
      details.extractedEnemyPayloads >= 300 &&
      details.extractedWaveTables >= 6 &&
      details.extractedLevelObjectSpawners >= 15 &&
      details.extractedQuestTemplates >= 40 &&
      details.extractedAchievementConditions >= 40 &&
      details.extractedGameModes >= 2 &&
      details.extractedDifficultyLevels >= 3 &&
      details.extractedRarityTables >= 4 &&
      details.extractedTerrainHeightRows >= 10 &&
      details.extractedTerrainTextureRows >= 10 &&
      details.strippedParseErrors === 0,
    details
  };
}

async function generatedPageCheck(): Promise<Check> {
  const files = await walk("src/content/docs/generated");
  const indexFiles = files.filter((file) => file.endsWith(`${path.sep}index.md`));
  const requiredGeneratedGroups = [
    ...REQUIRED_DATASETS,
    "frogs",
    "maps",
    "items",
    "upgrades",
    "skills",
    "status-effects",
    "tools",
    "companions",
    "waves",
    "spawners",
    "mechanics",
    "quests",
    "achievement-conditions",
    "modes",
    "terrain",
    "bosses",
    "enemies",
    "media"
  ];
  const categoryIndexFiles = [...new Set(requiredGeneratedGroups)].map((dataset) => path.join("src/content/docs/generated", dataset, "index.md"));
  const missingCategoryIndexes = categoryIndexFiles.filter((file) => !indexFiles.includes(file));
  const entityCounts = await Promise.all(
    REQUIRED_DATASETS.map(async (dataset) => {
      const rows = JSON.parse(await readFile(`src/data/${dataset}.json`, "utf8")) as unknown[];
      return rows.length;
    })
  );
  const expectedLegacyRows = entityCounts.reduce((sum, count) => sum + count, 0);
  const generatedSources = await Promise.all(files.filter((file) => file.endsWith(".md")).map(async (file) => ({ file, body: await readFile(file, "utf8") })));
  const staleMarkers = ["Source asset", "sharedassets", "payload bytes", "Payload bytes", "DataSO", "questID", "Hoodie_OLD", "Scissors_OLD"];
  const staleMarkerHits = generatedSources
    .flatMap(({ file, body }) => staleMarkers.filter((marker) => body.includes(marker)).map((marker) => ({ file, marker })))
    .slice(0, 20);
  const forbiddenGeneratedMarkers = ["wiki-card-grid", "wiki-card", "wiki-reference-card", "wiki-reference-grid", "wiki-chip-list", "wiki-card-list"];
  const forbiddenGeneratedMarkerHits = generatedSources
    .flatMap(({ file, body }) => forbiddenGeneratedMarkers.filter((marker) => body.includes(marker)).map((marker) => ({ file, marker })))
    .slice(0, 20);
  const forbiddenSkillSlugs = ["bat-fire", "bat-frost", "roll-fire", "tongue-fire"];
  const forbiddenSkillPages = forbiddenSkillSlugs.map((slug) => `src/content/docs/generated/skills/${slug}/index.md`).filter((file) => indexFiles.includes(file));
  const skillIndex = await readFile("src/content/docs/generated/skills/index.md", "utf8");
  const forbiddenSkillIndexHits = forbiddenSkillSlugs.filter((slug) => skillIndex.includes(`/generated/skills/${slug}/`));
  const requiredRelationshipPages = [
    "src/content/docs/generated/skills/adrenaline/index.md",
    "src/content/docs/generated/skills/baseball-bat/index.md",
    "src/content/docs/generated/skills/swift-roll/index.md",
    "src/content/docs/generated/skills/tongue-attack/index.md",
    "src/content/docs/generated/status-effects/bat-fire/index.md",
    "src/content/docs/generated/waves/level-1/index.md",
    "src/content/docs/generated/spawners/base-object-spawn/index.md",
    "src/content/docs/generated/mechanics/index.md",
    "src/content/docs/generated/quests/index.md",
    "src/content/docs/generated/achievement-conditions/index.md",
    "src/content/docs/generated/modes/index.md",
    "src/content/docs/generated/terrain/index.md",
    "src/content/docs/generated/media/index.md",
    "src/content/docs/generated/upgrades/curvy-tongue/index.md"
  ];
  const missingRelationshipPages = requiredRelationshipPages.filter((file) => !indexFiles.includes(file));
  const relationshipChecks = [
    {
      name: "skill-character-backlink",
      ok: (await readFile("src/content/docs/generated/skills/adrenaline/index.md", "utf8")).includes("/generated/frogs/zippy/")
    },
    {
      name: "map-wave-link",
      ok: (await readFile("src/content/docs/generated/maps/snowplain/index.md", "utf8")).includes("/generated/waves/level-1/")
    },
    {
      name: "map-spawner-link",
      ok: (await readFile("src/content/docs/generated/maps/snowplain/index.md", "utf8")).includes("/generated/spawners/base-object-spawn/")
    },
    {
      name: "upgrade-reward-backlink",
      ok: (await readFile("src/content/docs/generated/upgrades/curvy-tongue/index.md", "utf8")).includes("/generated/maps/snowplain/")
    },
    {
      name: "mechanics-split-pages-visible",
      ok:
        (await readFile("src/content/docs/generated/mechanics/index.md", "utf8")).includes("/generated/quests/") &&
        (await readFile("src/content/docs/generated/mechanics/index.md", "utf8")).includes("/generated/achievement-conditions/") &&
        (await readFile("src/content/docs/generated/quests/index.md", "utf8")).includes("Quest Templates") &&
        (await readFile("src/content/docs/generated/terrain/index.md", "utf8")).includes("Terrain")
    },
    {
      name: "public-media-gallery-visible",
      ok:
        (await readFile("src/content/docs/index.md", "utf8")).includes("/generated/media/") &&
        (await readFile("src/content/docs/index.md", "utf8")).includes("wiki-hero-media") &&
        (await readFile("src/content/docs/generated/media/index.md", "utf8")).includes("Full-Game Screenshots") &&
        ((await readFile("src/content/docs/generated/media/index.md", "utf8")).match(/steam-media-grid/g) ?? []).length >= 3 &&
        (await readFile("src/content/docs/generated/frogs/index.md", "utf8")).includes("steam-media-strip") &&
        !(await readFile("src/content/docs/generated/media/index.md", "utf8")).includes("game-files/")
    },
    {
      name: "bat-fire-links-to-baseball-bat",
      ok:
        !(await readFile("src/content/docs/generated/status-effects/bat-fire/index.md", "utf8")).includes("/generated/skills/bat-fire/") &&
        (await readFile("src/content/docs/generated/status-effects/bat-fire/index.md", "utf8")).includes("/generated/skills/baseball-bat/")
    },
    {
      name: "roll-fire-links-to-swift-roll",
      ok:
        !(await readFile("src/content/docs/generated/status-effects/roll-fire/index.md", "utf8")).includes("/generated/skills/roll-fire/") &&
        (await readFile("src/content/docs/generated/status-effects/roll-fire/index.md", "utf8")).includes("/generated/skills/swift-roll/")
    },
    {
      name: "tongue-fire-links-to-tongue-attack",
      ok:
        !(await readFile("src/content/docs/generated/status-effects/tongue-fire/index.md", "utf8")).includes("/generated/skills/tongue-fire/") &&
        (await readFile("src/content/docs/generated/status-effects/tongue-fire/index.md", "utf8")).includes("/generated/skills/tongue-attack/")
    }
  ];
  const failedRelationshipChecks = relationshipChecks.filter((check) => !check.ok);
  return {
    name: "generated-player-wiki",
    ok:
      missingCategoryIndexes.length === 0 &&
      missingRelationshipPages.length === 0 &&
      staleMarkerHits.length === 0 &&
      forbiddenGeneratedMarkerHits.length === 0 &&
      forbiddenSkillPages.length === 0 &&
      forbiddenSkillIndexHits.length === 0 &&
      failedRelationshipChecks.length === 0 &&
      indexFiles.length >= 330,
    details: {
      generatedIndexFiles: indexFiles.length,
      expectedCategoryIndexes: categoryIndexFiles.length,
      missingCategoryIndexes,
      expectedLegacyRows,
      missingRelationshipPages,
      staleMarkerHits,
      forbiddenGeneratedMarkerHits,
      forbiddenSkillPages,
      forbiddenSkillIndexHits,
      failedRelationshipChecks
    }
  };
}

async function walk(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) return walk(entryPath);
      if (entry.isFile()) return [entryPath];
      return [];
    })
  );
  return files.flat();
}

async function gitChecks(): Promise<Check[]> {
  const [status, ignoredGameFiles] = await Promise.all([
    run("git", ["status", "--short"]),
    run("git", ["check-ignore", "-q", "game-files/sentinel"])
  ]);
  return [
    {
      name: "git-status-readable",
      ok: status.exitCode === 0,
      details: { exitCode: status.exitCode, status: status.stdout }
    },
    {
      name: "game-files-gitignored",
      ok: ignoredGameFiles.exitCode === 0,
      details: { path: "game-files/sentinel" }
    }
  ];
}

async function astroCanonicalCheck(): Promise<Check> {
  const source = await readFile("astro.config.mjs", "utf8");
  return {
    name: "astro-canonical-custom-domain",
    ok: source.includes(`site: "${CUSTOM_SITE}"`),
    details: {
      expectedSite: CUSTOM_SITE,
      containsExpectedSite: source.includes(`site: "${CUSTOM_SITE}"`)
    }
  };
}

function commandCheck(name: string, result: CommandResult, expectSuccess: boolean): Check {
  return {
    name,
    ok: expectSuccess ? result.exitCode === 0 : result.exitCode !== 0,
    details: {
      command: result.command,
      exitCode: result.exitCode,
      stdoutTail: result.stdout.slice(-1200),
      stderrTail: result.stderr.slice(-1200)
    }
  };
}

async function main() {
  const checks: Check[] = [
    ...(await pathChecks()),
    ...(await packageChecks()),
    await dataCoverageCheck(),
    await localExtractionCheck(),
    await generatedPageCheck(),
    ...(await gitChecks()),
    await astroCanonicalCheck()
  ];

  const [validate, test, build, deployStatus] = await Promise.all([
    run("npm", ["run", "validate"]),
    run("npm", ["test"]),
    run("npm", ["run", "build"]),
    run("npm", ["run", "deploy:status"])
  ]);

  checks.push(commandCheck("command:validate", validate, true));
  checks.push(commandCheck("command:test", test, true));
  checks.push(commandCheck("command:build", build, true));
  checks.push(commandCheck("command:deploy-status", deployStatus, true));

  const deployReport = jsonFromCommand(deployStatus.stdout);
  const liveChecksPassed =
    typeof deployReport?.aliasHealth === "object" &&
    deployReport.aliasHealth !== null &&
    "liveChecksPassed" in deployReport.aliasHealth &&
    deployReport.aliasHealth.liveChecksPassed === true;
  checks.push({
    name: "production-live-checks",
    ok: liveChecksPassed,
    details: {
      stableAlias: CUSTOM_SITE,
      liveChecksPassed,
      nextStep: deployReport?.nextStep ?? null
    }
  });

  const missing = checks.filter((check) => !check.ok);
  const report = {
    ok: missing.length === 0,
    objective: "Unofficial informational FROGGY HATES SNOW reference wiki with extracted game-file data, relationship pages, validation, and Vercel deployment.",
    expectedRemainingBlocker: liveChecksPassed ? null : deployReport?.nextStep ?? "stable alias missing expected content",
    localDeployment: deployReport,
    checks,
    missing: missing.map((check) => ({ name: check.name, details: check.details }))
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

await main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
