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

## Registration Status

Attempted registration for `froggyhatessnow.wiki` on 2026-05-13 through the Porkbun API.

Result: not registered. Porkbun returned `VERIFICATION_REQUIRED`: the account phone number and email address must be verified before API registration can complete.

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

The read-only helper check currently succeeds:

```bash
npm run domain:check
```

Latest read-only check request id: `019e20f1-eb98-7952-a792-b855c6f2a08c`.

DNS setup was also attempted through the helper before registration completed:

- Command: `npm run domain:dns`
- Result: not configured. Porkbun returned `INVALID_DOMAIN` because the domain is not registered in the account yet.
- DNS retrieve request id: `019e20f4-1c03-7a52-ba90-64e1bb4a9fef`

## DNS / Vercel Plan

The Vercel project already has both target hostnames attached:

- `froggyhatessnow.wiki`
- `www.froggyhatessnow.wiki`

Vercel currently reports both as third-party domains on the edge network but not configured because the domain is not registered/DNS-configured yet.

Current Vercel recommended records:

- `A froggyhatessnow.wiki 76.76.21.21`
- `A www.froggyhatessnow.wiki 76.76.21.21`

After Porkbun account verification:

1. Register the domain:

   ```bash
   npm run domain:register -- --max-cost-usd=2.06
   ```

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

Alternative DNS plan: change the domain nameservers to Vercel's intended nameservers:

- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

Sources:

- Porkbun API docs: https://porkbun.com/api/json/v3/documentation
- Porkbun pricing: https://porkbun.com/products/domains
- Vercel Astro docs: https://vercel.com/docs/frameworks/frontend/astro
- Vercel custom domain docs: https://vercel.com/docs/domains/set-up-custom-domain
