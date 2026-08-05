# Guided Health AI — Email templates

Branded transactional emails matching the app palette (`#0284c7` accent, light `#f6f7f9` background, Georgia headlines).

## Structure

Every email has:

1. **Header** — GH mark + “Guided Health AI”
2. **Headline** — clear purpose (h1)
3. **Subheader** — one supporting sentence
4. **Body** — short explanation
5. **CTA** — solid accent button (+ plain-text fallback link)
6. **Footer** — wellness disclaimer

## Files

| Path | Purpose |
| --- | --- |
| `src/lib/emailLayout.js` | Shared layout + Supabase Auth template catalog |
| `src/lib/email.js` | App-sent mail helpers (e.g. screening reminders) |
| `emails/auth/*.html` | Ready-to-paste Supabase Auth bodies |
| `emails/preview.html` | Local visual preview |
| `scripts/apply-auth-email-templates.mjs` | Regenerate HTML / push to Supabase |

## Preview locally

```bash
npm run emails:build
npm run emails:preview
# or open emails/preview.html via the Vite app at /emails/preview.html
```

## Apply to Supabase Auth (required for signup confirm)

Auth emails are sent through **Resend** via the `ghai-auth-email` Edge Function
(Send Email Hook). Supabase still creates users/tokens; Resend delivers the mail.

See **[RESEND_AUTH_SETUP.md](./RESEND_AUTH_SETUP.md)** — one dashboard toggle to enable the hook.

From (testing): `Guided Health AI <noreply@intake.layer3labs.io>`

Optional Management API apply (needs personal access token):

```bash
SUPABASE_ACCESS_TOKEN=sbp_... node scripts/configure-resend-auth-email.mjs
```

Legacy HTML bodies (if you ever fall back to Supabase's built-in mailer) are still in `emails/auth/`.

## App-sent email

Use `renderEmailLayout(...)` from `emailLayout.js` for any new transactional message, then `sendEmail(...)` via the `ghai-send-email` edge function.
