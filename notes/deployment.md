# Deployment Notes

Checked: 2026-05-13

## Current State

- This folder is a standalone Astro Starlight app.
- `vercel` is not installed on `PATH` in this shell.
- `VERCEL_TOKEN` is not set in this shell.
- The parent repo has unrelated Vercel configuration for `maxyaport.com`; this wiki should use its own project.

## GitHub

Target owner: `yaportmax`.

Recommended repo name: `froggyhatessnow-wiki`.

Created and pushed on 2026-05-13:

- Repository: https://github.com/yaportmax/froggyhatessnow-wiki
- Initial commit: `91f2b3e` (`Scaffold Froggy Hates Snow wiki`)

Command used:

```bash
gh repo create yaportmax/froggyhatessnow-wiki --public --source=. --remote=origin --push
```

## Vercel

The folder was linked to Vercel project `yaportmax-5253s-projects/froggyhatessnow-wiki`.

Production deploy completed on 2026-05-13:

- Current production URL: https://froggyhatessnow-wiki-13dnhhfhs-yaportmax-5253s-projects.vercel.app
- Alias: https://froggyhatessnow-wiki.vercel.app
- Inspect URL: https://vercel.com/yaportmax-5253s-projects/froggyhatessnow-wiki/EGjXha1ZXB49vQmNne4eE8WDEMBi

The current deploy includes the Steam source snapshot and source ledger pages. The build now clears Astro's local content cache in `prebuild` so restored Vercel caches do not emit stale duplicate-doc warnings.
Astro's `site` setting points to the Vercel alias until `froggyhatessnow.wiki` is actually registered and connected.

Command used:

```bash
npx vercel deploy --prod --yes
```

GitHub repository connection in Vercel is still blocked by Vercel account setup:

```text
Failed to link yaportmax/froggyhatessnow-wiki. You need to add a Login Connection to your GitHub account first. (400)
```

Use the generated Vercel project for this wiki only, not the parent `maxyaport.com` project. Until the GitHub login connection is added in Vercel, deploy updates through the CLI.
