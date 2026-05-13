import { mkdir, readFile, readdir, stat, writeFile, lstat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

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

export type ScanOptions = {
  gameFilesDir?: string;
  notesDir?: string;
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

export type ScanResult = {
  generated_at: string;
  gameFilesPresent: boolean;
  root: string;
  rules: string[];
  filesScanned: number;
  directoriesScanned: number;
  extension_counts: Record<string, number>;
  top_level_entries: string[];
  readable_files: ReadableFile[];
  skipped_files: SkippedFile[];
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
    "This report summarizes safe, readable metadata only. It does not redistribute game assets, binaries, source code, or large raw text dumps.",
    ""
  ];

  if (!result.gameFilesPresent) {
    lines.push("The game-files directory was not found or is not readable. Run `npm run scan` again after acquiring the demo files.");
    return `${lines.join("\n")}\n`;
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

export async function scanGameFiles(options: ScanOptions = {}): Promise<ScanResult> {
  const gameFilesDir = path.resolve(options.gameFilesDir ?? "game-files");
  const notesDir = path.resolve(options.notesDir ?? "notes");
  await mkdir(notesDir, { recursive: true });

  const result: ScanResult = {
    generated_at: new Date().toISOString(),
    gameFilesPresent: false,
    root: gameFilesDir,
    rules: [
      "Read only allowlisted text/metadata extensions.",
      "Do not follow symlinks.",
      "Do not copy assets, binaries, source code, or large raw text dumps.",
      "Emit short labels, keys, paths, counts, and source references only."
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
  await writeFile(path.join(notesDir, "extracted-metadata.json"), `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(path.join(notesDir, "extracted-metadata.md"), markdownReport(result));

  console.log(`Scanned ${result.filesScanned} files; summarized ${result.readable_files.length} readable metadata files.`);
  return result;
}

async function main() {
  await scanGameFiles();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
