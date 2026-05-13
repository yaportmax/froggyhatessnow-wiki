# Completion Audit

Checked: 2026-05-13

## Objective

Build an unofficial, metadata-first SEO wiki for FROGGY HATES SNOW in this folder, with its own GitHub repo and domain path, seeded from public Steam/public web/safe local metadata, using Astro Starlight and TypeScript where practical. The wiki must be populated, generated, validated, documented, deployed or deployment-ready, and the domain researched and bought/configured if possible.

## Current Status

Blocked, not complete.

The wiki/scaffold/data/source/deploy work is complete and verified. The remaining explicit objective is the custom-domain purchase/DNS path: Porkbun still blocks registration with `VERIFICATION_REQUIRED` because the account phone number and email address must be verified. Fresh read-only account checks also show `0` Porkbun account credit and auto-topup disabled, while Porkbun's API registration endpoint uses account credit. The guarded finisher stops before DNS, Astro config, build, or deploy changes.

## Prompt-to-Artifact Checklist

| Requirement | Evidence | Status |
|---|---|---|
| Separate wiki folder in this repo | Current root: `/Users/myaport/Documents/maxyaport-codex-project/froggyhatessnow_wiki`. | Done |
| Own GitHub repo under `yaportmax` | `origin` is `https://github.com/yaportmax/froggyhatessnow-wiki.git`; `git rev-parse HEAD` and `git ls-remote origin refs/heads/main` are checked before handoff to confirm local and remote `main` match. | Done |
| Build with Astro Starlight | `astro.config.mjs`, `src/content/docs/`, Starlight dependencies, and `npm run build` pass. | Done |
| Use TypeScript where practical | Scripts are TypeScript/TSX and are exercised by `npm run validate`, `npm test`, `npm run fetch:steam`, and `npm run build`. Bare `npx tsc --noEmit` currently fails inside Starlight generated utility types (`astro:content` `RenderResult`), so build/test/validator execution is the reliable gate. | Done with noted typecheck caveat |
| Required project folders | `src/content/docs/`, `src/content/docs/generated/`, `src/data/`, `scripts/`, `public/`, `notes/`, and `game-files/` exist. | Done |
| Required named files | `.gitignore`, `README.md`, `AGENTS.md`, `package.json`, `astro.config.mjs`, all listed `src/data/*.json`, `scripts/scan-game-files.ts`, `scripts/generate-pages.ts`, `scripts/validate-data.ts`, required notes, and SEO/source endpoints `src/pages/robots.txt.ts` and `src/pages/llms.txt.ts` exist. | Done |
| `game-files/` local-only | `.gitignore` ignores `game-files/`; scan page says local metadata contributes no facts because the directory contains no files. | Done |
| SteamCMD demo acquisition | SteamCMD path was attempted and documented in `notes/public-research.md`; macOS SteamCMD and Docker fallback did not populate `game-files/`. | Blocked, documented |
| Safe metadata scanner | `scripts/scan-game-files.ts`; scanner handles missing/empty dirs, skips symlinks/binaries, emits summaries only. `npm test` covers missing dir, readable file/binary/symlink, and empty dir status. | Done |
| Extracted metadata notes | `notes/extracted-metadata.md` / `.json` show `gameFilesPresent: true`, `gameFilesContainFiles: false`, `filesScanned: 0`, `readable_files: 0`. | Done |
| Public metadata and source URLs | `scripts/fetch-steam-public-data.ts`, `src/data/steam-snapshot.json`, `src/data/public-sources.json`, `notes/public-research.md`, and source pages are present. | Done |
| Steam game sourcing prioritized | Snapshot generated `2026-05-13T15:47:17.883Z` includes all 15 Steam News API items from a 100-item request window, 11 direct Steam news/devlog sources, 70 confirmed Steam news/devlog terms, 42 achievement facts with public icon URLs, 20 parsed loadout-name rows, 14 full-game screenshots, 13 demo screenshots, Steam review summaries, external-source marker checks, 16 public gameplay claims, and research gaps. | Done |
| Do not invent facts / mark uncertainty | Validator enforces allowed statuses; data includes 136 `Verified`, 27 `Inferred`, and 2 `Needs verification` rows. Named roster/map/enemy/boss behavior gaps remain explicit. | Done |
| Structured datasets | 11 datasets exist with 165 entities: frogs 5, maps 5, tools 16, items 12, skills 29, companions 6, upgrades 7, bosses 5, enemies 5, achievements 42, glossary 33. | Done |
| Entity fields and sources | Validator checks required fields, source types, verification statuses, source IDs, related links, duplicate ids/slugs, and Verified entries without sources. | Done |
| Generated category/detail pages | `npm run generate` creates 165 entity detail pages and 11 category indexes; filesystem currently has 176 generated `index.md` files. | Done |
| Required static pages | Homepage, beginner guide, warmth guide, best upgrades, unlocks, game modes, FAQ, contribute, verification status, game metadata, source ledger, Steam source snapshot, and achievement source matrix exist under `src/content/docs/`. | Done |
| SEO targets | Page titles/descriptions and generated routes cover the requested terms for wiki, frogs, maps, tools, items, skills, achievements, unlocks, warmth guide, bosses, and game modes. `/robots.txt` points crawlers at the generated sitemap, `/llms.txt` summarizes source policy/snapshot metadata/key pages/category counts/primary public sources, and sitewide Open Graph/Twitter image tags use the public Steam header image URL. `astro.config.mjs` currently uses the Vercel alias until the custom domain is actually registered. | Done for deployed alias; custom canonical waits on domain |
| Package scripts | `dev`, `build`, `preview`, `scan`, `fetch:steam`, `refresh:data`, `generate`, `validate`, and `build:verified` exist, plus `test`, `deploy:*`, and `domain:*` helpers including `domain:finish:post-verification`, guarded Vercel registrar fallback scripts, `domain:finish:vercel-post-purchase`, the read-only `domain:health` final audit, and guarded `domain:commit-canonical` commit helper. | Done |
| README and AGENTS | Both exist and document workflow, source rules, validation/deploy/domain paths, and fail-loud behavior. | Done |
| Domain research | `notes/domain-options.md` lists all required candidates, registrar, registration/renewal prices, pros/cons, best recommendation, backups, Porkbun attempt history, and Vercel registrar fallback prices. `notes/porkbun-verification-support.md` contains the current support-ready blocker packet. | Done |
| Buy domain via Porkbun API and/or Chrome | Porkbun API confirms `froggyhatessnow.wiki` is available, non-premium, `$2.06` first year / `$26.26` renewal, but registration fails with `VERIFICATION_REQUIRED`. Read-only account checks confirm valid API credentials, `0` account credit, and auto-topup disabled, so credit/payment setup may also be needed after verification. Chrome plugin Node browser-control was not exposed; Computer Use could not attach to Chrome (`cgWindowNotFound`) even after opening a window, so UI verification could not proceed safely. | Blocked |
| Vercel deployment | Vercel project `yaportmax-5253s-projects/froggyhatessnow-wiki`; active deployment `dpl_FQR7LnA2gPZ4NHhodyEAmQZ6fo9P`; stable alias `https://froggyhatessnow-wiki.vercel.app` passes live checks including source marker `2026-05-13T15:47:17.883Z`. | Done |
| Custom domain DNS if registered | Vercel has `froggyhatessnow.wiki` and `www.froggyhatessnow.wiki` attached, but DNS is not configured because the domain is not registered. Porkbun DNS returns `INVALID_DOMAIN`. | Waiting on registration |
| Completion criteria | All criteria are met except “Buy the domain” and resulting DNS/custom-domain canonical verification. | Not complete |

## Latest Verification Commands

```bash
git status --short
git rev-parse HEAD
git ls-remote origin refs/heads/main
npm run validate
npm run audit:completion
npm test
npm run build
git diff --check
npm run deploy:status
npm run domain:status
npm run domain:health
npm run domain:finish -- --confirm-register-and-dns
curl -I --max-time 20 https://froggyhatessnow.wiki/
```

## Latest Results

- `git status --short`: clean before the latest script/doc edits; re-check after committing any audit or helper changes.
- `npm run validate`: validated 11 entity datasets plus `public-sources.json` and `steam-snapshot.json`.
- `npm run audit:completion`: consolidated goal-level audit exists and is expected to fail until the custom-domain registration/DNS/canonical gate passes.
- `npm test`: 2 test files, 10 tests passed.
- `npm run build`: 190 pages built; Pagefind indexed 189 pages.
- `npx tsc --noEmit`: currently fails in Starlight generated utility types (`astro:content` has no exported `RenderResult`); `npm run build`, `npm test`, and `npm run validate` pass.
- `git diff --check`: passed.
- `npm run deploy:status`: stable alias live checks passed for homepage, Steam source snapshot, current source timestamp, achievement matrix, homepage Open Graph image metadata, `/robots.txt`, and `/llms.txt`.
- `npm run domain:status`: `domain_available_not_registered`; latest check request id `019e220c-0e0a-7365-b1e6-33177486f862`, DNS retrieve request id `019e220c-111c-7ffa-945f-fc505d889e4d`.
- Read-only Porkbun account checks: `/ping` credentials valid; `/account/balance` reports `0` account credit; `/account/apiSettings` reports auto-topup disabled. Request ids: `019e2211-5316-7f37-be69-b58aa4a50816`, `019e2211-807a-7806-882d-e3a08507cf80`, `019e2211-ab74-724a-bbef-1efc02cc18d0`.
- `npm run domain:health`: expected failure while registration/DNS/canonical switch are incomplete. It now includes an `astro-canonical-site` check for `astro.config.mjs` in addition to Porkbun registration state, Vercel attachment, DNS A records, and custom-domain page markers.
- `npm run domain:finish:post-verification`: guarded post-verification wrapper exists; after registration/DNS it commits/pushes the canonical config before deployment and then deploys from the clean committed canonical state.
- `npm run domain:finish:vercel-post-purchase`: guarded non-financial fallback helper exists for after an approved Vercel registrar purchase. It refuses to run unless Vercel attachment and DNS are healthy, switches the Astro canonical site, validates/builds, and then delegates to `domain:commit-canonical -- --deploy-after-commit`.
- `npm run domain:commit-canonical`: guarded manual recovery helper exists; it commits/pushes the canonical config switch only after `domain:health` passes and only if `astro.config.mjs` is the sole dirty file. When run with `--deploy-after-commit`, it redeploys from the clean committed canonical state before the completion audit.
- `domain:register` and `domain:finish` now generate a fresh timestamped idempotency suffix by default so a post-verification attempt does not reuse the earlier failed `post-verification` create request.
- `npm run domain:finish -- --confirm-register-and-dns`: failed at `domain:register` with Porkbun `VERIFICATION_REQUIRED`; check request id `019e219a-80e4-723c-af60-4191806fc087`, create request id `019e217f-e6ac-723c-8134-3613a780f093`.
- `npm run domain:finish:post-verification`: latest confirmed attempt also stopped at `domain:register` with Porkbun `VERIFICATION_REQUIRED`; check request id `019e220c-60f0-74ba-8e06-3f80a7ec134d`, create request id `019e220c-6355-7ff9-bfc3-b7586cddb14e`.
- `curl -I --max-time 20 https://froggyhatessnow.wiki/`: `Could not resolve host`, as expected while the domain is unregistered.

## Remaining Work

1. Verify the Porkbun account phone number and email address outside this shell.
2. Confirm the Porkbun account has enough account credit or payment/autotopup enabled for the `$2.06` API registration.
3. Run:

   ```bash
   npm run domain:finish:post-verification
   ```

4. Confirm Porkbun DNS has:

   ```text
   A @ 76.76.21.21
   A www 76.76.21.21
   ```

5. Verify Vercel and live custom-domain behavior. The guarded finisher now checks homepage/source/matrix markers on both the apex and `www` custom domains and then runs `domain:health`; these manual commands are fallback evidence if needed:

   ```bash
   npx vercel domains inspect froggyhatessnow.wiki
   npx vercel domains inspect www.froggyhatessnow.wiki
   curl -I https://froggyhatessnow.wiki/
   curl -I https://www.froggyhatessnow.wiki/
   npm run domain:health
   npm run domain:commit-canonical
   npm run audit:completion
   npm run deploy:status
   ```

6. Only mark the goal complete after `froggyhatessnow.wiki` is registered, DNS resolves, `astro.config.mjs` uses `site: "https://froggyhatessnow.wiki"`, and live custom-domain checks pass.
