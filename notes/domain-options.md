# Domain Options

Checked: 2026-05-13

Porkbun API/domain research indicates all checked candidates are available and non-premium. No registration was completed from this shell.

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

## DNS / Vercel Plan

1. Build locally with `npm run build`.
2. Create or link a separate Vercel project for this folder.
3. Add the selected domain to that Vercel project.
4. Register the domain via Porkbun.
5. Configure Porkbun DNS to Vercel's requested records or nameservers.
6. Re-check the Vercel domain status after DNS propagation.

Sources:

- Porkbun API docs: https://porkbun.com/api/json/v3/documentation
- Porkbun pricing: https://porkbun.com/products/domains
- Vercel Astro docs: https://vercel.com/docs/frameworks/frontend/astro
- Vercel custom domain docs: https://vercel.com/docs/domains/set-up-custom-domain
