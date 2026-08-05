# Enable Resend for auth emails (one dashboard step)

The `ghai-auth-email` Edge Function is deployed. Auth still creates users/tokens;
Resend sends the branded email.

## Enable the Send Email Hook

1. Open: https://supabase.com/dashboard/project/pmqxkdqkqxhbrymeerem/auth/hooks
2. Enable **Send Email** hook (HTTPS)
3. URL:
   `https://pmqxkdqkqxhbrymeerem.supabase.co/functions/v1/ghai-auth-email`
4. Secret (paste exactly):
   `v1,whsec_j/2+yqrWS+9vXwFIgm1e62jU7jBTUkV4yG0ntrYSOF8=`
5. Save

From address: `Guided Health AI <noreply@intake.layer3labs.io>`

## Optional: push secrets via API

Create a token at https://supabase.com/dashboard/account/tokens then:

```bash
cd app
SUPABASE_ACCESS_TOKEN=sbp_... node scripts/configure-resend-auth-email.mjs
```

That sets `RESEND_API_KEY`, `GHAI_EMAIL_FROM`, `SEND_EMAIL_HOOK_SECRET` and enables the hook.

## Security

Rotate the Resend API key after testing — it was pasted in chat. Prefer Edge Function secrets over inlined fallbacks.
