import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { REQUIRED_DATASETS, validateAllData } from "../scripts/validate-data";

const tempDirs: string[] = [];

async function makeDataDir(overrides: Record<string, unknown[]> = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), "fhs-validate-"));
  tempDirs.push(dir);

  for (const dataset of REQUIRED_DATASETS) {
    const rows = overrides[dataset] ?? [];
    await writeFile(path.join(dir, `${dataset}.json`), JSON.stringify(rows, null, 2));
  }

  await writeFile(
    path.join(dir, "public-sources.json"),
    JSON.stringify(
      [
        {
          id: "steam-demo-store",
          source_id: "steam-demo-store",
          type: "public_source",
          path_or_url: "https://store.steampowered.com/app/4037600/",
          label: "Steam demo store page",
          confidence: "high",
          notes: "Public Steam listing"
        }
      ],
      null,
      2
    )
  );
  await writeFile(
    path.join(dir, "steam-snapshot.json"),
    JSON.stringify(
      {
        accessed_date: "2026-05-13",
        generated_at: "2026-05-13T00:00:00.000Z",
        source_policy: ["Test policy"],
        sources: {},
        apps: {
          full_game: {
            app_id: 3232380,
            title: "FROGGY HATES SNOW",
            type: "game",
            source_url: "https://store.steampowered.com/app/3232380/",
            api_url: "https://store.steampowered.com/api/appdetails?appids=3232380",
            genres: [],
            categories: [],
            screenshots_count: 0,
            screenshots: [],
            movies: []
          },
          demo: {
            app_id: 4037600,
            title: "FROGGY HATES SNOW Demo",
            type: "demo",
            source_url: "https://store.steampowered.com/app/4037600/",
            api_url: "https://store.steampowered.com/api/appdetails?appids=4037600",
            genres: [],
            categories: [],
            screenshots_count: 0,
            screenshots: [],
            movies: []
          }
        },
        reviews: {
          full_game: {},
          demo: {}
        },
        achievements: {
          community_page_url: "https://steamcommunity.com/stats/3232380/achievements/?l=english",
          global_percentages_api_url: "https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=3232380&format=json",
          demo_global_percentages_api_url: "https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=4037600&format=json",
          demo_global_percentages_api_status: 403,
          community_rows_count: 0,
          full_game_api_ids_count: 0,
          demo_api_ids_count: 0,
          facts: [],
          highest_global_percentages: [],
          lowest_global_percentages: [],
          notes: []
        },
        public_gameplay_claims: [],
        steam_news_findings: {},
        research_gaps: [],
        refresh_commands: []
      },
      null,
      2
    )
  );

  return dir;
}

function entity(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    slug: id,
    name: id,
    aliases: [],
    category: "tools",
    short_description: "Needs verification.",
    effect: "Needs verification.",
    unlock_method: "Needs verification.",
    cost: "Needs verification.",
    mode: "Needs verification.",
    related_entities: [],
    sources: [
      {
        source_id: "steam-demo-store",
        type: "public_source",
        path_or_url: "https://store.steampowered.com/app/4037600/",
        label: "Steam demo store page",
        confidence: "medium",
        notes: "Public Steam listing"
      }
    ],
    verification_status: "Needs verification",
    last_verified_game_version: "Needs verification",
    notes: "Stub.",
    ...extra
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("validateAllData", () => {
  test("accepts complete empty datasets plus public sources", async () => {
    const dir = await makeDataDir();

    const result = await validateAllData(dir);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("rejects invalid verification statuses", async () => {
    const dir = await makeDataDir({
      tools: [entity("heated-shovel", { verification_status: "Probably" })]
    });

    const result = await validateAllData(dir);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("invalid verification_status");
  });

  test("rejects duplicate ids and duplicate slugs across datasets", async () => {
    const dir = await makeDataDir({
      tools: [entity("snow-spoon")],
      items: [entity("snow-spoon", { category: "items" })]
    });

    const result = await validateAllData(dir);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("duplicate id");
    expect(result.errors.join("\n")).toContain("duplicate slug");
  });

  test("rejects broken related entity links", async () => {
    const dir = await makeDataDir({
      tools: [entity("thermometer", { related_entities: ["missing-entity"] })]
    });

    const result = await validateAllData(dir);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("broken related_entities");
  });

  test("rejects verified entries without sources", async () => {
    const dir = await makeDataDir({
      tools: [entity("verified-empty-source", { verification_status: "Verified", sources: [] })]
    });

    const result = await validateAllData(dir);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("Verified entry has no sources");
  });
});
