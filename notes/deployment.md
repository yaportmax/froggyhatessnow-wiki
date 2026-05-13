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
gh repo create yaportmax/froggyhatessnow-wiki --public --source=. --remote=origin --push
```

## Vercel

The folder was linked to Vercel project `yaportmax-5253s-projects/froggyhatessnow-wiki`.

Production deploy completed on 2026-05-13:

- Current production URL: https://froggyhatessnow-wiki-f9lc3ztg3-yaportmax-5253s-projects.vercel.app
- Alias: https://froggyhatessnow-wiki.vercel.app
- Inspect URL: https://vercel.com/yaportmax-5253s-projects/froggyhatessnow-wiki/AZupxXhrt4RubkWyM5FXFKZZ9trE

The current deploy includes the expanded Steam source snapshot, Steam news/devlog findings, generated source ledger, game metadata page, and 177 static HTML pages. The build now clears Astro's local content cache in `prebuild` so restored Vercel caches do not emit stale duplicate-doc warnings.
Astro's `site` setting points to the Vercel alias until `froggyhatessnow.wiki` is actually registered and connected.

Live checks after this deploy:

- `https://froggyhatessnow-wiki.vercel.app/steam-source-snapshot/` returns 200 and contains the Direct Steam News Sources and Local Metadata Scan sections.
- `https://froggyhatessnow-wiki.vercel.app/game-metadata/` returns 200.

Command used:

```bash
npx vercel deploy --prod
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
