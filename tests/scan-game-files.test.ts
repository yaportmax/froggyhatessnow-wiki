import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { scanGameFiles } from "../scripts/scan-game-files";

const tempDirs: string[] = [];

async function makeTempDir() {
  const dir = await mkdtemp(path.join(tmpdir(), "fhs-scan-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("scanGameFiles", () => {
  test("writes missing-directory notes without failing", async () => {
    const root = await makeTempDir();
    const result = await scanGameFiles({
      gameFilesDir: path.join(root, "game-files"),
      notesDir: path.join(root, "notes")
    });

    expect(result.gameFilesPresent).toBe(false);
    expect(result.filesScanned).toBe(0);
    expect(await readFile(path.join(root, "notes", "extracted-metadata.md"), "utf8")).toContain(
      "game-files directory was not found"
    );
  });

  test("records readable metadata and skips binaries and symlinks", async () => {
    const root = await makeTempDir();
    const gameFilesDir = path.join(root, "game-files");
    const notesDir = path.join(root, "notes");
    await mkdir(gameFilesDir);
    await writeFile(path.join(root, "outside.txt"), "outside should not be followed");
    await writeFile(path.join(gameFilesDir, "config.ini"), "[demo]\nmode=Demo\n");
    await writeFile(path.join(gameFilesDir, "image.png"), Buffer.from([0, 1, 2, 3]));
    await symlink(path.join(root, "outside.txt"), path.join(gameFilesDir, "outside-link.txt"));

    const result = await scanGameFiles({ gameFilesDir, notesDir });
    const json = JSON.parse(await readFile(path.join(notesDir, "extracted-metadata.json"), "utf8"));

    expect(result.gameFilesPresent).toBe(true);
    expect(json.readable_files.map((file: { relative_path: string }) => file.relative_path)).toContain("config.ini");
    expect(json.skipped_files.map((file: { relative_path: string }) => file.relative_path)).toContain("image.png");
    expect(json.skipped_files.map((file: { relative_path: string }) => file.relative_path)).toContain("outside-link.txt");
    expect(JSON.stringify(json)).not.toContain("outside should not be followed");
  });

  test("distinguishes an empty game-files directory from usable local metadata", async () => {
    const root = await makeTempDir();
    const gameFilesDir = path.join(root, "game-files");
    const notesDir = path.join(root, "notes");
    await mkdir(gameFilesDir);

    const result = await scanGameFiles({ gameFilesDir, notesDir });
    const markdown = await readFile(path.join(notesDir, "extracted-metadata.md"), "utf8");

    expect(result.gameFilesPresent).toBe(true);
    expect(result.gameFilesContainFiles).toBe(false);
    expect(markdown).toContain("exists, but it currently contains no files");
  });

  test("extracts player-useful Unity metadata from catalog, localization, and managed strings", async () => {
    const root = await makeTempDir();
    const gameFilesDir = path.join(root, "game-files");
    const notesDir = path.join(root, "notes");
    const dataDir = path.join(gameFilesDir, "FROGGY HATES SNOW_Data");
    const catalogDir = path.join(dataDir, "StreamingAssets", "aa");
    const managedDir = path.join(dataDir, "Managed");
    await mkdir(catalogDir, { recursive: true });
    await mkdir(managedDir, { recursive: true });
    await writeFile(
      path.join(gameFilesDir, "steamapps", "appmanifest_4037600.acf"),
      '"AppState"\n{\n  "appid" "4037600"\n  "name" "FROGGY HATES SNOW Demo"\n  "buildid" "22067860"\n}\n'
    ).catch(async () => {
      await mkdir(path.join(gameFilesDir, "steamapps"), { recursive: true });
      await writeFile(
        path.join(gameFilesDir, "steamapps", "appmanifest_4037600.acf"),
        '"AppState"\n{\n  "appid" "4037600"\n  "name" "FROGGY HATES SNOW Demo"\n  "buildid" "22067860"\n}\n'
      );
    });
    await writeFile(path.join(dataDir, "app.info"), "4037600\nFROGGY HATES SNOW Demo\n");
    await writeFile(path.join(dataDir, "boot.config"), "buildtarget=StandaloneWindows64\n");
    await writeFile(
      path.join(catalogDir, "catalog.json"),
      JSON.stringify({
        m_LocatorId: "AddressablesMainContentCatalog",
        m_InternalIds: [
          "FirstParty/Scenes/Main/Game",
          "FirstParty/Scenes/Main/Menu",
          "Assets/FirstParty/Prefabs/LevelObjects/AnomalyArea/IcedArea Big.prefab",
          "Assets/FirstParty/Prefabs/LevelObjects/AnomalyArea/Tornado Medium.prefab",
          "Assets/FirstParty/Prefabs/LevelObjects/Props/UFO Variant.prefab"
        ]
      })
    );
    await writeFile(path.join(catalogDir, "settings.json"), JSON.stringify({ m_AddressablesVersion: "1.22.3", m_buildTarget: "StandaloneWindows64" }));
    await writeFile(
      path.join(dataDir, "sharedassets0.assets"),
      [
        '      "key": "key"',
        '      "value": "en"',
        '      "key": "skill_map_name"',
        '      "value": "Map"',
        '      "key": "skill_map_description"',
        '      "value": "Gives information about unexplored resources around you"',
        '      "key": "character_1_name"',
        '      "value": "Froggy"',
        '      "key": "character_1_specialty"',
        '      "value": "Homebody"',
        '      "key": "location_1_name"',
        '      "value": "Snowy Desert"',
        '      "key": "artifact_5_name"',
        '      "value": "Warmth"',
        '      "key": "stats_heat_power"',
        '      "value": "Heat Power"',
        '      "key": "quest_kill_boss"',
        '      "value": "Defeat the boss"',
        '      "key": "res_blue_gems"',
        '      "value": "Blue Gems"',
        '      "key": "event_low_heat_level_title"',
        '      "value": "Low Heat"',
        '      "key": "event_low_heat_level_body"',
        '      "value": "Return home before you freeze"',
        '      "key": "rarity_legendary"',
        '      "value": "Legendary"',
        '      "key": "game_end_boss_defeated"',
        '      "value": "Boss Defeated"'
      ].join("\n")
    );
    await writeFile(
      path.join(managedDir, "Assembly-CSharp.dll"),
      ["AchievementDataSO", "FeatureID", "ArtifactID", "QuestLogicsID", "CompanionID", "VisualsID"].join("\n")
    );

    const result = await scanGameFiles({ gameFilesDir, notesDir, enablePythonExtractors: false });
    const json = JSON.parse(await readFile(path.join(notesDir, "extracted-metadata.json"), "utf8"));

    expect(result.local_game_data?.build.app_id).toBe("4037600");
    expect(json.local_game_data.addressables.scenes).toEqual(["FirstParty/Scenes/Main/Game", "FirstParty/Scenes/Main/Menu"]);
    expect(json.local_game_data.addressables.level_object_groups).toContainEqual({
      group: "AnomalyArea",
      count: 2,
      examples: ["IcedArea Big", "Tornado Medium"]
    });
    expect(json.local_game_data.localization.characters).toContainEqual({
      id: "character_1",
      name: "Froggy",
      specialty: "Homebody",
      source_keys: ["character_1_name", "character_1_specialty"]
    });
    expect(json.local_game_data.localization.skills).toContainEqual({
      id: "map",
      name: "Map",
      description: "Gives information about unexplored resources around you",
      source_keys: ["skill_map_name", "skill_map_description"]
    });
    expect(json.local_game_data.localization.quests).toContainEqual({
      id: "kill-boss",
      text: "Defeat the boss",
      source_key: "quest_kill_boss"
    });
    expect(json.local_game_data.localization.resources).toContainEqual({
      id: "blue-gems",
      name: "Blue Gems",
      source_key: "res_blue_gems"
    });
    expect(json.local_game_data.localization.events).toContainEqual({
      id: "low-heat-level",
      title: "Low Heat",
      body: "Return home before you freeze",
      source_keys: ["event_low_heat_level_title", "event_low_heat_level_body"]
    });
    expect(json.local_game_data.localization.rarities).toContainEqual({
      id: "legendary",
      name: "Legendary",
      source_key: "rarity_legendary"
    });
    expect(json.local_game_data.localization.end_states).toContainEqual({
      id: "boss-defeated",
      name: "Boss Defeated",
      source_key: "game_end_boss_defeated"
    });
    expect(json.local_game_data.managed_code.detected_type_names).toContain("AchievementDataSO");
    expect(json.local_game_data.managed_code.detected_markers).toEqual(
      expect.arrayContaining(["FeatureID", "ArtifactID", "QuestLogicsID", "CompanionID", "VisualsID"])
    );
  });
});
