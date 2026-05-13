# AGENTS.md

- Fail loudly: if a source, build, scan, validation, deployment, or domain step is blocked, record the concrete command and error instead of smoothing it over.
- Prefer public Steam metadata, public Steam community pages, publisher pages, safe local metadata, and user-provided notes over inference.
- Do not invent game facts. Use only `Verified`, `Inferred`, or `Needs verification`.
- Keep `game-files/` gitignored and local-only.
- Do not modify game files.
- Do not redistribute proprietary assets, binaries, source code, decompiled content, DRM-bypassed material, or large raw text dumps.
- Use the data scripts before editing generated pages manually:
  - `npm run fetch:steam`
  - `npm run scan`
  - `npm run validate`
  - `npm run generate`
- Generated pages under `src/content/docs/generated/` should be regenerated from `src/data/*.json`.
