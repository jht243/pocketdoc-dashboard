/**
 * Persistence for the combined Health Score.
 *
 * The wearable sub-score is written server-side by the sync worker, on the day's own
 * biometric row. The COMBINED score — wearable plus preventive care plus, eventually,
 * bloodwork — is assembled here from inputs the member already owns, so it is written
 * from the app under the member's own credentials rather than through a function.
 *
 * Why persist a derived number at all: without it the overall score exists only for
 * as long as a render, and "is my score going up" becomes unanswerable. One row per
 * member per day, upserted, so repeated opens of the app don't multiply rows.
 */

import { supabase, isConfigured } from "./supabase";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Record today's combined score. Fire-and-forget: a member should never be blocked
 * from seeing their score because writing the history copy of it failed.
 *
 * @param {string} userId
 * @param {object} model  the result of `useScoreModel`
 */
export async function recordHealthScore(userId, model) {
  if (!isConfigured || !userId || !model?.hasData) return { error: null };

  const wearable = model.wearable || null;
  const bloodwork = model.bloodwork?.available ? model.bloodwork : null;

  const row = {
    user_id: userId,
    day: today(),
    wearable_score: wearable ? wearable.totalScore : null,
    // Null rather than 0 when there isn't enough of a panel to score: a zero here
    // would read forever after as "they scored nothing", which isn't what happened.
    bloodwork_score: bloodwork ? bloodwork.totalScore : null,
    preventive_score: model.baseItems?.length ? model.preventiveDisplay : null,
    total_score: model.totalScore,
    total_max: model.totalMax,
    label: wearable?.label ?? null,
    detail: {
      components: model.components,
      preventive: { total: model.preventiveTotal, max: model.preventiveMax, items: model.baseItems },
      wearable,
      bloodwork: model.bloodwork,
    },
    score_version: wearable?.version ?? null,
    computed_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("health_score_daily")
    .upsert(row, { onConflict: "user_id,day" });

  if (error) console.error("recordHealthScore", error);
  return { error };
}

/** The member's score history, newest first — for a trend view of the score itself. */
export async function loadHealthScoreHistory(userId, days = 90) {
  if (!isConfigured || !userId) return [];

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("health_score_daily")
    .select("*")
    .eq("user_id", userId)
    .gte("day", since.toISOString().slice(0, 10))
    .order("day", { ascending: false });

  if (error) {
    console.error("loadHealthScoreHistory", error);
    return [];
  }
  return data || [];
}
