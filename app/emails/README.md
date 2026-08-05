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

The plain “Confirm your signup” email is sent by **Supabase Auth**, not the app. Update templates on the MetabolicHealth project (`pmqxkdqkqxhbrymeerem`):

**Option A — Management API**

1. Create a token at https://supabase.com/dashboard/account/tokens  
2. Run:

```bash
SUPABASE_ACCESS_TOKEN=sbp_... npm run emails:apply
```

**Option B — Dashboard**

1. Open https://supabase.com/dashboard/project/pmqxkdqkqxhbrymeerem/auth/templates  
2. For each template, paste the matching file from `emails/auth/` and set the subject from `emails/auth/subjects.json`

| Supabase template | File | Subject |
| --- | --- | --- |
| Confirm signup | `confirmation.html` | Confirm your Guided Health AI account |
| Invite user | `invite.html` | You're invited to Guided Health AI |
| Magic Link | `magic_link.html` | Your Guided Health AI sign-in link |
| Reset Password | `recovery.html` | Reset your Guided Health AI password |
| Change Email Address | `email_change.html` | Confirm your new email address |
| Reauthentication | `reauthentication.html` | `{{ .Token }} is your Guided Health AI verification code` |

## App-sent email

Use `renderEmailLayout(...)` from `emailLayout.js` for any new transactional message, then `sendEmail(...)` via the `ghai-send-email` edge function.
