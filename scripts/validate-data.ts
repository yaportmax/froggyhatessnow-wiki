import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const REQUIRED_DATASETS = [
  "frogs",
  "maps",
  "tools",
  "items",
  "skills",
  "companions",
  "upgrades",
  "bosses",
  "enemies",
  "achievements",
  "glossary"
] as const;

const VALID_VERIFICATION_STATUSES = new Set(["Verified", "Inferred", "Needs verification"]);
const VALID_SOURCE_TYPES = new Set(["game_file", "public_source", "gameplay_note", "inferred", "unknown"]);
const ENTITY_REQUIRED_FIELDS = [
  "id",
  "slug",
  "name",
  "aliases",
  "category",
  "short_description",
  "effect",
  "unlock_method",
  "cost",
  "mode",
  "related_entities",
  "sources",
  "verification_status",
  "last_verified_game_version",
  "notes"
];
const SOURCE_REQUIRED_FIELDS = ["source_id", "type", "path_or_url", "label", "confidence", "notes"];
const PUBLIC_SOURCE_REQUIRED_FIELDS = ["id", ...SOURCE_REQUIRED_FIELDS];
const ALLOWED_JSON_FILES = [...REQUIRED_DATASETS, "public-sources", "steam-snapshot"];

export type ValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

type Entity = Record<string, unknown>;

async function readJsonArray(filePath: string, errors: string[]): Promise<unknown[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      errors.push(`${filePath}: expected a JSON array`);
      return [];
    }
    return parsed;
  } catch (error) {
    errors.push(`${filePath}: ${(error as Error).message}`);
    return [];
  }
}

async function readJsonRecord(filePath: string, errors: string[]): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) {
      errors.push(`${filePath}: expected a JSON object`);
      return {};
    }
    return parsed;
  } catch (error) {
    errors.push(`${filePath}: ${(error as Error).message}`);
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateSources(owner: string, sources: unknown, errors: string[]) {
  if (!Array.isArray(sources)) {
    errors.push(`${owner}: sources must be an array`);
    return;
  }

  sources.forEach((source, index) => {
    const prefix = `${owner}.sources[${index}]`;
    if (!isRecord(source)) {
      errors.push(`${prefix}: source must be an object`);
      return;
    }

    for (const field of SOURCE_REQUIRED_FIELDS) {
      if (!(field in source)) errors.push(`${prefix}: missing required field ${field}`);
    }

    if (typeof source.type !== "string" || !VALID_SOURCE_TYPES.has(source.type)) {
      errors.push(`${prefix}: invalid source type ${String(source.type)}`);
    }
    if (typeof source.source_id !== "string" || source.source_id.length === 0) {
      errors.push(`${prefix}: source_id must be a non-empty string`);
    }
  });
}

function validateEntityShape(dataset: string, entity: Entity, index: number, errors: string[]) {
  const prefix = `${dataset}[${index}]`;
  for (const field of ENTITY_REQUIRED_FIELDS) {
    if (!(field in entity)) errors.push(`${prefix}: missing required field ${field}`);
  }

  for (const field of ["id", "slug", "name", "category", "short_description", "effect", "unlock_method", "cost", "mode", "verification_status", "last_verified_game_version", "notes"]) {
    if (field in entity && typeof entity[field] !== "string") {
      errors.push(`${prefix}: ${field} must be a string`);
    }
  }

  for (const field of ["aliases", "related_entities"]) {
    if (field in entity && !Array.isArray(entity[field])) {
      errors.push(`${prefix}: ${field} must be an array`);
    }
  }

  if (typeof entity.verification_status !== "string" || !VALID_VERIFICATION_STATUSES.has(entity.verification_status)) {
    errors.push(`${prefix}: invalid verification_status ${String(entity.verification_status)}`);
  }

  validateSources(prefix, entity.sources, errors);

  if (entity.verification_status === "Verified" && Array.isArray(entity.sources) && entity.sources.length === 0) {
    errors.push(`${prefix}: Verified entry has no sources`);
  }
}

function validateSteamSnapshot(snapshot: Record<string, unknown>, errors: string[]) {
  for (const field of [
    "accessed_date",
    "generated_at",
    "source_policy",
    "sources",
    "apps",
    "reviews",
    "achievements",
    "public_gameplay_claims",
    "steam_news_findings",
    "research_gaps",
    "refresh_commands"
  ]) {
    if (!(field in snapshot)) errors.push(`steam-snapshot.json: missing required field ${field}`);
  }

  if (typeof snapshot.accessed_date !== "string") errors.push("steam-snapshot.json: accessed_date must be a string");
  if (!Array.isArray(snapshot.source_policy)) errors.push("steam-snapshot.json: source_policy must be an array");
  if (!isRecord(snapshot.sources)) errors.push("steam-snapshot.json: sources must be an object");
  if (!isRecord(snapshot.apps)) errors.push("steam-snapshot.json: apps must be an object");
  if (!isRecord(snapshot.reviews)) errors.push("steam-snapshot.json: reviews must be an object");
  if (!isRecord(snapshot.achievements)) errors.push("steam-snapshot.json: achievements must be an object");
  if (!Array.isArray(snapshot.public_gameplay_claims)) errors.push("steam-snapshot.json: public_gameplay_claims must be an array");
  if (!isRecord(snapshot.steam_news_findings)) errors.push("steam-snapshot.json: steam_news_findings must be an object");
  if (!Array.isArray(snapshot.research_gaps)) errors.push("steam-snapshot.json: research_gaps must be an array");

  const apps = isRecord(snapshot.apps) ? snapshot.apps : {};
  for (const key of ["full_game", "demo"]) {
    const app = apps[key];
    if (!isRecord(app)) {
      errors.push(`steam-snapshot.json: apps.${key} must be an object`);
      continue;
    }
    for (const field of ["app_id", "title", "type", "source_url", "api_url", "genres", "categories", "screenshots_count", "screenshots", "movies"]) {
      if (!(field in app)) errors.push(`steam-snapshot.json: apps.${key} missing required field ${field}`);
    }
    if (!Array.isArray(app.genres)) errors.push(`steam-snapshot.json: apps.${key}.genres must be an array`);
    if (!Array.isArray(app.categories)) errors.push(`steam-snapshot.json: apps.${key}.categories must be an array`);
    if (!Array.isArray(app.screenshots)) errors.push(`steam-snapshot.json: apps.${key}.screenshots must be an array`);
    if (!Array.isArray(app.movies)) errors.push(`steam-snapshot.json: apps.${key}.movies must be an array`);
    if (typeof app.screenshots_count === "number" && Array.isArray(app.screenshots) && app.screenshots_count !== app.screenshots.length) {
      errors.push(`steam-snapshot.json: apps.${key}.screenshots_count does not match screenshots length`);
    }
  }

  const claims = Array.isArray(snapshot.public_gameplay_claims) ? snapshot.public_gameplay_claims : [];
  claims.forEach((claim, index) => {
    const prefix = `steam-snapshot.json: public_gameplay_claims[${index}]`;
    if (!isRecord(claim)) {
      errors.push(`${prefix} must be an object`);
      return;
    }
    if (!Array.isArray(claim.source_ids)) {
      errors.push(`${prefix}.source_ids must be an array`);
    }
  });

  const reviews = isRecord(snapshot.reviews) ? snapshot.reviews : {};
  for (const key of ["full_game", "demo"]) {
    if (!(key in reviews)) errors.push(`steam-snapshot.json: reviews.${key} missing`);
  }

  const achievements = isRecord(snapshot.achievements) ? snapshot.achievements : {};
  for (const field of [
    "community_page_url",
    "global_percentages_api_url",
    "demo_global_percentages_api_url",
    "demo_global_percentages_api_status",
    "community_rows_count",
    "full_game_api_ids_count",
    "demo_api_ids_count",
    "facts",
    "highest_global_percentages",
    "lowest_global_percentages",
    "notes"
  ]) {
    if (!(field in achievements)) errors.push(`steam-snapshot.json: achievements missing required field ${field}`);
  }
  for (const field of ["community_rows_count", "full_game_api_ids_count", "demo_api_ids_count"]) {
    if (field in achievements && typeof achievements[field] !== "number") {
      errors.push(`steam-snapshot.json: achievements.${field} must be a number`);
    }
  }
  if (!Array.isArray(achievements.facts)) {
    errors.push("steam-snapshot.json: achievements.facts must be an array");
  } else {
    if (typeof achievements.community_rows_count === "number" && achievements.facts.length !== achievements.community_rows_count) {
      errors.push("steam-snapshot.json: achievements.facts length must match community_rows_count");
    }
    const factSlugs = new Set<string>();
    achievements.facts.forEach((fact, index) => {
      const prefix = `steam-snapshot.json: achievements.facts[${index}]`;
      if (!isRecord(fact)) {
        errors.push(`${prefix} must be an object`);
        return;
      }
      for (const field of ["title", "slug", "description", "steam_community_percent", "source_ids", "mentioned_entities", "notes"]) {
        if (!(field in fact)) errors.push(`${prefix}: missing required field ${field}`);
      }
      if (typeof fact.slug === "string") {
        if (factSlugs.has(fact.slug)) errors.push(`${prefix}: duplicate slug ${fact.slug}`);
        factSlugs.add(fact.slug);
      }
      if (typeof fact.steam_internal_name !== "string") {
        errors.push(`${prefix}: steam_internal_name must be a string`);
      }
      if (typeof fact.steam_global_percent_api !== "string") {
        errors.push(`${prefix}: steam_global_percent_api must be a string`);
      }
      if (!Array.isArray(fact.source_ids)) errors.push(`${prefix}.source_ids must be an array`);
      if (!Array.isArray(fact.mentioned_entities)) {
        errors.push(`${prefix}.mentioned_entities must be an array`);
      } else {
        fact.mentioned_entities.forEach((mentionedEntity, mentionedIndex) => {
          if (!isRecord(mentionedEntity)) {
            errors.push(`${prefix}.mentioned_entities[${mentionedIndex}] must be an object`);
            return;
          }
          for (const field of ["name", "id", "category", "certainty", "notes"]) {
            if (typeof mentionedEntity[field] !== "string") {
              errors.push(`${prefix}.mentioned_entities[${mentionedIndex}].${field} must be a string`);
            }
          }
        });
      }
    });
  }
}

export async function validateAllData(dataDir = path.resolve("src/data")): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const allEntities: Array<{ dataset: string; index: number; entity: Entity }> = [];
  const ids = new Map<string, string>();
  const slugs = new Map<string, string>();

  for (const dataset of REQUIRED_DATASETS) {
    const rows = await readJsonArray(path.join(dataDir, `${dataset}.json`), errors);
    rows.forEach((row, index) => {
      if (!isRecord(row)) {
        errors.push(`${dataset}[${index}]: entity must be an object`);
        return;
      }
      validateEntityShape(dataset, row, index, errors);
      allEntities.push({ dataset, index, entity: row });
    });
  }

  const publicSources = await readJsonArray(path.join(dataDir, "public-sources.json"), errors);
  const sourceIds = new Set<string>();
  publicSources.forEach((source, index) => {
    const prefix = `public-sources[${index}]`;
    if (!isRecord(source)) {
      errors.push(`${prefix}: source must be an object`);
      return;
    }
    for (const field of PUBLIC_SOURCE_REQUIRED_FIELDS) {
      if (!(field in source)) errors.push(`${prefix}: missing required field ${field}`);
    }
    if (typeof source.type !== "string" || !VALID_SOURCE_TYPES.has(source.type)) {
      errors.push(`${prefix}: invalid source type ${String(source.type)}`);
    }
    if (typeof source.id === "string") {
      if (sourceIds.has(source.id)) errors.push(`${prefix}: duplicate source id ${source.id}`);
      sourceIds.add(source.id);
    }
    if (typeof source.source_id === "string" && typeof source.id === "string" && source.source_id !== source.id) {
      errors.push(`${prefix}: source_id must match id`);
    }
  });

  const steamSnapshot = await readJsonRecord(path.join(dataDir, "steam-snapshot.json"), errors);
  validateSteamSnapshot(steamSnapshot, errors);

  for (const { dataset, index, entity } of allEntities) {
    const ref = `${dataset}[${index}]`;
    if (typeof entity.id === "string") {
      const duplicate = ids.get(entity.id);
      if (duplicate) errors.push(`${ref}: duplicate id ${entity.id}; first seen at ${duplicate}`);
      else ids.set(entity.id, ref);
    }
    if (typeof entity.slug === "string") {
      const duplicate = slugs.get(entity.slug);
      if (duplicate) errors.push(`${ref}: duplicate slug ${entity.slug}; first seen at ${duplicate}`);
      else slugs.set(entity.slug, ref);
    }
  }

  for (const { dataset, index, entity } of allEntities) {
    if (!Array.isArray(entity.sources)) continue;
    entity.sources.forEach((source, sourceIndex) => {
      if (!isRecord(source) || typeof source.source_id !== "string") return;
      if (!sourceIds.has(source.source_id)) {
        errors.push(`${dataset}[${index}].sources[${sourceIndex}]: source_id ${source.source_id} is not present in public-sources.json`);
      }
    });
  }

  if (Array.isArray(steamSnapshot.public_gameplay_claims)) {
    steamSnapshot.public_gameplay_claims.forEach((claim, index) => {
      if (!isRecord(claim) || !Array.isArray(claim.source_ids)) return;
      claim.source_ids.forEach((sourceId, sourceIndex) => {
        if (typeof sourceId !== "string") {
          errors.push(`steam-snapshot.json: public_gameplay_claims[${index}].source_ids[${sourceIndex}] must be a string`);
          return;
        }
        if (!sourceIds.has(sourceId)) {
          errors.push(`steam-snapshot.json: public_gameplay_claims[${index}].source_ids[${sourceIndex}] ${sourceId} is not present in public-sources.json`);
        }
      });
    });
  }

  const achievements = isRecord(steamSnapshot.achievements) ? steamSnapshot.achievements : {};
  if (Array.isArray(achievements.facts)) {
    achievements.facts.forEach((fact, index) => {
      if (!isRecord(fact) || !Array.isArray(fact.source_ids)) return;
      fact.source_ids.forEach((sourceId, sourceIndex) => {
        if (typeof sourceId !== "string") {
          errors.push(`steam-snapshot.json: achievements.facts[${index}].source_ids[${sourceIndex}] must be a string`);
          return;
        }
        if (!sourceIds.has(sourceId)) {
          errors.push(`steam-snapshot.json: achievements.facts[${index}].source_ids[${sourceIndex}] ${sourceId} is not present in public-sources.json`);
        }
      });
    });
  }

  for (const { dataset, index, entity } of allEntities) {
    if (!Array.isArray(entity.related_entities)) continue;
    for (const related of entity.related_entities) {
      if (typeof related !== "string") {
        errors.push(`${dataset}[${index}]: related_entities entries must be strings`);
        continue;
      }
      if (!ids.has(related) && !slugs.has(related)) {
        errors.push(`${dataset}[${index}]: broken related_entities link ${related}`);
      }
    }
  }

  try {
    const files = await readdir(dataDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const base = file.replace(/\.json$/, "");
      if (!ALLOWED_JSON_FILES.includes(base as (typeof ALLOWED_JSON_FILES)[number])) {
        warnings.push(`${file}: not part of the required data manifest`);
      }
    }
  } catch {
    // Missing directory is already reported by readJsonArray calls.
  }

  return { ok: errors.length === 0, errors, warnings };
}

async function main() {
  const dataDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve("src/data");
  const result = await validateAllData(dataDir);

  for (const warning of result.warnings) console.warn(`Warning: ${warning}`);
  if (!result.ok) {
    for (const error of result.errors) console.error(`Error: ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Validated ${REQUIRED_DATASETS.length} entity datasets plus public-sources.json and steam-snapshot.json`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
