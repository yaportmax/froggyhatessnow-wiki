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
const SOURCE_REQUIRED_FIELDS = ["type", "path_or_url", "label", "confidence", "notes"];
const PUBLIC_SOURCE_REQUIRED_FIELDS = ["id", ...SOURCE_REQUIRED_FIELDS];

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
  });

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
      if (![...REQUIRED_DATASETS, "public-sources"].includes(base as (typeof REQUIRED_DATASETS)[number] | "public-sources")) {
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

  console.log(`Validated ${REQUIRED_DATASETS.length} entity datasets plus public-sources.json`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
