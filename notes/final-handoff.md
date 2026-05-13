# Final Handoff

Checked: 2026-05-13

## Current State

The wiki is built, validated, pushed, and live on Vercel.

- GitHub: https://github.com/yaportmax/froggyhatessnow-wiki
- Live alias: https://froggyhatessnow-wiki.vercel.app
- Active deployment: `dpl_9sfAECn7mGysePvw3ms3cFpjGaSD`
- Active deployment URL: https://froggyhatessnow-wiki-77tyugqy7-yaportmax-5253s-projects.vercel.app
- Current source snapshot marker: `2026-05-13T13:41:44.440Z`

`npm run deploy:status` verifies the live alias, homepage, Steam source snapshot, source timestamp marker, and achievement matrix.

## Remaining Blocker

The custom domain is not registered yet. Porkbun still blocks API registration with:

```text
VERIFICATION_REQUIRED: Your account phone number and email address must be verified.
```

Latest confirmed purchase attempt:

- Command: `npm run domain:finish -- --confirm-register-and-dns`
- Check request id: `019e219a-80e4-723c-af60-4191806fc087`
- Create request id: `019e217f-e6ac-723c-8134-3613a780f093`
- Result: stopped before DNS, Astro site changes, build, or deploy.

Latest read-only domain status:

- Domain check request id: `019e2197-2689-7e28-b4e2-53c67ff6ded6`
- DNS retrieve request id: `019e2197-292b-7210-8e75-63a2a0ddc928`
- Latest status check request id: `019e219b-543c-759d-b33f-a63b336e08a5`
- Latest DNS retrieve request id: `019e219b-574a-7c84-af41-eac996f649f7`
- Result: `domain_available_not_registered`; DNS returned `INVALID_DOMAIN`.
- Direct `https://froggyhatessnow.wiki/` check: cannot resolve host.

## After Porkbun Verification

Run:

```bash
npm run domain:finish -- --confirm-register-and-dns
```

This guarded finisher registers `froggyhatessnow.wiki`, creates the Vercel A records in Porkbun DNS, switches `astro.config.mjs` to `https://froggyhatessnow.wiki`, rebuilds, deploys, reruns Vercel domain checks, and then verifies live page markers on both `https://froggyhatessnow.wiki` and `https://www.froggyhatessnow.wiki`.

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

Expected custom-domain live checks after deployment:

- Homepage contains `FROGGY HATES SNOW Wiki`.
- Steam source snapshot contains `All Steam News Items`.
- Steam source snapshot contains the current local `steam-snapshot.json` `generated_at` marker.
- Achievement source matrix contains `Loadout Names`.

## Do Not Mark Complete Until

- `froggyhatessnow.wiki` is registered.
- Porkbun DNS contains the expected Vercel A records.
- Vercel reports the apex and `www` domains configured.
- `astro.config.mjs` uses `site: "https://froggyhatessnow.wiki"`.
- The rebuilt/deployed site passes live checks on the custom domain.
