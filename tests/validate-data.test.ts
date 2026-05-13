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
