# Completion Audit

Checked: 2026-05-13

## Objective

Build an unofficial, metadata-first FROGGY HATES SNOW wiki in its own repo/domain path, seeded from public and safe metadata, with Astro Starlight, generated pages, validation, docs, deployment, domain research/registration, and clear blockers.

## Current Status

Blocked, not complete.

Everything is implemented, validated, pushed, and deployed except the explicit domain purchase requirement. Porkbun API registration is blocked by account verification: the account phone number and email address must be verified before the domain can be registered.

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
| Steam game sourcing prioritized | Steam store/API, Steam achievements/API, review summaries, screenshots, and Steam news/devlogs are recorded; source snapshot confirms 10 frogs, 16 locations, 60+ skills/tools/attacks/companions, demo progress carryover, Zippy, launch/update skills, helpers, Blue Gems, artifact tiers, and snow mechanics. | Done |
| Structured datasets | 11 datasets exist with 141 total entities: frogs 3, maps 2, tools 16, items 12, skills 29, companions 6, upgrades 7, bosses 2, enemies 3, achievements 42, glossary 19. | Done |
| Entity source/status rules | `npm run validate` checks required fields, duplicate ids/slugs, verification statuses, source types, related links, and Verified-without-source cases. | Done |
| Generated category/detail pages | `npm run generate` creates generated docs; current build includes 141 entity detail pages and 11 category indexes. | Done |
| Static pages | Homepage, beginner guide, warmth guide, best upgrades, unlocks, game modes, FAQ, contribution page, verification status, source ledger, and Steam source snapshot exist under `src/content/docs/`. | Done |
| SEO basics | `astro.config.mjs` has canonical `site`; pages use descriptive titles/descriptions and generated category/detail routes. | Done |
| Package scripts | Required scripts are present: `dev`, `build`, `preview`, `scan`, `generate`, `validate`; additional `fetch:steam`, `domain:check`, `domain:register`, `domain:dns`, and `test` scripts are present. | Done |
| Tests | `npm test` passed 2 files / 7 tests. | Done |
| Build | `npm run build` passed and generated 164 pages; Pagefind indexed 163 pages. | Done |
| Vercel deployment | Production deploy is READY at `https://froggyhatessnow-wiki-7a9shlj4d-yaportmax-5253s-projects.vercel.app`; stable alias `https://froggyhatessnow-wiki.vercel.app` returns 200. | Done |
| Live source page | `https://froggyhatessnow-wiki.vercel.app/steam-source-snapshot/` returns 200 and contains the Steam News & Devlogs table. | Done |
| Domain research | `notes/domain-options.md` lists required candidates, prices, pros/cons, recommendation, backups, and sources. | Done |
| Domain purchase | `npm run domain:check` confirms `froggyhatessnow.wiki` is available, non-premium, `$2.06` first year / `$26.26` renewal. Purchase attempts fail with Porkbun `VERIFICATION_REQUIRED`. | Blocked |
| Vercel domain setup | Vercel has `froggyhatessnow.wiki` and `www.froggyhatessnow.wiki` attached to the project. It reports DNS not configured and recommends `A froggyhatessnow.wiki 76.76.21.21` and `A www.froggyhatessnow.wiki 76.76.21.21`. | Waiting on purchase/DNS |
| README and AGENTS | Both exist and document workflow, data rules, deployment, domain blocker, and fail-loud behavior. | Done |

## Latest Verification Commands

```bash
npm run scan
npm run validate
npm test
npm run build
npm run domain:check
npm run domain:dns
npx vercel domains inspect froggyhatessnow.wiki
npx vercel domains inspect www.froggyhatessnow.wiki
curl -fsS -o /tmp/froggy-live-home.html -w '%{http_code}\n' https://froggyhatessnow-wiki.vercel.app/
curl -fsS -o /tmp/froggy-live-steam.html -w '%{http_code}\n' https://froggyhatessnow-wiki.vercel.app/steam-source-snapshot/
```

## Latest Command Results

- `npm run scan`: scanned 0 files; summarized 0 readable metadata files.
- `npm run validate`: validated 11 entity datasets plus `public-sources.json` and `steam-snapshot.json`.
- `npm test`: 2 test files / 7 tests passed.
- `npm run build`: 164 pages built; 163 pages indexed by Pagefind.
- `npm run domain:check`: `froggyhatessnow.wiki` available yes, type registration, price `2.06`, regularPrice `26.26`, premium no, request id `019e20f1-eb98-7952-a792-b855c6f2a08c`.
- `npm run domain:dns`: blocked before registration; Porkbun returned `INVALID_DOMAIN`, request id `019e20f4-1c03-7a52-ba90-64e1bb4a9fef`.
- Vercel domain inspect: apex and `www` domains found, edge network yes, DNS not configured, intended nameservers `ns1.vercel-dns.com` and `ns2.vercel-dns.com`, recommended records `A froggyhatessnow.wiki 76.76.21.21` and `A www.froggyhatessnow.wiki 76.76.21.21`.
- Live homepage and Steam source snapshot both returned HTTP 200.

## Remaining Work

1. Verify Porkbun account phone and email outside this shell.
2. Run `npm run domain:register -- --max-cost-usd=2.06`.
3. Run `npm run domain:dns`.
4. Re-check:

   ```bash
   npx vercel domains inspect froggyhatessnow.wiki
   npx vercel domains inspect www.froggyhatessnow.wiki
   ```

5. After DNS is configured, update `astro.config.mjs` `site` to `https://froggyhatessnow.wiki`, rebuild, deploy, and verify canonical URLs.
