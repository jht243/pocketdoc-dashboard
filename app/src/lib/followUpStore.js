/**
 * Persistence for provider follow-ups (`ghai.follow_ups`). The rules are in
 * followUps.js; this file only reads and writes, under the member's own JWT.
 *
 * WHY THE CLIENT OPENS THEM. The agents service already returns the lane cards with
 * its reply, and the browser is where follow-ups are read and answered (the morning
 * check-in), so the one writer is the one reader: no second path through PostgREST
 * from the server, and no server-side read of the member's existing follow-ups to
 * de-duplicate against. Opening them is fire-and-forget after the reply is on
 * screen, so a failure here never costs the member their answer.
 */
import { supabase, isConfigured } from "./supabase";
import { followUpsFromLanes, followUpAnswer } from "./followUps";
import { localDay } from "./checkInContent";

const COLUMNS = "id, marker, marker_name, lane_reason, level, reading, reading_date, status, due_30, due_60, last_answer, last_asked_on, created_at, updated_at";

/** Every follow-up the member has, newest first. */
export async function loadFollowUps(userId) {
  if (!isConfigured || !userId) return [];
  const { data, error } = await supabase
    .from("follow_ups")
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("loadFollowUps", error);
    return [];
  }
  return data || [];
}

/**
 * Open a follow-up for each provider-lane marker in an answer, skipping any the
 * member already has open (or already closed for the same reading).
 * @returns {Promise<number>} how many were opened
 */
export async function openFollowUps(userId, lanes) {
  if (!isConfigured || !userId || !lanes?.some((c) => c?.lane === "provider")) return 0;
  const existing = await loadFollowUps(userId);
  const rows = followUpsFromLanes(lanes, existing, localDay());
  let opened = 0;
  // One insert per row: a race with another tab hits the one-open-per-marker index
  // (23505) for that marker only, and the others still land.
  for (const row of rows) {
    const { error } = await supabase.from("follow_ups").insert({ ...row, user_id: userId });
    if (!error) opened += 1;
    else if (error.code !== "23505") console.error("openFollowUps", error);
  }
  return opened;
}

/** Save the member's check-in answer (Yes / No / Scheduled) to the follow-up. */
export async function answerFollowUp(userId, id, answer, day = localDay()) {
  const patch = followUpAnswer(answer, day);
  if (!isConfigured || !userId || !id || !patch) return { error: null };
  const { error } = await supabase.from("follow_ups").update(patch).eq("id", id).eq("user_id", userId);
  if (error) console.error("answerFollowUp", error);
  return { error };
}
