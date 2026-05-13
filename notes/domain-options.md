# Domain Options

Checked: 2026-05-13

Porkbun API/domain research indicates all checked candidates are available and non-premium. No registration was completed from this shell because Porkbun requires account email and phone verification before API registration can complete.

| Domain | Available | First Year | Renewal | Pros | Cons |
|---|---:|---:|---:|---|---|
| `froggyhatessnow.wiki` | yes | $2.06 | $26.26 | Best exact-match wiki domain for SEO and user intent. | Renewal is higher than `.com`. |
| `froggyhatessnowwiki.com` | yes | $11.08 | $11.08 | Exact-ish `.com`, stable renewal. | Longer and less clean. |
| `froggywiki.com` | yes | $11.08 | $11.08 | Short, durable `.com`. | Less exact-match for full title searches. |
| `fhswiki.com` | yes | $11.08 | $11.08 | Short and cheap. | Ambiguous branding. |
| `froggyhatessnow.net` | yes | $12.52 | $12.52 | Exact game title. | Less wiki-specific. |
| `froggy-hates-snow.wiki` | yes | $2.06 | $26.26 | Readable exact title. | Hyphens are clunkier. |
| `froggyhatessnow.gg` | yes | $51.80 | $51.80 | Game-community feel. | Expensive renewal. |

## Recommendation

Best: `froggyhatessnow.wiki`.

Backup: `froggywiki.com`.

Avoid `froggyhatessnow.gg` unless the game-community branding is worth the much higher renewal.

## Vercel Registrar Fallback

Vercel CLI can quote and buy domains directly with `npx vercel domains price` and `npx vercel domains buy`. This is a financial purchase path and should not be run automatically without explicit human approval.

Read-only Vercel price checks on 2026-05-13:

| Domain | Vercel Purchase | Vercel Renewal | Notes |
|---|---:|---:|---|
| `froggyhatessnow.wiki` | $2.99 | $23 | Direct fallback for the preferred custom domain if Porkbun verification remains blocked. |
| `froggy-hates-snow.wiki` | $2.99 | $23 | Hyphenated fallback. |
| `froggyhatessnowwiki.com` | $11.25 | $11.25 | `.com` exact-ish fallback. |
| `froggywiki.com` | $11.25 | $11.25 | Short `.com` fallback. |
| `fhswiki.com` | $11.25 | $11.25 | Short but ambiguous. |
| `froggyhatessnow.net` | $13.50 | $13.50 | Exact title, less wiki-specific. |
| `froggyhatessnow.gg` | n/a | n/a | Vercel CLI reported the TLD is not supported for price lookup. |

If Vercel registration is approved, the command shape is:

```bash
npm run domain:vercel-buy -- --confirm-financial-purchase --max-purchase-usd=2.99 --max-renewal-usd=23
```

The wrapper first re-quotes Vercel pricing, refuses to proceed without the confirmation flag, and refuses if either the purchase or renewal quote exceeds the supplied caps. It then runs `npx vercel domains buy froggyhatessnow.wiki --scope yaportmax-5253s-projects`.

After a non-Porkbun registration path, verify the Vercel attachment, DNS, and live custom-domain markers before switching the Astro canonical site. `npm run domain:health` keeps Porkbun status as informational and accepts any registrar path if Vercel attachment, DNS, canonical config, and custom-domain HTTP checks all pass.

For the Vercel registrar path, the expected post-purchase sequence is:

1. Verify `froggyhatessnow.wiki` and `www.froggyhatessnow.wiki` resolve in Vercel.
2. Run:

   ```bash
   npm run domain:finish:vercel-post-purchase
   ```

The post-purchase helper refuses to run unless the working tree is clean, local `main` matches `origin/main`, Vercel reports both custom-domain hostnames as properly configured, and DNS A lookups resolve to Vercel. It then switches `astro.config.mjs` to `site: "https://froggyhatessnow.wiki"`, validates, builds, commits/pushes the canonical config through `domain:commit-canonical -- --deploy-after-commit`, and runs the completion audit. `domain:commit-canonical` intentionally runs `domain:health` before committing, so the helper performs the local canonical switch immediately before calling it.

## Registration Status

Attempted registration for `froggyhatessnow.wiki` on 2026-05-13 through the Porkbun API.

Result: not registered. Porkbun returned `VERIFICATION_REQUIRED`: the account phone number and email address must be verified before API registration can complete.

Manual verification path from Porkbun's own account-contact documentation:

1. Log in to Porkbun.
2. Open `ACCOUNT` -> `Settings / Billing`.
3. Use the `Account Owner and Recovery` section to verify/update the primary account email, backup email, and other account contact details.

Porkbun's subaccount documentation also identifies the same `Account Owner and Recovery` section as the place to verify the parent account email address and phone number. Porkbun separately documents that some new accounts may be prompted for photo ID verification through Veriff.

Registration request details:

- Domain: `froggyhatessnow.wiki`
- Cost submitted: 206 pennies (`$2.06`)
- First-year price confirmed by API immediately before registration: `$2.06`
- Renewal price confirmed by API: `$26.26`
- First API request id: `019e20c7-c838-7a7c-ae42-9b9c7324c750`

A second registration attempt on 2026-05-13 rechecked `froggyhatessnow.wiki` as available at `$2.06` first-year / `$26.26` renewal, then received the same Porkbun account-verification blocker.

- Second API request id: `019e20dc-0225-7121-b271-383668a2a5fd`

A third registration attempt through the repo helper command also rechecked `froggyhatessnow.wiki` as available at `$2.06` first-year / `$26.26` renewal, non-premium, then received the same account-verification blocker.

- Command: `npm run domain:register -- --max-cost-usd=2.06`
- Check request id: `019e20e6-a9ca-761f-8278-7c0dc7034b64`
- Create request id: `019e20e6-ac46-7d0d-a14d-e794d764be52`
- Error code: `VERIFICATION_REQUIRED`

A fourth guarded registration attempt on 2026-05-13 again rechecked `froggyhatessnow.wiki` as available at `$2.06` first-year / `$26.26` renewal, non-premium, then received the same account-verification blocker. Porkbun returned the same create request id because the helper uses a daily idempotency key.

- Command: `npm run domain:register -- --max-cost-usd=2.06`
- Check request id: `019e215f-c9b2-778d-82a0-1b2ed3b5184c`
- Create request id: `019e20e6-ac46-7d0d-a14d-e794d764be52`
- Error code: `VERIFICATION_REQUIRED`

A fifth guarded registration attempt on 2026-05-13 used a fresh idempotency suffix to confirm the blocker was not just a replayed failed request. It again rechecked `froggyhatessnow.wiki` as available at `$2.06` first-year / `$26.26` renewal, non-premium, then received the same account-verification blocker with a new create request id.

- Command: `npm run domain:register -- --max-cost-usd=2.06 --idempotency-suffix=audit-20260513-1`
- Check request id: `019e2162-8fab-7bb3-a43d-f1d2e4eeb412`
- Create request id: `019e2162-9228-713d-a94a-88112b03af51`
- Error code: `VERIFICATION_REQUIRED`

A sixth guarded registration attempt on 2026-05-13 used the documented post-verification idempotency suffix. It again rechecked `froggyhatessnow.wiki` as available at `$2.06` first-year / `$26.26` renewal, non-premium, then received the same account-verification blocker with a new create request id.

- Command: `npm run domain:register -- --max-cost-usd=2.06 --idempotency-suffix=post-verification`
- Check request id: `019e217f-e3bf-705f-a270-7f817191c0e0`
- Create request id: `019e217f-e6ac-723c-8134-3613a780f093`
- Error code: `VERIFICATION_REQUIRED`

A confirmed `domain:finish` attempt on 2026-05-13 stopped at the same registration gate before DNS, Astro site, build, or deploy steps ran. It reused the post-verification idempotency key, so Porkbun replayed the same create request id.

- Command: `npm run domain:finish -- --confirm-register-and-dns --allow-dirty`
- Check request id: `019e2185-6426-7dd0-9f64-3a0a05e2e891`
- Create request id: `019e217f-e6ac-723c-8134-3613a780f093`
- Error code: `VERIFICATION_REQUIRED`

A follow-up confirmed `domain:finish` attempt on 2026-05-13, after the Steam-source refresh deployment, again stopped at the same registration gate before DNS, Astro site, build, or deploy steps ran. It reused the post-verification idempotency key, so Porkbun replayed the same create request id.

- Command: `npm run domain:finish -- --confirm-register-and-dns`
- Check request id: `019e219a-80e4-723c-af60-4191806fc087`
- Create request id: `019e217f-e6ac-723c-8134-3613a780f093`
- Error code: `VERIFICATION_REQUIRED`

A post-verification finisher attempt on 2026-05-13 used a fresh timestamped idempotency suffix and still stopped at the same registration gate before DNS, Astro site, build, or deploy steps ran.

- Command: `npm run domain:finish:post-verification`
- Check request id: `019e21d5-2161-7212-9556-3bf098d88f96`
- Create request id: `019e21d5-23f8-7df7-b4e0-7d21ca0f9494`
- Error code: `VERIFICATION_REQUIRED`

A later post-verification finisher attempt on 2026-05-13 again used a fresh timestamped idempotency suffix and still stopped at the same registration gate before DNS, Astro site, build, or deploy steps ran.

- Command: `npm run domain:finish:post-verification`
- Check request id: `019e21e6-e51a-7786-95c9-efe33d7ff01b`
- Create request id: `019e21e6-e84d-7d71-96bc-2b2f010622da`
- Error code: `VERIFICATION_REQUIRED`

The read-only helper checks currently succeed:

```bash
npm run domain:check
npm run domain:status
```

Latest `domain:status` output reports `domain_available_not_registered` and now prints a timestamped registration command. Use a fresh suffix after account verification so Porkbun does not replay a prior failed create response.

```bash
npm run domain:register -- --max-cost-usd=2.06
```

Latest read-only status request ids:

- `domain:status` check: `019e2197-2689-7e28-b4e2-53c67ff6ded6`
- `domain:status` DNS retrieve: `019e2197-292b-7210-8e75-63a2a0ddc928`

A later read-only status check still reported `domain_available_not_registered`:

- `domain:status` check: `019e219b-543c-759d-b33f-a63b336e08a5`
- `domain:status` DNS retrieve: `019e219b-574a-7c84-af41-eac996f649f7`

A fresh continuation check still reported `domain_available_not_registered`:

- `domain:status` check: `019e21ab-80ae-7745-b332-2ff15488d479`
- `domain:status` DNS retrieve: `019e21ab-837a-79e8-b69a-70789fcf5b03`

A later continuation check still reported `domain_available_not_registered`:

- `domain:status` check: `019e21e6-8c56-7892-b4b4-428ae8bf4597`
- `domain:status` DNS retrieve: `019e21e6-8fb7-7266-b347-a60fc0a695f8`

The latest direct custom-domain URL check failed before HTTP because DNS does not resolve yet:

```text
curl: (6) Could not resolve host: froggyhatessnow.wiki
```

DNS setup was also attempted through the helper before registration completed:

- Command: `npm run domain:dns`
- Result: not configured. Porkbun returned `INVALID_DOMAIN` because the domain is not registered in the account yet.
- DNS retrieve request ids: `019e20f4-1c03-7a52-ba90-64e1bb4a9fef`, `019e2160-0873-76b9-8ab8-72820b93f7bf`

## DNS / Vercel Plan

The Vercel project already has both target hostnames attached:

- `froggyhatessnow.wiki`
- `www.froggyhatessnow.wiki`

Vercel currently reports both as third-party domains on the edge network but not configured because the domain is not registered/DNS-configured yet.

Current Vercel recommended records:

- `A froggyhatessnow.wiki 76.76.21.21`
- `A www.froggyhatessnow.wiki 76.76.21.21`

After Porkbun account verification:

1. Run the guarded finisher:

   ```bash
   npm run domain:finish:post-verification
   ```

   The finisher registers the domain, configures Porkbun DNS, updates the Astro `site` value to `https://froggyhatessnow.wiki`, validates/builds, commits and pushes the canonical config switch only if `astro.config.mjs` is the sole dirty file, deploys from that clean committed state, reruns Vercel domain checks, verifies live homepage/source/matrix markers on both the apex and `www` custom domains, and then runs `domain:health` plus `audit:completion`.

Manual fallback:

1. Register the domain:

   ```bash
   npm run domain:register -- --max-cost-usd=2.06
   ```

   The helper generates a fresh timestamped idempotency suffix by default. If passing `--idempotency-suffix` manually, use a value that has not been used in a previous failed create request.

2. Configure Porkbun DNS:

   ```bash
   npm run domain:dns
   ```

   The helper creates only missing Vercel A records:

   - `A @ 76.76.21.21`
   - `A www 76.76.21.21`

3. Re-check Vercel:

   ```bash
   npx vercel domains inspect froggyhatessnow.wiki
   npx vercel domains inspect www.froggyhatessnow.wiki
   ```

4. Re-check custom-domain HTTP:

   ```bash
   curl -I https://froggyhatessnow.wiki/
   curl -I https://www.froggyhatessnow.wiki/
   npm run domain:health
   npm run domain:commit-canonical
   npm run audit:completion
   ```

Alternative DNS plan: change the domain nameservers to Vercel's intended nameservers:

- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

Sources:

- Porkbun account contact settings: https://kb.porkbun.com/article/57-how-to-change-contact-information
- Porkbun account email/phone verification location: https://kb.porkbun.com/article/182-subaccounts-guide
- Porkbun ID verification explanation: https://kb.porkbun.com/article/225-why-porkbun-id-verification
- Porkbun API docs: https://porkbun.com/api/json/v3/documentation
- Porkbun pricing: https://porkbun.com/products/domains
- Vercel Astro docs: https://vercel.com/docs/frameworks/frontend/astro
- Vercel custom domain docs: https://vercel.com/docs/domains/set-up-custom-domain
