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

- Command: `npm run domain:finish:post-verification`
- Check request id: `019e21e6-e51a-7786-95c9-efe33d7ff01b`
- Create request id: `019e21e6-e84d-7d71-96bc-2b2f010622da`
- Result: stopped before DNS, Astro site changes, build, or deploy.
- Browser fallback status: Chrome is installed and running, the Codex Chrome Extension is installed/enabled in `Profile 1`, and the native host manifest is correct. However, no Chrome browser-control tools are exposed in this session, and Computer Use currently cannot attach to Chrome (`cgWindowNotFound`). No UI purchase or verification action was completed.
- Support packet: `notes/porkbun-verification-support.md` contains the current request IDs, manual verification checklist, Gmail search notes, and a support message draft.

Latest read-only domain status:

- Domain check request id: `019e21e6-8c56-7892-b4b4-428ae8bf4597`
- DNS retrieve request id: `019e21e6-8fb7-7266-b347-a60fc0a695f8`
- Result: `domain_available_not_registered`; DNS returned `INVALID_DOMAIN`.
- Direct `https://froggyhatessnow.wiki/` check: cannot resolve host.

## After Porkbun Verification

Porkbun documentation points the manual account-contact path at `ACCOUNT` -> `Settings / Billing` -> `Account Owner and Recovery` for email/phone verification. Porkbun also documents that some accounts may need an ID verification flow through Veriff. Complete those account checks in Porkbun first; the shell cannot bypass them.

If the account verification UI does not clear the block, use `notes/porkbun-verification-support.md` to contact Porkbun support without exposing API keys, passwords, payment details, SMS codes, email verification codes, or ID documents.

Alternative registrar fallback: Vercel CLI quotes `froggyhatessnow.wiki` at `$2.99` purchase / `$23` renewal. `npm run domain:vercel-buy -- --confirm-financial-purchase --max-purchase-usd=2.99 --max-renewal-usd=23` wraps the purchase with a fresh price check and hard caps. This is a financial purchase path; run it only after explicit human approval. After a Vercel purchase and DNS propagation, run `npm run domain:finish:vercel-post-purchase`; it verifies Vercel/DNS readiness, switches `astro.config.mjs`, validates, builds, commits/pushes, deploys, and audits. See `notes/domain-options.md`.

Run:

```bash
npm run domain:finish:post-verification
npm run audit:completion
```

This guarded finisher registers `froggyhatessnow.wiki`, creates the Vercel A records in Porkbun DNS, switches `astro.config.mjs` to `https://froggyhatessnow.wiki`, validates/builds, commits and pushes the canonical config switch only if `astro.config.mjs` is the sole dirty file, deploys from that clean committed state, reruns Vercel domain checks, verifies live page markers on both `https://froggyhatessnow.wiki` and `https://www.froggyhatessnow.wiki`, and then runs `npm run domain:health` plus `npm run audit:completion`.

The standalone helper `npm run domain:commit-canonical -- --deploy-after-commit` remains available for manual recovery after custom-domain health passes. It refuses to commit unless `domain:health` passes, `astro.config.mjs` is the only dirty file, and local `main` matches `origin/main`; then it commits/pushes the canonical-domain config switch, redeploys from the clean committed canonical state, and runs `npm run audit:completion`.

The finisher now uses a fresh timestamped registration idempotency suffix by default. If overriding `--idempotency-suffix`, do not reuse `post-verification` or another suffix from a previous failed create request.

`npm run domain:health` is read-only. It checks the local Astro canonical site value, Vercel domain attachment, DNS A records for apex and `www`, and custom-domain page markers against the local Steam snapshot timestamp. Porkbun registration state is retained as an informational check so an alternate registrar path can still pass once DNS and live custom-domain checks are correct. It is expected to fail until registration/DNS/canonical setup is complete and `astro.config.mjs` points at the custom domain.

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
