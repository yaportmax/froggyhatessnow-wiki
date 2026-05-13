# FROGGY HATES SNOW Wiki

Unofficial metadata-first fan wiki for **FROGGY HATES SNOW**.

This project is built with Astro Starlight and seeded from public Steam metadata, the public Steam achievements page, public Steam review summaries, publisher metadata, and safe local metadata scanning.

## Current Data Coverage

- Full game Steam app ID: `3232380`
- Demo Steam app ID: `4037600`
- Parsed public achievements: `42`
- Generated entity pages: `153`
- Generated static HTML pages: `178`
- Verification statuses used: `Verified`, `Inferred`, `Needs verification`
- First-class source pages: `/game-metadata/`, `/steam-source-snapshot/`, `/achievement-source-matrix/`, and `/source-ledger/`

The strongest current source is Steam/public metadata. The source snapshot records Steam appdetails, review summaries, all public Steam screenshots currently exposed by appdetails, a 42-row achievement fact matrix, all 15 current Steam News API items with evidence classifications, volatile price/review/achievement data, and explicit research gaps. Steam news/devlogs now confirm 10 playable frogs, 16 locations, 60+ skills/tools/attacks/companions, demo progress carryover, Puff, Zippy, several launch/update skills, robotic helpers, Blue Gems, artifact rarity tiers, character main-attack concepts, quest-based meta-progression, and snow-system mechanics. Local demo file extraction is blocked in this shell; see `notes/public-research.md` and `notes/extracted-metadata.md`.

## Commands

```bash
npm install
npm run fetch:steam
npm run scan
npm run validate
npm run generate
npm run build
npm run dev
npm run domain:check
```

## Data Rules

- Do not invent facts.
- Mark uncertain information as `Needs verification`.
- Use only `Verified`, `Inferred`, or `Needs verification`.
- Keep `game-files/` local-only and gitignored.
- Do not redistribute proprietary assets, binaries, source code, decompiled content, DRM-bypassed material, or large raw text dumps.
- Do not modify files in `game-files/`.

## Steam Demo Acquisition

Target demo app: `4037600`.

Attempted command:

```bash
steamcmd +@sSteamCmdForcePlatformType windows +force_install_dir ./game-files +login anonymous +app_update 4037600 validate +quit
```

Result in this environment: Homebrew SteamCMD installed, but the macOS SteamCMD runtime hung after repeated Steam launch/assertion output and left `game-files/` empty. Docker fallback was attempted, but Docker/Rancher Desktop was not running.

When SteamCMD is working, rerun:

```bash
npm run scan
npm run validate
npm run generate
npm run build
```

## Deployment

The site builds as a static Astro/Starlight site.

- GitHub: https://github.com/yaportmax/froggyhatessnow-wiki
- Vercel production alias: https://froggyhatessnow-wiki.vercel.app
- Current custom-domain target: `froggyhatessnow.wiki`

Recommended domain from research: `froggyhatessnow.wiki`.

Domain registration was attempted through the Porkbun API and blocked by account verification: Porkbun requires the account email and phone number to be verified before the API can register the domain. The Vercel project already has `froggyhatessnow.wiki` and `www.froggyhatessnow.wiki` attached, ready for DNS after purchase. See `notes/domain-options.md`.

After the Porkbun account is verified:

```bash
npm run domain:register -- --max-cost-usd=2.06
npm run domain:dns
```

See `notes/domain-options.md` for pricing and next steps.
