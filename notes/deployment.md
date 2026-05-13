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

Creation was not performed from this shell because publishing a new public GitHub repo is externally visible. Once confirmed:

```bash
git init
git add .
git commit -m "Scaffold FROGGY HATES SNOW wiki"
gh repo create yaportmax/froggyhatessnow-wiki --public --source=. --remote=origin --push
```

## Vercel

After a repo exists and Vercel auth is configured:

```bash
npm run build
npx vercel
```

Use the generated Vercel project for this wiki only, not the parent `maxyaport.com` project.
