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
});
