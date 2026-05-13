# Final Handoff

Checked: 2026-05-13

## Current State

The wiki is built, validated, pushed, and live on Vercel.

- GitHub: https://github.com/yaportmax/froggyhatessnow-wiki
- Live alias: https://froggyhatessnow-wiki.vercel.app
- Active deployment: `dpl_97aAFAYy6K71rgdiDABUQib1cWkJ`
- Active deployment URL: https://froggyhatessnow-wiki-6b2rs5abq-yaportmax-5253s-projects.vercel.app
- Current source snapshot marker: `2026-05-13T13:06:27.528Z`

`npm run deploy:status` verifies the live alias, homepage, Steam source snapshot, source timestamp marker, and achievement matrix.

## Remaining Blocker

The custom domain is not registered yet. Porkbun still blocks API registration with:

```text
VERIFICATION_REQUIRED: Your account phone number and email address must be verified.
```

Latest confirmed purchase attempt:

- Command: `npm run domain:finish -- --confirm-register-and-dns --allow-dirty`
- Check request id: `019e2185-6426-7dd0-9f64-3a0a05e2e891`
- Create request id: `019e217f-e6ac-723c-8134-3613a780f093`
- Result: stopped before DNS, Astro site changes, build, or deploy.

## After Porkbun Verification

Run:

```bash
npm run domain:finish -- --confirm-register-and-dns
```

This guarded finisher registers `froggyhatessnow.wiki`, creates the Vercel A records in Porkbun DNS, switches `astro.config.mjs` to `https://froggyhatessnow.wiki`, rebuilds, deploys, and reruns Vercel domain checks.

Expected Porkbun DNS records:

```text
A @ 76.76.21.21
A www 76.76.21.21
```

Expected Vercel domain checks after DNS:

```bash
npx vercel domains inspect froggyhatessnow.wiki
npx vercel domains inspect www.froggyhatessnow.wiki
```

## Do Not Mark Complete Until

- `froggyhatessnow.wiki` is registered.
- Porkbun DNS contains the expected Vercel A records.
- Vercel reports the apex and `www` domains configured.
- `astro.config.mjs` uses `site: "https://froggyhatessnow.wiki"`.
- The rebuilt/deployed site passes live checks on the custom domain.
