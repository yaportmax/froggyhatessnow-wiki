# Final Handoff

Checked: 2026-05-13

## Current State

The wiki is built, validated, pushed, and live on Vercel.

- GitHub: https://github.com/yaportmax/froggyhatessnow-wiki
- Live alias: https://froggyhatessnow-wiki.vercel.app
- Active deployment: `dpl_GSpKH5VNt3rtwN1qbAQ6dVuhjiPZ`
- Active deployment URL: https://froggyhatessnow-wiki-mkh2govyh-yaportmax-5253s-projects.vercel.app
- Current source snapshot marker: `2026-05-13T14:41:46.504Z`

`npm run deploy:status` verifies the live alias, homepage, Steam source snapshot, source timestamp marker, and achievement matrix.

`npm run audit:completion` runs the consolidated goal-level audit. It is expected to fail until the custom-domain registration/DNS/canonical checks pass.

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
- Latest status check request id: `019e21ab-80ae-7745-b332-2ff15488d479`
- Latest DNS retrieve request id: `019e21ab-837a-79e8-b69a-70789fcf5b03`
- Result: `domain_available_not_registered`; DNS returned `INVALID_DOMAIN`.
- Direct `https://froggyhatessnow.wiki/` check: cannot resolve host.

## After Porkbun Verification

Run:

```bash
npm run domain:finish -- --confirm-register-and-dns --commit-canonical-after-success
npm run audit:completion
```

This guarded finisher registers `froggyhatessnow.wiki`, creates the Vercel A records in Porkbun DNS, switches `astro.config.mjs` to `https://froggyhatessnow.wiki`, rebuilds, deploys, reruns Vercel domain checks, verifies live page markers on both `https://froggyhatessnow.wiki` and `https://www.froggyhatessnow.wiki`, and then runs `npm run domain:health`.

With `--commit-canonical-after-success`, it also runs `npm run domain:commit-canonical`. That helper refuses to commit unless `domain:health` passes, `astro.config.mjs` is the only dirty file, and local `main` matches `origin/main`; then it commits/pushes the canonical-domain config switch and runs `npm run audit:completion`.

The finisher now uses a fresh timestamped registration idempotency suffix by default. If overriding `--idempotency-suffix`, do not reuse `post-verification` or another suffix from a previous failed create request.

`npm run domain:health` is read-only. It checks the local Astro canonical site value, Porkbun registration state, Vercel domain attachment, DNS A records for apex and `www`, and custom-domain page markers against the local Steam snapshot timestamp. It is expected to fail until the Porkbun verification/registration/DNS path is complete and `astro.config.mjs` points at the custom domain.

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
- `npm run domain:health` reports `"ok": true`.
- `npm run audit:completion` reports `"ok": true`.
- Local `main` and `origin/main` contain the custom-domain canonical config commit.
- `astro.config.mjs` uses `site: "https://froggyhatessnow.wiki"`.
- The rebuilt/deployed site passes live checks on the custom domain.
