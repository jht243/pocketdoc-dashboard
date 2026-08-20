/**
 * Disconnect Oura.
 *
 * Deletes the stored tokens outright rather than flagging the row inactive — a
 * revoked credential that stays in the database is still a credential in the database.
 *
 * `purge: true` also deletes the synced biometric rows. This is asked explicitly in
 * the UI rather than assumed either way: some users disconnect a ring they've sold and
 * want their history kept, others want the health data gone. Guessing is the wrong
 * move in both directions.
 *
 * Webhook subscriptions are application-scoped, not per-user, so nothing is
 * unsubscribed here — events for a disconnected member arrive, find no active
 * connection, and are acknowledged and dropped by ghai-oura-webhook.
 *
 * Body: { purge?: boolean }
 */

import { CORS, adminClient, ghai, json, userFromRequest } from "../_shared/admin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const user = await userFromRequest(req);
    if (!user) return json({ error: "Not authenticated." }, 401);

    const { purge = false } = await req.json().catch(() => ({}));
    const admin = adminClient();

    const { error } = await ghai(admin)
      .from("oura_connections")
      .delete()
      .eq("user_id", user.id);
    if (error) return json({ error: error.message }, 500);

    let purged = false;
    if (purge) {
      const { error: purgeError } = await ghai(admin)
        .from("wearable_daily")
        .delete()
        .eq("user_id", user.id)
        .eq("source", "oura");
      if (purgeError) {
        // The credential is already gone, which is the part that matters. Report the
        // partial outcome rather than implying the data was deleted when it wasn't.
        return json({ ok: true, purged: false, warning: "Tokens removed, but the synced data could not be deleted." });
      }
      purged = true;
    }

    return json({ ok: true, purged });
  } catch (err) {
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});
