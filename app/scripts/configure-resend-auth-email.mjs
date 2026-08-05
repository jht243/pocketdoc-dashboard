/**
 * Push Resend + Auth Hook secrets to MetabolicHealth and enable the Send Email hook.
 *
 * Requires a Supabase personal access token:
 *   https://supabase.com/dashboard/account/tokens
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/configure-resend-auth-email.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const PROJECT_REF = "pmqxkdqkqxhbrymeerem";
const FUNCTION_URL =
  `https://${PROJECT_REF}.supabase.co/functions/v1/ghai-auth-email`;

function loadEnvFile(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    out[trimmed.slice(0, i)] = trimmed.slice(i + 1);
  }
  return out;
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}

const secrets = loadEnvFile(join(root, "supabase", ".env.secrets"));
for (const key of ["RESEND_API_KEY", "GHAI_EMAIL_FROM", "SEND_EMAIL_HOOK_SECRET"]) {
  if (!secrets[key]) {
    console.error(`Missing ${key} in supabase/.env.secrets`);
    process.exit(1);
  }
}

async function api(method, path, body) {
  const res = await fetch(`https://api.supabase.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return json;
}

console.log("Setting Edge Function secrets…");
await api("POST", `/projects/${PROJECT_REF}/secrets`, [
  { name: "RESEND_API_KEY", value: secrets.RESEND_API_KEY },
  { name: "GHAI_EMAIL_FROM", value: secrets.GHAI_EMAIL_FROM },
  { name: "SEND_EMAIL_HOOK_SECRET", value: secrets.SEND_EMAIL_HOOK_SECRET },
]);

console.log("Enabling Auth Send Email Hook → Resend…");
await api("PATCH", `/projects/${PROJECT_REF}/config/auth`, {
  hook_send_email_enabled: true,
  hook_send_email_uri: FUNCTION_URL,
  hook_send_email_secrets: secrets.SEND_EMAIL_HOOK_SECRET,
});

console.log("Done.");
console.log(`Hook URL: ${FUNCTION_URL}`);
console.log("Signup confirmations now send through Resend (intake.layer3labs.io).");
