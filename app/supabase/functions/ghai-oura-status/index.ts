/**
 * Connection status for the Profile screen.
 *
 * oura_connections holds OAuth tokens and is service-role only, so the browser has no
 * read path to it at all — not even for the harmless columns. This function is that
 * read path, and it returns only what the UI needs: never a token, never the Oura user id.
 *
 * Called via supabase.functions.invoke("ghai-oura-status") — identity from the JWT.
 * Returns: { connected, status, lastSyncAt, scopes, lastError, lastDay }
 */

import { CORS, adminClient, ghai, json, userFromRequest } from "../_shared/admin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const user = await userFromRequest(req);
    if (!user) return json({ error: "Not authenticated." }, 401);

    const admin = adminClient();

    const { data: connection, error } = await ghai(admin)
      .from("oura_connections")
      .select("status, scopes, last_sync_at, last_error, created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    if (!connection) return json({ connected: false });

    // The most recent day we actually hold data for. "Synced 4m ago" is about the
    // job running; this is about whether anything came back — a ring left on the
    // charger for three days makes those two very different numbers.
    const { data: latest } = await ghai(admin)
      .from("wearable_daily")
      .select("day")
      .eq("user_id", user.id)
      .eq("source", "oura")
      .order("day", { ascending: false })
      .limit(1)
      .maybeSingle();

    return json({
      connected: connection.status === "connected",
      status: connection.status,
      scopes: connection.scopes ?? [],
      lastSyncAt: connection.last_sync_at,
      lastDay: latest?.day ?? null,
      connectedAt: connection.created_at,
      // Surfaced so the UI can say "reconnect" rather than a generic failure, but it
      // is written by our own code — never raw upstream text.
      lastError: connection.status === "connected" ? null : connection.last_error,
    });
  } catch (err) {
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});
