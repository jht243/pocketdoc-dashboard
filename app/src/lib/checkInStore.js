/**
 * Persistence for the morning check-in (`ghai.check_ins`, one row per member-day).
 */
import { supabase, isConfigured } from "./supabase";

const HISTORY_DAYS = 120; // a full 16-week draw cycle, with margin

/** Recent check-ins, newest first, in the app's shape. */
export async function loadCheckIns(userId) {
  if (!isConfigured || !userId) return [];
  const since = new Date();
  since.setDate(since.getDate() - HISTORY_DAYS);
  const { data, error } = await supabase
    .from("check_ins")
    .select("day, answers, note, skipped, response, created_at")
    .eq("user_id", userId)
    .gte("day", since.toISOString().slice(0, 10))
    .order("day", { ascending: false });
  if (error) {
    console.error("loadCheckIns", error);
    return [];
  }
  return data || [];
}

/**
 * Save today's check-in (or a skip). Upserts on (user_id, day) so a second tap on
 * submit, or answering after skipping, updates the one row for that day.
 */
export async function saveCheckIn(userId, { day, answers = {}, note = null, skipped = false, response = null }) {
  if (!isConfigured || !userId) return { error: new Error("not configured") };
  const { error } = await supabase
    .from("check_ins")
    .upsert(
      { user_id: userId, day, answers, note: note || null, skipped, response },
      { onConflict: "user_id,day" }
    );
  if (error) console.error("saveCheckIn", error);
  return { error };
}
