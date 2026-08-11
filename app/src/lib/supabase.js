import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// GHAI lives in its own schema rather than `public`, so the client is bound to it
// here — every .from("profiles") call resolves to ghai.profiles automatically.
const schema = import.meta.env.VITE_SUPABASE_SCHEMA || "ghai";

export const isConfigured = Boolean(url && anonKey);

if (!isConfigured) {
  console.warn(
    "Supabase is not configured. Copy .env.example to .env.local and set " +
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = isConfigured
  ? createClient(url, anonKey, {
      db: { schema },
      auth: {
        // Keep users signed in for the long haul — we don't want to prompt a daily
        // login. The session is written to localStorage (survives tab/browser
        // restarts) and the short-lived access token is refreshed silently in the
        // background, so a returning user stays logged in as long as their refresh
        // token is valid. How long that is (target: 30 days) is governed by the
        // project's Auth → Sessions settings in the Supabase dashboard.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // required for the password-recovery redirect
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    })
  : null;
