# Completion Audit

Checked: 2026-05-13

## Objective

Build an unofficial, metadata-first FROGGY HATES SNOW wiki in its own repo/domain path, seeded from public and safe metadata, with Astro Starlight, generated pages, validation, docs, deployment, domain research/registration, and clear blockers.

## Current Status

Blocked, not complete.

Everything is implemented, validated, pushed, and deployed to Vercel. The remaining blocker is the explicit custom-domain purchase/DNS path: Porkbun API registration is blocked by account verification, so the account phone number and email address must be verified before the domain can be registered.

## Prompt-to-Artifact Checklist

| Requirement | Evidence | Status |
|---|---|---|
| Separate wiki folder in this repo | Current project root is `/Users/myaport/Documents/maxyaport-codex-project/froggyhatessnow_wiki`. | Done |
| Own GitHub repo under `yaportmax` | Remote `origin` is `https://github.com/yaportmax/froggyhatessnow-wiki.git`; `git ls-remote origin refs/heads/main` returned a pushed `main` ref during audit. | Done |
| Astro Starlight app | `astro.config.mjs`, `src/content/docs/`, `src/content/docs/generated/`, `package.json`, and Starlight build are present. | Done |
| Expected folders | `src/content/docs`, `src/content/docs/generated`, `src/data`, `scripts`, `public`, `notes`, and `game-files` exist. | Done |
| Required files | `.gitignore`, `README.md`, `AGENTS.md`, `package.json`, all listed `src/data/*.json`, scanner/generator/validator scripts, and required notes exist. | Done |
| `game-files/` local-only | `git check-ignore -v game-files` returns `.gitignore:8:game-files/ game-files`. | Done |
| Other local/generated ignores | `goal.rtf`, `.vercel`, `dist`, `.astro`, and `.playwright-cli` are gitignored. | Done |
| Steam demo acquisition attempted | `notes/public-research.md` records the SteamCMD command and macOS/Docker blockers; `game-files/` is present but empty. | Blocked, documented |
| Safe metadata scanner | `scripts/scan-game-files.ts`; `npm run scan` completed and wrote empty safe metadata reports because no demo files were acquired. | Done |
| Extracted metadata notes | `notes/extracted-metadata.md` and `notes/extracted-metadata.json`; latest scan reports 0 files and 0 readable metadata files. | Done |
| Public metadata/source gathering | `scripts/fetch-steam-public-data.ts`, `src/data/steam-snapshot.json`, `src/data/public-sources.json`, `notes/public-research.md`. | Done |
| Steam game sourcing prioritized | Steam store/API, Steam achievements/API, review summaries, screenshots, direct Steam News API records, and Steam news/devlogs are recorded; source snapshot confirms 10 frogs, 16 locations, 60+ skills/tools/attacks/companions, demo progress carryover, Puff, Zippy, launch/update skills, helpers, Blue Gems, artifact tiers, character main-attack concepts, quest-based meta-progression, and snow mechanics. Current snapshot stores all 15 Steam News API items with evidence classifications, a 42-row achievement fact matrix, 20 parsed loadout-name rows, and all 14 full-game / 13 demo Steam screenshots currently exposed by appdetails. | Done |
| Structured datasets | 11 datasets exist with 153 total entities: frogs 5, maps 5, tools 16, items 12, skills 29, companions 6, upgrades 7, bosses 3, enemies 3, achievements 42, glossary 25. | Done |
| Entity source/status rules | `npm run validate` checks required fields, duplicate ids/slugs, verification statuses, source types, source IDs against `public-sources.json`, snapshot claim source IDs, related links, and Verified-without-source cases. | Done |
| Generated category/detail pages | `npm run generate` creates generated docs; current build includes 153 entity detail pages and 11 category indexes. | Done |
| Static pages | Homepage, beginner guide, warmth guide, best upgrades, unlocks, game modes, FAQ, contribution page, verification status, game metadata, source ledger, Steam source snapshot, and achievement source matrix exist under `src/content/docs/`. | Done |
| SEO basics | `astro.config.mjs` has canonical `site`; pages use descriptive titles/descriptions and generated category/detail routes. | Done |
| Package scripts | Required scripts are present: `dev`, `build`, `preview`, `scan`, `generate`, `validate`; additional `fetch:steam`, `deploy:status`, `deploy:publish`, `domain:check`, `domain:status`, `domain:register`, `domain:dns`, and `test` scripts are present. | Done |
| Tests | `npm test` passed 2 files / 9 tests. | Done |
| Build | `npm run build` passed and generated 178 pages; Pagefind indexed 177 pages. | Done |
| Vercel deployment | Stable alias inspection confirms `https://froggyhatessnow-wiki.vercel.app` is actively serving READY deployment `dpl_97aAFAYy6K71rgdiDABUQib1cWkJ` / `https://froggyhatessnow-wiki-6b2rs5abq-yaportmax-5253s-projects.vercel.app`. `npm run deploy:status` passes the homepage, Steam source snapshot, local Steam snapshot timestamp, and achievement matrix live checks. | Done |
| Live source page | `https://froggyhatessnow-wiki.vercel.app/steam-source-snapshot/` returns 200 and contains Steam News API items classified, All Steam News Items, Direct Steam News Sources, Local Metadata Scan, 14 full-game screenshot count, and Achievement Source Matrix link. | Done |
| Live achievement matrix page | `https://froggyhatessnow-wiki.vercel.app/achievement-source-matrix/` returns 200 and contains Milestone Series and Loadout Names sections. | Done |
| Live game metadata page | `https://froggyhatessnow-wiki.vercel.app/game-metadata/` returns 200. | Done |
| Domain research | `notes/domain-options.md` lists required candidates, prices, pros/cons, recommendation, backups, and sources. | Done |
| Domain purchase | `npm run domain:check` confirms `froggyhatessnow.wiki` is available, non-premium, `$2.06` first year / `$26.26` renewal. Latest guarded purchase attempt with a fresh idempotency suffix failed with Porkbun `VERIFICATION_REQUIRED`. | Blocked |
| Vercel domain setup | Vercel has `froggyhatessnow.wiki` and `www.froggyhatessnow.wiki` attached to the project. It reports DNS not configured and recommends `A froggyhatessnow.wiki 76.76.21.21` and `A www.froggyhatessnow.wiki 76.76.21.21`. | Waiting on purchase/DNS |
| README and AGENTS | Both exist and document workflow, data rules, deployment, domain blocker, and fail-loud behavior. | Done |

## Latest Verification Commands

```bash
npm run scan
npm run fetch:steam
npm run generate
npm run validate
npm test
npm run build
npm run deploy:status
npm run deploy:publish
npm run domain:check
npm run domain:status
npm run domain:dns
npx vercel domains inspect froggyhatessnow.wiki
npx vercel domains inspect www.froggyhatessnow.wiki
curl -fsS -o /tmp/froggy-live-home.html -w '%{http_code}\n' https://froggyhatessnow-wiki.vercel.app/
curl -fsS -o /tmp/froggy-live-steam.html -w '%{http_code}\n' https://froggyhatessnow-wiki.vercel.app/steam-source-snapshot/
curl -fsS -o /tmp/froggy-achievement-matrix.html -w '%{http_code}\n' https://froggyhatessnow-wiki.vercel.app/achievement-source-matrix/
curl -fsS -o /tmp/froggy-game-metadata.html -w '%{http_code}\n' https://froggyhatessnow-wiki.vercel.app/game-metadata/
```

## Latest Command Results

- `npm run scan`: scanned 0 files; summarized 0 readable metadata files.
- `npm run fetch:steam`: wrote 42 achievement rows, 42 full-game API percentage ids, 0 demo API ids, 61 Steam news/devlog terms across 10 direct news items, and classifications for all 15 current Steam News API items.
- `npm run generate`: generated 153 entity detail pages and 11 category indexes, including `/achievement-source-matrix/`.
- `npm run validate`: validated 11 entity datasets plus `public-sources.json` and `steam-snapshot.json`.
- `npm test`: 2 test files / 9 tests passed.
- `npm run build`: 178 pages built; 177 pages indexed by Pagefind.
- `npx vercel deploy --prod`: earlier deployment `dpl_CtCq5rTqmVrmgzvutbv6vXLNy9fr` READY; inspect URL `https://vercel.com/yaportmax-5253s-projects/froggyhatessnow-wiki/CtCq5rTqmVrmgzvutbv6vXLNy9fr`.
- Later `npx vercel deploy --prod`: deployment `dpl_BysoqF8R65bguRBehVoXhJXeRPYW` eventually resolved to `ERROR`; Vercel inspect returns JSON with a nonzero CLI exit code, so `deploy:status` now parses that case.
- Later `npx vercel deploy --prebuilt --prod`: deployment `dpl_J1kt8Sbkz5hSUBLvGjKMwjtPTm58` eventually became `READY`.
- `npm run deploy:publish`: built 178 pages, deployed production deployment `dpl_97aAFAYy6K71rgdiDABUQib1cWkJ`, and Vercel aliased it to `https://froggyhatessnow-wiki.vercel.app`, `froggyhatessnow.wiki`, and `www.froggyhatessnow.wiki`.
- `npm run deploy:status`: confirms stable alias `https://froggyhatessnow-wiki.vercel.app` resolves to READY deployment `dpl_97aAFAYy6K71rgdiDABUQib1cWkJ`, verifies baseline live pages, and passes the local-source freshness marker for `steam-snapshot.json` generated timestamp `2026-05-13T13:06:27.528Z`.
- `npm run domain:check`: `froggyhatessnow.wiki` available yes, type registration, price `2.06`, regularPrice `26.26`, premium no, request id `019e2161-f193-7a28-8341-409373b969be`.
- `npm run domain:status`: read-only check reports `domain_available_not_registered`, DNS retrieve returns `INVALID_DOMAIN`, and the helper prints the exact post-verification registration command; check request id `019e217e-6e81-73fb-988e-8ad4fa5fcd59`, DNS retrieve request id `019e217e-7149-7740-b27e-66fb10a6cc5a`.
- `npm run domain:register -- --max-cost-usd=2.06 --idempotency-suffix=audit-20260513-1`: guarded purchase attempt rechecked availability at `$2.06`, then Porkbun returned `VERIFICATION_REQUIRED`; check request id `019e2162-8fab-7bb3-a43d-f1d2e4eeb412`, create request id `019e2162-9228-713d-a94a-88112b03af51`.
- `npm run domain:dns`: blocked before registration; Porkbun returned `INVALID_DOMAIN`, request id `019e2160-0873-76b9-8ab8-72820b93f7bf`.
- Vercel domain inspect: apex and `www` domains found, edge network yes, DNS not configured, intended nameservers `ns1.vercel-dns.com` and `ns2.vercel-dns.com`, recommended records `A froggyhatessnow.wiki 76.76.21.21` and `A www.froggyhatessnow.wiki 76.76.21.21`.
- Live homepage, Steam source snapshot, achievement source matrix, and game metadata pages returned HTTP 200 on the Vercel alias.

## Remaining Work

1. Verify Porkbun account phone and email outside this shell.
2. Run `npm run domain:register -- --max-cost-usd=2.06 --idempotency-suffix=post-verification`.
3. Run `npm run domain:dns`.
4. Re-check:

   ```bash
   npx vercel domains inspect froggyhatessnow.wiki
   npx vercel domains inspect www.froggyhatessnow.wiki
   ```

5. After DNS is configured, update `astro.config.mjs` `site` to `https://froggyhatessnow.wiki`, rebuild, deploy, and verify canonical URLs.
