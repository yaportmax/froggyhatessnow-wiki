# FROGGY HATES SNOW Wiki

Unofficial player guide and wiki for **FROGGY HATES SNOW**.

This project is built with Astro Starlight and seeded from public Steam metadata, the public Steam achievements page, public Steam review summaries, publisher metadata, and safe local metadata scanning.

## Current Data Coverage

- Full game Steam app ID: `3232380`
- Demo Steam app ID: `4037600`
- Parsed public achievements: `42`
- Data rows: `164`
- Player lookup table pages: `11`
- Generated static HTML pages: `26`
- Verification statuses used: `Verified`, `Inferred`, `Needs verification`
- Crawler manifests: `/robots.txt` and `/llms.txt`
- Media: `/generated/media/` exposes the public Steam header, full-game screenshots, demo screenshots, and video thumbnails.
- Social preview metadata: Open Graph and Twitter image tags use the public Steam header image URL.

The strongest current evidence is Steam/public metadata plus safe local demo file extraction. The site exposes the 164 data rows as compact player lookup tables instead of auto-generated entity stub pages. The Steam snapshot records appdetails, review summaries, public Steam screenshots currently exposed by appdetails, a 42-row achievement fact matrix, all 15 current Steam News API items with evidence classifications, volatile price/review/achievement data, and explicit research gaps. Steam news/devlogs confirm 10 playable frogs, 16 locations, 60+ skills/tools/attacks/companions, demo progress carryover, Puff, Zippy, several launch/update skills, robotic helpers, Blue Gems, artifact rarity tiers, character main-attack concepts, quest-based meta-progression, snow mechanics, and Devlog #4's broad enemy/boss attack-pattern/projectile/companion preview.

Local demo extraction now adds player-useful game-file facts without redistributing game assets: 135 localized skill/tool rows with short descriptions, 10 character names and specialties, 16 location names, 34 artifact names, 53 stat labels, 5 resource labels, 49 quest strings, 11 event notifications, 4 rarity labels, 3 end-state labels, 127 Addressables level-object prefabs, 124 managed enum groups, 29 ScriptableObject/DataSO type summaries, 1 collectible reward list, and 343 decoded gameplay component instances. See `notes/extracted-metadata.md`.

The Steam refresh fails loudly when expected public metadata structure drifts: it requests up to 100 Steam News items and errors if the feed may be truncated, derives the achievement count from Steam appdetails, checks non-Steam corroborating pages for marker text, and records the currently blocked demo achievement API separately.

## Commands

```bash
npm install
npm run fetch:steam
npm run scan
npm run refresh:data
npm run validate
npm run audit:completion
npm run generate
npm run build
npm run build:verified
npm run dev
npm run deploy:status
npm run deploy:publish
npm run r2:offload:tmp
npm run r2:offload:tmp:prune
npm run domain:check
npm run domain:status
npm run domain:account
npm run domain:finish
npm run domain:finish:vercel-post-purchase
npm run domain:health
npm run domain:commit-canonical
```

After Porkbun account verification clears a failed registration blocker, use a fresh registration idempotency suffix so Porkbun does not replay the earlier failed create response:

To check the current read-only Porkbun account prerequisites without attempting registration:

```bash
npm run domain:account
```

```bash
npm run domain:register -- --max-cost-usd=2.06
npm run domain:dns
```

The register helper generates a fresh timestamped idempotency suffix by default. If you pass `--idempotency-suffix` manually after a failed upstream create request, use a new value.

Or run the guarded finisher after verification:

```bash
npm run domain:finish:post-verification
npm run audit:completion
```

## Data Rules

- Do not invent facts.
- Mark uncertain information as `Needs verification`.
- Use only `Verified`, `Inferred`, or `Needs verification`.
- Keep `game-files/` local-only and gitignored.
- Do not redistribute proprietary assets, binaries, program code, decompiled content, DRM-bypassed material, or large raw text dumps.
- Do not modify files in `game-files/`.

## Heavy Local Artifacts

Cloudflare R2 credentials live in the gitignored `.env.local`. Use `npm run r2:offload:tmp` to copy ignored runtime artifacts from `tmp/` into the private `froggyhatessnow-wiki-heavy` R2 bucket. Use `npm run r2:offload:tmp:prune` only when the upload succeeds and the local `tmp/` artifacts can be removed.

The offload script refuses to upload `game-files/` because the project keeps game files local-only.

## Steam Demo Acquisition

Target demo app: `4037600`.

Attempted command:

```bash
steamcmd +@sSteamCmdForcePlatformType windows +force_install_dir ./game-files +login anonymous +app_update 4037600 validate +quit
```

Earlier result before macOS security approval: Homebrew SteamCMD installed, but the macOS SteamCMD runtime hung after repeated Steam launch/assertion output and left `game-files/` empty. Docker fallback was attempted, but Docker/Rancher Desktop was not running.

Current result after allowing `Breakpad.framework` in macOS settings: Homebrew SteamCMD launches successfully, and the Windows demo build is installed under `game-files/`. The current safe extractor reads public-like metadata, localization strings, Addressables paths, managed enum/type names, and compact serialized summaries. `game-files/` remains local-only and gitignored.

When SteamCMD is working, rerun:

```bash
npm run refresh:data
npm run build
```

## Deployment

The site builds as a static Astro/Starlight site.

- GitHub: https://github.com/yaportmax/froggyhatessnow-wiki
- Vercel production alias: https://froggyhatessnow-wiki.vercel.app
- Current custom-domain target: `froggyhatessnow.wiki`

Recommended domain from research: `froggyhatessnow.wiki`.

Domain registration was attempted through the Porkbun API and blocked by account verification: Porkbun requires the account email and phone number to be verified before the API can register the domain. The Vercel project already has `froggyhatessnow.wiki` and `www.froggyhatessnow.wiki` attached, ready for DNS after purchase. See `notes/domain-options.md`.

If Porkbun verification remains blocked and a Vercel purchase is explicitly approved, use:

```bash
npm run domain:vercel-price
npm run domain:vercel-buy -- --confirm-financial-purchase --max-purchase-usd=2.99 --max-renewal-usd=23
```

`domain:vercel-buy` re-quotes the domain and refuses to buy unless the confirmation flag and price caps pass.

After a Vercel registrar purchase and DNS propagation:

```bash
npm run domain:finish:vercel-post-purchase
```

The Vercel post-purchase finisher refuses to run unless the working tree is clean, local `main` matches `origin/main`, Vercel reports both custom-domain hostnames as configured, and DNS resolves to Vercel. It then switches the Astro canonical site, validates/builds, commits and pushes the canonical config through the existing `domain:commit-canonical -- --deploy-after-commit` gate, deploys, and runs the completion audit.

After the Porkbun account is verified:

```bash
npm run domain:finish:post-verification
npm run domain:health
```

The post-verification finisher registers the domain, configures Porkbun DNS, switches the Astro canonical site, validates/builds, commits and pushes the canonical `astro.config.mjs` change only if it is the sole dirty file, redeploys from the clean committed canonical state, inspects both Vercel domains, checks live markers on both the apex and `www` custom domains, and then runs `npm run domain:health` and `npm run audit:completion`. `npm run domain:health` is read-only and repeats the final Astro-canonical/Porkbun/Vercel/DNS/custom-domain marker audit; it should fail while Porkbun still reports `domain_available_not_registered` or while `astro.config.mjs` still points at the Vercel alias.

See `notes/domain-options.md` for pricing and next steps.

The concise remaining-blocker handoff is in `notes/final-handoff.md`.

`npm run audit:completion` is read-only except for normal build output. It verifies the goal-level artifact checklist, required scripts, data coverage, generated player tables, git state, validator, tests, build, deployed Vercel alias, and custom-domain health. It is expected to fail until the custom domain is registered, DNS resolves, and the Astro canonical site is switched.

`npm run deploy:status` is read-only. It checks which deployment the stable Vercel alias is actively serving, verifies key live wiki pages, compares `/llms.txt` against the local `steam-snapshot.json` timestamp, verifies `/robots.txt`, and reports any queued/building deployments without removing them.

`npm run deploy:publish` is guarded. By default it refuses to remove stuck remote deployments. After explicit approval to clear the Vercel queue, run:

```bash
npm run deploy:publish -- --remove-stuck-after-approval
```
