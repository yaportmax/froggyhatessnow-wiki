import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

  const screenshots = (appId: number, count: number) =>
    Array.from({ length: count }, (_, index) => ({
      id: index,
      thumbnail_url: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/test/ss_${index}.600x338.jpg`,
      full_url: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/test/ss_${index}.1920x1080.jpg`
    }));

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
        },
        {
          id: "steam-full-achievements-page",
          source_id: "steam-full-achievements-page",
          type: "public_source",
          path_or_url: "https://steamcommunity.com/stats/3232380/achievements/?l=english",
          label: "Steam community achievements page",
          confidence: "high",
          notes: "Public Steam achievements"
        },
        {
          id: "steam-full-global-achievement-percentages",
          source_id: "steam-full-global-achievement-percentages",
          type: "public_source",
          path_or_url: "https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=3232380&format=json",
          label: "Steam global achievement percentages API",
          confidence: "high",
          notes: "Public Steam achievement percentages"
        },
        {
          id: "digital-bandidos-page",
          source_id: "digital-bandidos-page",
          type: "public_source",
          path_or_url: "https://digitalbandidos.com/games/froggy-hates-snow/",
          label: "Digital Bandidos game page",
          confidence: "medium",
          notes: "Publisher page"
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
        generated_at: new Date().toISOString(),
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
            achievements_total: 1,
            screenshots_count: 10,
            screenshots: screenshots(3232380, 10),
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
            achievements_total: null,
            screenshots_count: 8,
            screenshots: screenshots(4037600, 8),
            movies: []
          }
        },
        reviews: {
          full_game: {
            num_reviews: 10,
            review_score: 8,
            review_score_desc: "Very Positive",
            total_positive: 12,
            total_negative: 1,
            total_reviews: 13
          },
          demo: {
            num_reviews: 10,
            review_score: 8,
            review_score_desc: "Very Positive",
            total_positive: 10,
            total_negative: 1,
            total_reviews: 11
          }
        },
        external_source_checks: [
          {
            source_id: "digital-bandidos-page",
            label: "Digital Bandidos game page",
            url: "https://digitalbandidos.com/games/froggy-hates-snow/",
            status: 200,
            ok: true,
            required_markers: ["Froggy Hates Snow"],
            matched_markers: ["Froggy Hates Snow"],
            notes: "Test source check"
          }
        ],
        achievements: {
          community_page_url: "https://steamcommunity.com/stats/3232380/achievements/?l=english",
          global_percentages_api_url: "https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=3232380&format=json",
          demo_global_percentages_api_url: "https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=4037600&format=json",
          demo_global_percentages_api_status: 403,
          community_rows_count: 1,
          full_game_api_ids_count: 1,
          demo_api_ids_count: 0,
          facts: [
            {
              title: "Test Achievement",
              slug: "test-achievement",
              description: "Test achievement condition",
              icon_url: "https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/3232380/test.jpg",
              steam_internal_name: "TEST_ACHIEVEMENT",
              steam_global_percent_api: "1.0",
              steam_community_percent: "1.0%",
              source_ids: ["steam-full-achievements-page", "steam-full-global-achievement-percentages"],
              mentioned_entities: [],
              notes: "Test fact"
            }
          ],
          highest_global_percentages: [{ name: "TEST_ACHIEVEMENT", percent: "1.0" }],
          lowest_global_percentages: [{ name: "TEST_ACHIEVEMENT", percent: "1.0" }],
          notes: []
        },
        public_gameplay_claims: [],
        steam_news_findings: {
          source_url: "https://steamcommunity.com/app/3232380/allnews/?l=english",
          api_url: "https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=3232380&count=20&maxlength=50000&format=json",
          fetched_news_item_count: 0,
          news_item_count: 0,
          playable_frogs_count: 0,
          locations_count: 0,
          minimum_combined_skills_tools_attacks_companions: 0,
          demo_progress_carries_over: false,
          confirmed_terms: [],
          all_news_items: [],
          news_items: [],
          notes: []
        },
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

async function addSteamNewsFixture(dir: string) {
  const publicSourcesPath = path.join(dir, "public-sources.json");
  const publicSources = JSON.parse(await readFile(publicSourcesPath, "utf8"));
  publicSources.push(
    {
      id: "steam-news-a",
      source_id: "steam-news-a",
      type: "public_source",
      path_or_url: "https://steam.example/news-a",
      label: "Steam news A",
      confidence: "high",
      notes: "Mapped gameplay devlog."
    },
    {
      id: "steam-news-b",
      source_id: "steam-news-b",
      type: "public_source",
      path_or_url: "https://steam.example/news-b",
      label: "Steam news B",
      confidence: "high",
      notes: "Mapped gameplay devlog."
    }
  );
  await writeFile(publicSourcesPath, JSON.stringify(publicSources, null, 2));

  const snapshotPath = path.join(dir, "steam-snapshot.json");
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  snapshot.steam_news_findings = {
    ...snapshot.steam_news_findings,
    fetched_news_item_count: 2,
    news_item_count: 2,
    confirmed_terms: ["Skill A", "Skill B"],
    news_items: [
      {
        source_id: "steam-news-a",
        gid: "gid-a",
        title: "Steam news A",
        date: "2026-05-01",
        url: "https://steam.example/news-a",
        feedname: "steam_community_announcements",
        author: "Developer",
        wiki_targets: ["skills"],
        verified_terms: ["Skill A"],
        supports: "Test mapped Steam news item A."
      },
      {
        source_id: "steam-news-b",
        gid: "gid-b",
        title: "Steam news B",
        date: "2026-05-02",
        url: "https://steam.example/news-b",
        feedname: "steam_community_announcements",
        author: "Developer",
        wiki_targets: ["tools"],
        verified_terms: ["Skill B"],
        supports: "Test mapped Steam news item B."
      }
    ],
    all_news_items: [
      {
        source_id: "steam-news-a",
        mapped_source_id: "steam-news-a",
        gid: "gid-a",
        title: "Steam news A",
        date: "2026-05-01",
        url: "https://steam.example/news-a",
        feedname: "steam_community_announcements",
        author: "Developer",
        classification: "gameplay_devlog",
        evidence_strength: "strong",
        fact_scope: ["mechanics"],
        claim_limits: "Do not infer exact balance values.",
        needs_gameplay_verification: true,
        wiki_targets: ["skills"],
        verified_terms: ["Skill A"],
        notes: "Test mapped Steam news item A."
      },
      {
        source_id: "steam-news-b",
        mapped_source_id: "steam-news-b",
        gid: "gid-b",
        title: "Steam news B",
        date: "2026-05-02",
        url: "https://steam.example/news-b",
        feedname: "steam_community_announcements",
        author: "Developer",
        classification: "gameplay_devlog",
        evidence_strength: "strong",
        fact_scope: ["mechanics"],
        claim_limits: "Do not infer exact balance values.",
        needs_gameplay_verification: true,
        wiki_targets: ["tools"],
        verified_terms: ["Skill B"],
        notes: "Test mapped Steam news item B."
      }
    ]
  };
  await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));
  return { snapshot, snapshotPath };
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

  test("rejects Steam news snapshots missing the all-news catalog", async () => {
    const dir = await makeDataDir();
    const snapshotPath = path.join(dir, "steam-snapshot.json");
    const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
    delete snapshot.steam_news_findings.all_news_items;
    await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));

    const result = await validateAllData(dir);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("steam_news_findings.all_news_items");
  });

  test("rejects malformed Steam news classification and mapping fields", async () => {
    const dir = await makeDataDir();
    const { snapshot, snapshotPath } = await addSteamNewsFixture(dir);
    snapshot.steam_news_findings.all_news_items[0].classification = "made_up";
    snapshot.steam_news_findings.all_news_items[0].evidence_strength = "strongish";
    snapshot.steam_news_findings.all_news_items[0].mapped_source_id = "steam-news-b";
    delete snapshot.steam_news_findings.all_news_items[1].mapped_source_id;
    snapshot.steam_news_findings.all_news_items[1].wiki_targets = [];
    snapshot.steam_news_findings.all_news_items[1].verified_terms = [];
    await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));

    const result = await validateAllData(dir);
    const errors = result.errors.join("\n");

    expect(result.ok).toBe(false);
    expect(errors).toContain("invalid classification made_up");
    expect(errors).toContain("invalid evidence_strength strongish");
    expect(errors).toContain("does not match mapped_source_id steam-news-b gid gid-b");
    expect(errors).toContain("missing required field mapped_source_id");
    expect(errors).toContain("gameplay-like classification must have wiki_targets");
    expect(errors).toContain("gameplay-like classification must have verified_terms");
  });
});
