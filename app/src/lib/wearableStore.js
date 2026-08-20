/**
 * Wearable data: DB shape in, app shape out.
 *
 * Follows the same split as profileStore.js — the screens were written against a
 * nested camelCase `healthData` shape, the table is flat snake_case, and this file is
 * the single place that knows both.
 *
 * Deliberately vendor-neutral apart from the connect/disconnect calls: everything
 * downstream reads `today` / `vitals` / `score` and never learns which device produced
 * them. A second source later is a new sync function, not new screen code.
 *
 * The row-to-snapshot shaping (baselines, vitals chips) lives in wearableShape.js so
 * it can be tested without a Supabase client.
 */

import { supabase, isConfigured } from "./supabase";
import { toSnapshot } from "./wearableShape";

// Days of history pulled for baselines and trends. The baseline window itself lives
// in wearableShape.js alongside the logic that uses it.
const HISTORY_DAYS = 30;

/* ---------------- reads ---------------- */

/** The wearable slice of `healthData`, or null when nothing has synced. */
export async function loadWearableSnapshot(userId) {
  if (!isConfigured || !userId) return null;

  const since = new Date();
  since.setDate(since.getDate() - HISTORY_DAYS);

  const { data, error } = await supabase
    .from("wearable_daily")
    .select("*")
    .eq("user_id", userId)
    .gte("day", since.toISOString().slice(0, 10))
    .order("day", { ascending: false });

  if (error) {
    console.error("loadWearableSnapshot", error);
    return null;
  }
  return toSnapshot(data || []);
}

/**
 * Connection status for the Profile screen.
 *
 * Reads through the sync function rather than the table: oura_connections holds
 * OAuth tokens and is service-role only, so the browser has no read path to it —
 * by design.
 */
export async function loadOuraStatus(userId) {
  if (!isConfigured || !userId) return { connected: false };

  const { data, error } = await supabase.functions.invoke("ghai-oura-status");
  if (error) {
    console.error("loadOuraStatus", error);
    return { connected: false, error };
  }
  return data || { connected: false };
}

/* ---------------- mutations ---------------- */

/**
 * Begin the OAuth handshake. Navigates away to Oura's consent screen; the user comes
 * back to the app with `?oura=connected` (or `?oura=error&reason=…`), which App.jsx
 * reads on mount.
 */
export async function startOuraConnect(returnTo = "/") {
  if (!isConfigured) return { error: new Error("not configured") };

  const { data, error } = await supabase.functions.invoke("ghai-oura-connect", {
    body: { returnTo },
  });
  if (error || !data?.authorizeUrl) {
    console.error("startOuraConnect", error || data);
    return { error: error || new Error("No authorize URL returned.") };
  }

  window.location.href = data.authorizeUrl;
  return { error: null };
}

/** Pull the trailing window on demand — the "Sync now" button. */
export async function syncOuraNow(days = 7) {
  if (!isConfigured) return { error: new Error("not configured") };
  const { data, error } = await supabase.functions.invoke("ghai-oura-sync", { body: { days } });
  if (error) console.error("syncOuraNow", error);
  return { data, error };
}

/**
 * Disconnect. Revokes and deletes the stored tokens server-side.
 * `purge` also deletes the synced biometric rows — offered explicitly rather than
 * assumed either way, since some users want their history to survive a reconnect.
 */
export async function disconnectOura({ purge = false } = {}) {
  if (!isConfigured) return { error: new Error("not configured") };
  const { data, error } = await supabase.functions.invoke("ghai-oura-disconnect", {
    body: { purge },
  });
  if (error) console.error("disconnectOura", error);
  return { data, error };
}

/**
 * Read and clear the `?oura=…` params Oura's callback redirect leaves behind, so a
 * refresh doesn't replay the toast.
 */
export function readOuraCallbackResult() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const status = params.get("oura");
  if (!status) return null;

  const result = { status, reason: params.get("reason"), warn: params.get("warn") };
  params.delete("oura");
  params.delete("reason");
  params.delete("warn");
  const query = params.toString();
  window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  return result;
}
