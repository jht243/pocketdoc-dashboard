/**
 * Product analytics: one row in ghai.analytics_events per event, written as the
 * signed-in member. Fire-and-forget: an analytics failure must never touch what the
 * member is doing, so nothing here throws or is awaited by a caller.
 *
 * The events are the Oct 14 spec's list, and the table refuses any other name.
 */
import { useEffect, useRef } from "react";
import { supabase } from "./supabase";

export const EVENTS = [
  "score_viewed", "scorecard_system_opened", "simulator_opened", "simulator_lever_tried",
  "target_why_opened", "discussion_export", "score_missing_prompt_shown",
];

export function track(event, props = {}) {
  if (!supabase || !EVENTS.includes(event)) return;
  supabase.auth.getSession()
    .then(({ data }) => {
      if (!data?.session) return null;
      return supabase.from("analytics_events").insert({ event, props });
    })
    .then((res) => { if (res?.error) console.warn("analytics", event, res.error.message); })
    .catch(() => {});
}

/** Track once per mount, e.g. a score seen or a missing-data prompt shown. */
export function useTrackOnce(event, props, when = true) {
  const sent = useRef(false);
  useEffect(() => {
    if (!when || sent.current) return;
    sent.current = true;
    track(event, props);
    // props are read once, at the moment the thing was seen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, when]);
}
