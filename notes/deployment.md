# Deployment Notes

Checked: 2026-05-13

## Current State

- This folder is a standalone Astro Starlight app.
- Vercel is available through `npx vercel` in this shell.
- The parent repo has unrelated Vercel configuration for `maxyaport.com`; this wiki should use its own project.

## GitHub

Target owner: `yaportmax`.

Recommended repo name: `froggyhatessnow-wiki`.

Created and pushed on 2026-05-13:

- Repository: https://github.com/yaportmax/froggyhatessnow-wiki
- Initial commit: `91f2b3e` (`Scaffold Froggy Hates Snow wiki`)

Command used:

```bash
gh repo create yaportmax/froggyhatessnow-wiki --public --remote=origin --push
```

## Vercel

The folder was linked to Vercel project `yaportmax-5253s-projects/froggyhatessnow-wiki`.

Latest successful production deploy completed on 2026-05-13:

- Alias: https://froggyhatessnow-wiki.vercel.app
- Current production URL: https://froggyhatessnow-wiki-a40k9ddau-yaportmax-5253s-projects.vercel.app
- Deployment id: `dpl_6Ey7Ab2CJZHqCYanUFiPKgKfpmDu`
- Inspect URL: https://vercel.com/yaportmax-5253s-projects/froggyhatessnow-wiki/6Ey7Ab2CJZHqCYanUFiPKgKfpmDu

The last verified live deploy includes the refreshed Steam metadata snapshot generated at `2026-05-13T16:07:29.110Z`, all 15 Steam News API items with evidence classifications, 11 direct Steam news/devlog mappings, 70 confirmed Steam news/devlog terms, 42 achievement fact rows, explicit empty-local-metadata status, 16 public gameplay claims, and 25 static HTML pages. The generated data is exposed as compact player lookup tables rather than low-value entity detail stubs. The build clears Astro's local content cache in `prebuild` so restored Vercel caches do not emit stale duplicate-doc warnings.

Current local build after game-file extraction adds `/game-file-extraction/`, 26 static HTML pages, and safe local demo metadata: 135 localized skill/tool rows, 10 character names and specialties, 16 location names, 34 artifact names, 53 stat labels, 5 resource labels, 49 quest strings, 11 event notifications, 4 rarity labels, 3 end-state labels, 127 Addressables level-object prefabs, 124 managed enum groups, 29 ScriptableObject/DataSO type summaries, 1 collectible reward list, and 343 decoded gameplay component instances. Deploy again before treating those additions as live on the stable Vercel alias.
Astro's `site` setting points to the Vercel alias until `froggyhatessnow.wiki` is actually registered and connected.

Earlier deploy attempts after validator hardening are no longer blocking the queue:

- `dpl_BysoqF8R65bguRBehVoXhJXeRPYW` / `https://froggyhatessnow-wiki-md282qwlk-yaportmax-5253s-projects.vercel.app` resolved to `ERROR`.
- `dpl_J1kt8Sbkz5hSUBLvGjKMwjtPTm58` / `https://froggyhatessnow-wiki-kyvn13zp7-yaportmax-5253s-projects.vercel.app` resolved to `READY` and was superseded.
- `dpl_97aAFAYy6K71rgdiDABUQib1cWkJ` / `https://froggyhatessnow-wiki-6b2rs5abq-yaportmax-5253s-projects.vercel.app` resolved to `READY` and was superseded.
- `dpl_GzwdMMpkJi9My8f4SYEX9pSzPvAk` / `https://froggyhatessnow-wiki-lsdwxrtq5-yaportmax-5253s-projects.vercel.app` resolved to `READY` and was superseded.
- `dpl_8UYsVqC8BEkCweYPqWM6JEVQWd2p` / `https://froggyhatessnow-wiki-b3biql6p7-yaportmax-5253s-projects.vercel.app` resolved to `READY` and was superseded by `dpl_FQR7LnA2gPZ4NHhodyEAmQZ6fo9P`.
- `dpl_FQR7LnA2gPZ4NHhodyEAmQZ6fo9P` / `https://froggyhatessnow-wiki-7980rz2cq-yaportmax-5253s-projects.vercel.app` resolved to `READY` and was superseded by `dpl_6Ey7Ab2CJZHqCYanUFiPKgKfpmDu`.

Non-destructive checks on 2026-05-13 confirm the stable alias directly; `https://froggyhatessnow-wiki.vercel.app` resolves to READY deployment `dpl_6Ey7Ab2CJZHqCYanUFiPKgKfpmDu`, and the homepage, generated wiki markers, Open Graph image metadata, `/robots.txt`, and `/llms.txt` live checks pass.

```bash
npm run deploy:status
```

`npm run deploy:publish` is a guarded wrapper around the recovery path. It runs `deploy:status`, refuses to remove any remote deployment by default, and only clears stuck deployment ids when `--remove-stuck-after-approval` is passed. When `deploy:status` reports no blockers, run:

```bash
npm run deploy:publish
```

Live checks after this deploy:

- `https://froggyhatessnow-wiki.vercel.app/` returns 200 and contains the wiki landing page.
- `https://froggyhatessnow-wiki.vercel.app/generated/media/` returns 200 and contains the public Steam media gallery.
- `https://froggyhatessnow-wiki.vercel.app/generated/frogs/` returns 200 and contains the playable frog index.
- `https://froggyhatessnow-wiki.vercel.app/generated/mechanics/` returns 200 and contains mechanics terminology.
- `https://froggyhatessnow-wiki.vercel.app/generated/quests/` returns 200 and contains quest templates.
- `https://froggyhatessnow-wiki.vercel.app/generated/terrain/` returns 200 and contains snow and terrain concepts.

Command used:

```bash
npm run deploy:publish
```

GitHub repository connection in Vercel is still blocked by Vercel account setup:

```text
Failed to link yaportmax/froggyhatessnow-wiki. You need to add a Login Connection to your GitHub account first. (400)
```

Use the generated Vercel project for this wiki only, not the parent `maxyaport.com` project. Until the GitHub login connection is added in Vercel, deploy updates through the CLI.

## Custom Domain

Target domain: `froggyhatessnow.wiki`.

Vercel domain pre-attach completed on 2026-05-13 for both:

- `froggyhatessnow.wiki`
- `www.froggyhatessnow.wiki`

Current Vercel status:

- Registrar: third party
- Edge network: yes
- DNS configured: no
- Reason: the domain is not yet registered through Porkbun because Porkbun API registration is blocked by account email/phone verification.

Vercel's current recommended DNS records are:

```text
A froggyhatessnow.wiki 76.76.21.21
A www.froggyhatessnow.wiki 76.76.21.21
```

Vercel's alternative intended nameservers are:

```text
ns1.vercel-dns.com
ns2.vercel-dns.com
```

After Porkbun verification and registration, run:

```bash
npm run domain:dns
npx vercel domains inspect froggyhatessnow.wiki
npx vercel domains inspect www.froggyhatessnow.wiki
```
