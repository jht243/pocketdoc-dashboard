/**
 * Oura webhook receiver.
 *
 * MUST be deployed without JWT verification — Oura calls it directly:
 *   supabase functions deploy ghai-oura-webhook --no-verify-jwt
 *
 * Two methods, two jobs:
 *
 *   GET   Oura's verification handshake, performed when a subscription is created.
 *         Oura calls this URL with `verification_token` and `challenge` query params
 *         and expects {"challenge": "<challenge>"} back. Fail it and the subscription
 *         is never created — which is silent, so it's worth testing directly.
 *
 *   POST  An event: { event_type, data_type, object_id, event_time, user_id }.
 *         Note the payload carries NO biometric data — it's a pointer. The member is
 *         identified by Oura's user id, which is why oura_connections stores it.
 *
 * Subscriptions are application-scoped, not per-user: one subscription per
 * (data_type, event_type) covers every member who has connected. They are created and
 * renewed by scripts/oura-webhook-subscriptions.mjs, not from here.
 *
 * Secrets: OURA_WEBHOOK_VERIFICATION_TOKEN, OURA_CRON_SECRET, SUPABASE_URL
 */

import { adminClient, ghai, json } from "../_shared/admin.ts";
import { safeEqual } from "../_shared/crypto.ts";

const VERIFICATION_TOKEN = Deno.env.get("OURA_WEBHOOK_VERIFICATION_TOKEN") ?? "";
const CRON_SECRET = Deno.env.get("OURA_CRON_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

// Which data types are worth a re-sync. Anything else Oura sends is acknowledged and
// dropped rather than triggering API calls we have no use for.
const SYNCED_TYPES = new Set([
  "daily_sleep",
  "daily_readiness",
  "daily_activity",
  "sleep",
  "daily_spo2",
]);

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // ---- verification handshake ----------------------------------------------
  if (req.method === "GET") {
    const token = url.searchParams.get("verification_token") ?? "";
    const challenge = url.searchParams.get("challenge") ?? "";

    if (!VERIFICATION_TOKEN || !safeEqual(token, VERIFICATION_TOKEN)) {
      return json({ error: "Invalid verification token." }, 401);
    }
    return json({ challenge });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const event = await req.json();
    const { event_type, data_type, user_id: ouraUserId } = event ?? {};

    if (!ouraUserId || !data_type) return json({ ok: true, ignored: "malformed" });
    if (!SYNCED_TYPES.has(data_type)) return json({ ok: true, ignored: data_type });

    const admin = adminClient();

    // Oura identifies the member by ITS user id; map back to ours.
    const { data: connection } = await ghai(admin)
      .from("oura_connections")
      .select("user_id, status")
      .eq("oura_user_id", String(ouraUserId))
      .maybeSingle();

    // An event for someone who disconnected. Acknowledge so Oura stops retrying.
    if (!connection || connection.status !== "connected") {
      return json({ ok: true, ignored: "no_active_connection" });
    }

    // Re-sync a short trailing window rather than fetching the one referenced object.
    // An event on any collection means that day changed, and the row is built from
    // five collections together — a targeted fetch would write a partial row.
    // `delete` events are included deliberately: the sync rewrites the day from
    // whatever Oura now reports, which is how a removed session gets cleared.
    const syncUrl = `${SUPABASE_URL}/functions/v1/ghai-oura-sync`;
    const syncPromise = fetch(syncUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-cron-secret": CRON_SECRET },
      body: JSON.stringify({ userId: connection.user_id, days: 2 }),
    }).catch((err) => console.error("webhook sync dispatch", String(err)));

    // Return 200 promptly — Oura retries on slow or failed deliveries, and a duplicate
    // sync is harmless (the upsert is idempotent) but wasteful.
    if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any)?.waitUntil) {
      (EdgeRuntime as any).waitUntil(syncPromise);
    } else {
      await syncPromise;
    }

    return json({ ok: true, event_type, data_type });
  } catch (err) {
    console.error("ghai-oura-webhook", String((err as Error)?.message ?? err));
    // Still 200: a 500 makes Oura retry an event we already failed to parse.
    return json({ ok: false }, 200);
  }
});
