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
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
