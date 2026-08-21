/**
 * Oura sync worker.
 *
 * Three callers:
 *   - the app's "Sync now" button       → user JWT, syncs that user
 *   - the nightly cron                  → x-cron-secret header, syncs everyone
 *   - ghai-oura-webhook                 → x-cron-secret header, one user, one day
 *
 * The nightly pass is the safety net for the webhook path. Webhook deliveries drop,
 * subscriptions lapse, and Oura revises the previous night's scores hours after first
 * publishing them — so re-syncing a trailing window every night is what keeps the
 * data honest rather than merely fresh.
 *
 * Secrets: OURA_CLIENT_ID, OURA_CLIENT_SECRET, OURA_TOKEN_KEY, OURA_CRON_SECRET
 *
 * Body: { days?: number, startDate?: string, endDate?: string, userId?: string }
 */

import { CORS, adminClient, ghai, json, userFromRequest } from "../_shared/admin.ts";
import { assertConfigured, buildRowsForRange, getAccessToken, isoDay } from "../_shared/oura.ts";
import { BASELINE_DAYS, calculateWearableScore } from "../_shared/wearableScore.js";

const CRON_SECRET = Deno.env.get("OURA_CRON_SECRET") ?? "";

// Oura keeps revising a night for roughly a day after it lands, so three days of
// overlap costs almost nothing and covers a missed delivery plus late edits.
const DEFAULT_TRAILING_DAYS = 3;

/** `startDate` minus enough days to give the earliest scored day a full baseline. */
function baselineStart(startDate: string): string {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (BASELINE_DAYS + 1));
  return d.toISOString().slice(0, 10);
}

/**
 * Score every day we just wrote, and persist the result on the day's own row.
 *
 * Scoring happens here rather than in the browser for three reasons: the score is a
 * clinical record and belongs in the database, a member's phone shouldn't be the only
 * place a safety-floor alert ever existed, and a score computed at sync time is
 * anchored to the baseline as it stood — recomputing months later against a baseline
 * that has since drifted would quietly rewrite history.
 *
 * The read window reaches BASELINE_DAYS behind the synced range so the earliest day
 * in the range is scored against a full baseline rather than a truncated one.
 */
async function scoreDays(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  startDate: string,
  endDate: string,
) {
  const { data: rows, error } = await ghai(admin)
    .from("wearable_daily")
    .select("*")
    .eq("user_id", userId)
    .gte("day", baselineStart(startDate))
    .lte("day", endDate)
    .order("day", { ascending: false });

  if (error) throw new Error(error.message);
  if (!rows?.length) return 0;

  const updates = rows
    .filter((row: any) => row.day >= startDate)
    .map((row: any) => {
      const result = calculateWearableScore(row, rows);
      if (result.sanityCheck.flagged) {
        // Developer flag only, exactly as the rubric specifies — a wide gap between
        // our score and Oura's readiness points at a calculation bug, not at
        // something the member needs to be told.
        console.warn(
          "wearable score sanity check",
          JSON.stringify({ userId, day: row.day, ours: result.totalScore, oura: result.sanityCheck }),
        );
      }
      return {
        user_id: userId,
        day: row.day,
        source: row.source,
        wearable_score: result.totalScore,
        wearable_daily_score: result.dailyScore,
        wearable_trend_score: result.trendScore,
        score_label: result.label,
        score_confidence: result.confidence.percent,
        score_version: result.version,
        score_detail: result,
        score_computed_at: new Date().toISOString(),
      };
    });

  if (!updates.length) return 0;

  // Upsert rather than update: these rows were written moments ago in the same call,
  // and the primary key is the same one the biometric upsert used.
  const { error: writeError } = await ghai(admin)
    .from("wearable_daily")
    .upsert(updates, { onConflict: "user_id,day,source" });
  if (writeError) throw new Error(writeError.message);

  return updates.length;
}

async function syncUser(
  admin: ReturnType<typeof adminClient>,
  connection: any,
  startDate: string,
  endDate: string,
) {
  const accessToken = await getAccessToken(admin, connection);
  const rows = await buildRowsForRange(accessToken, connection.user_id, startDate, endDate);

  if (rows.length) {
    const { error } = await ghai(admin)
      .from("wearable_daily")
      .upsert(rows, { onConflict: "user_id,day,source" });
    if (error) throw new Error(error.message);

    // Re-score every day just written. A late Oura revision to Tuesday night changes
    // Tuesday's score AND every trend that looks back through it, which is why the
    // trailing overlap window is re-scored wholesale rather than only the newest day.
    await scoreDays(admin, connection.user_id, startDate, endDate);
  }

  await ghai(admin)
    .from("oura_connections")
    .update({
      last_sync_at: new Date().toISOString(),
      last_error: null,
      status: "connected",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", connection.user_id);

  return rows.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    assertConfigured();

    const body = await req.json().catch(() => ({}));
    const days = Number.isFinite(body.days) ? Math.min(Math.max(body.days, 1), 365) : DEFAULT_TRAILING_DAYS;
    const startDate = body.startDate ?? isoDay(days);
    const endDate = body.endDate ?? isoDay(0);

    const admin = adminClient();
    const cronHeader = req.headers.get("x-cron-secret");
    const isTrusted = Boolean(CRON_SECRET) && cronHeader === CRON_SECRET;

    // ---- trusted caller: cron sweep, or a webhook syncing one user -----------
    if (isTrusted) {
      let query = ghai(admin)
        .from("oura_connections")
        .select("user_id, access_token_enc, refresh_token_enc, token_expires_at")
        .eq("status", "connected");
      if (body.userId) query = query.eq("user_id", body.userId);

      const { data: connections, error } = await query;
      if (error) return json({ error: error.message }, 500);

      const results = [];
      for (const connection of connections ?? []) {
        try {
          const count = await syncUser(admin, connection, startDate, endDate);
          results.push({ userId: connection.user_id, days: count });
        } catch (err) {
          // One user's revoked token must not abort the sweep for everyone else.
          const message = String((err as Error)?.message ?? err);
          console.error("sync failed", connection.user_id, message);
          await ghai(admin)
            .from("oura_connections")
            .update({ last_error: message, updated_at: new Date().toISOString() })
            .eq("user_id", connection.user_id);
          results.push({ userId: connection.user_id, error: message });
        }
      }
      return json({ synced: results.length, results });
    }

    // ---- app caller: the signed-in user only --------------------------------
    const user = await userFromRequest(req);
    if (!user) return json({ error: "Not authenticated." }, 401);

    const { data: connection } = await ghai(admin)
      .from("oura_connections")
      .select("user_id, access_token_enc, refresh_token_enc, token_expires_at, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!connection) return json({ error: "No Oura connection." }, 404);
    if (connection.status === "revoked") {
      return json({ error: "Oura access was revoked. Reconnect to resume syncing.", status: "revoked" }, 409);
    }

    const count = await syncUser(admin, connection, startDate, endDate);
    return json({ ok: true, days: count, syncedAt: new Date().toISOString() });
  } catch (err) {
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});
