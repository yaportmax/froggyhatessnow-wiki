# Porkbun Verification Support Packet

Checked: 2026-05-13

## What Is Blocked

The wiki is live on Vercel, but the custom-domain purchase cannot complete because Porkbun is blocking API registration until the account email address and phone number are verified.

Target domain:

- `froggyhatessnow.wiki`

Latest API availability result before create:

- Available: yes
- Registration type: registration
- Premium: no
- First-year price: `$2.06`
- Renewal price: `$26.26`

Latest failed finisher attempt:

- Command: `npm run domain:finish:post-verification`
- Check request id: `019e21d5-2161-7212-9556-3bf098d88f96`
- Create request id: `019e21d5-23f8-7df7-b4e0-7d21ca0f9494`
- Error code: `VERIFICATION_REQUIRED`
- Error message: `Your account phone number and email address must be verified.`

The command stopped before DNS, Astro config changes, build, or deploy changes.

## Manual Verification Checklist

1. Log in to Porkbun.
2. Open `ACCOUNT` -> `Settings / Billing`.
3. In `Account Owner and Recovery`, verify the primary account email address and phone number.
4. If Porkbun requires photo ID verification through Veriff, complete that personally in the Porkbun UI.
5. After verification clears, return to this repo and run:

   ```bash
   npm run domain:finish:post-verification
   ```

Do not send Porkbun API keys, secret keys, passwords, payment card details, SMS codes, email verification codes, or ID documents through this repo or support draft. Share request IDs and the visible error message only.

## Gmail Search Notes

Read-only Gmail searches on 2026-05-13 found:

- No Porkbun messages after 2026-05-12.
- No matching Porkbun phone-verification messages in the last 60 days.
- One account-creation email verification message from Porkbun on 2026-04-27.

The email verification code itself is intentionally not recorded here. Search Gmail for subject `porkbun.com | Account Creation Email Verification Code` if Porkbun asks for the original account-creation verification email.

## API Surface Check

The current Porkbun OpenAPI spec explicitly lists domain registration requirements for `POST /domain/create/{domain}`:

- Account email and phone must be verified.
- Account must have sufficient credit.
- `agreeToTerms` must be `yes` or `1`.
- `cost` must equal the current price in pennies.
- Account must have placed at least one previous domain registration.
- Premium domains cannot be registered via API.

Spec search on 2026-05-13 found account/API-key paths for spend settings, balance, account invites, API-key authorization, and email-hosting password management, but no endpoint to verify or resend verification for the existing account email or phone number. Treat email/phone verification as a manual Porkbun account UI or support action.

## Support Message Draft

Subject:

```text
Account verification blocking API registration for froggyhatessnow.wiki
```

Body:

```text
Hi Porkbun support,

I am trying to register froggyhatessnow.wiki through the Porkbun API. The availability check succeeds and reports the domain as available/non-premium, but create fails with VERIFICATION_REQUIRED:

"Your account phone number and email address must be verified."

Latest failed attempt:
- Domain: froggyhatessnow.wiki
- First-year price returned by API: $2.06
- Renewal price returned by API: $26.26
- Check request id: 019e21d5-2161-7212-9556-3bf098d88f96
- Create request id: 019e21d5-23f8-7df7-b4e0-7d21ca0f9494

Can you confirm what account verification step is still missing, or help clear the email/phone verification requirement so the API registration can complete?

Thanks.
```

## Evidence Trail

Prior blocked API attempts are recorded in `notes/domain-options.md`. The final goal audit is `npm run audit:completion`; it currently fails only because the custom-domain registration/DNS/canonical checks cannot pass until this Porkbun account gate is cleared.

Relevant Porkbun documentation:

- Account contact settings: https://kb.porkbun.com/article/57-how-to-change-contact-information
- Email/phone verification prerequisite: https://kb.porkbun.com/article/220-how-to-grant-access-to-another-porkbun-user-as-an-authorized-account
- ID verification explanation: https://kb.porkbun.com/article/225-why-porkbun-id-verification
