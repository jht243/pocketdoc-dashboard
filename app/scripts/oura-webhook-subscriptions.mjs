#!/usr/bin/env node
/**
 * Create / list / renew the Oura webhook subscriptions.
 *
 * Oura's webhook subscriptions are APPLICATION-scoped, not per-user: one subscription
 * per (data_type, event_type) pair covers every member who connects. So this is a
 * one-time setup step plus periodic renewal — not something the OAuth callback does.
 *
 * Subscriptions expire. Run `renew` on a schedule (monthly is ample) or deliveries
 * stop silently and the app quietly goes stale.
 *
 * Auth is the client id/secret in headers — NOT a user bearer token.
 *
 * Usage:
 *   node scripts/oura-webhook-subscriptions.mjs list
 *   node scripts/oura-webhook-subscriptions.mjs create
 *   node scripts/oura-webhook-subscriptions.mjs renew
 *   node scripts/oura-webhook-subscriptions.mjs delete <id>
 *
 * Env (put them in the shell, not in .env.local — these are secrets):
 *   OURA_CLIENT_ID
 *   OURA_CLIENT_SECRET
 *   OURA_WEBHOOK_VERIFICATION_TOKEN   must match the Edge Function secret exactly
 *   SUPABASE_FUNCTIONS_URL            https://<project>.supabase.co/functions/v1
 */

const API = "https://api.ouraring.com/v2/webhook/subscription";

const CLIENT_ID = process.env.OURA_CLIENT_ID;
const CLIENT_SECRET = process.env.OURA_CLIENT_SECRET;
const VERIFICATION_TOKEN = process.env.OURA_WEBHOOK_VERIFICATION_TOKEN;
const FUNCTIONS_URL = process.env.SUPABASE_FUNCTIONS_URL;

/**
 * `update` matters as much as `create`: Oura revises the previous night's scores for
 * hours after first publishing them. Subscribing to create only means the app shows
 * the first draft of last night all day.
 */
const SUBSCRIPTIONS = [
  ["daily_sleep", "create"],
  ["daily_sleep", "update"],
  ["daily_readiness", "create"],
  ["daily_readiness", "update"],
  ["daily_activity", "create"],
  ["daily_activity", "update"],
  ["sleep", "create"],
  ["sleep", "update"],
  ["daily_spo2", "create"],
];

const headers = {
  "x-client-id": CLIENT_ID,
  "x-client-secret": CLIENT_SECRET,
  "content-type": "application/json",
};

function requireEnv() {
  const missing = ["OURA_CLIENT_ID", "OURA_CLIENT_SECRET", "OURA_WEBHOOK_VERIFICATION_TOKEN", "SUPABASE_FUNCTIONS_URL"]
    .filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env: ${missing.join(", ")}`);
    process.exit(1);
  }
}

async function call(method, path = "", body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}

const list = () => call("GET");

async function create() {
  const callbackUrl = `${FUNCTIONS_URL}/ghai-oura-webhook`;
  const existing = await list();
  const have = new Set((existing || []).map((s) => `${s.data_type}:${s.event_type}`));

  for (const [dataType, eventType] of SUBSCRIPTIONS) {
    if (have.has(`${dataType}:${eventType}`)) {
      console.log(`· ${dataType}/${eventType} — already subscribed`);
      continue;
    }
    try {
      // Oura verifies the callback synchronously here: it GETs callbackUrl with a
      // challenge and expects it echoed back. If ghai-oura-webhook isn't deployed
      // with --no-verify-jwt, this is where it fails.
      const sub = await call("POST", "", {
        callback_url: callbackUrl,
        verification_token: VERIFICATION_TOKEN,
        event_type: eventType,
        data_type: dataType,
      });
      console.log(`✓ ${dataType}/${eventType} — ${sub.id}`);
    } catch (err) {
      console.error(`✗ ${dataType}/${eventType} — ${err.message}`);
    }
  }
}

async function renew() {
  const subs = await list();
  if (!subs?.length) return console.log("No subscriptions to renew. Run `create` first.");
  for (const sub of subs) {
    try {
      await call("PUT", `/renew/${sub.id}`);
      console.log(`✓ renewed ${sub.data_type}/${sub.event_type}`);
    } catch (err) {
      console.error(`✗ ${sub.data_type}/${sub.event_type} — ${err.message}`);
    }
  }
}

const command = process.argv[2];
requireEnv();

try {
  if (command === "list") console.log(JSON.stringify(await list(), null, 2));
  else if (command === "create") await create();
  else if (command === "renew") await renew();
  else if (command === "delete") {
    const id = process.argv[3];
    if (!id) throw new Error("Usage: delete <subscription-id>");
    await call("DELETE", `/${id}`);
    console.log(`✓ deleted ${id}`);
  } else {
    console.error("Usage: oura-webhook-subscriptions.mjs list|create|renew|delete <id>");
    process.exit(1);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
