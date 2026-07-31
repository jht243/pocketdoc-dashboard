/**
 * Transactional email.
 *
 * Nothing here ever sees the Resend key. The browser calls our `ghai-send-email`
 * Edge Function with the user's Supabase JWT, and the function holds the key in its
 * own environment. Putting the key in a VITE_* var would inline it into the public
 * bundle, so it deliberately does not exist on this side.
 */
import { supabase, isConfigured } from "./supabase";

export async function sendEmail({ to, subject, html, text, replyTo }) {
  if (!isConfigured) return { error: new Error("Supabase not configured") };

  const { data, error } = await supabase.functions.invoke("ghai-send-email", {
    body: { to, subject, html, text, replyTo },
  });
  if (error) console.error("sendEmail", error);
  return { data, error };
}

/** Screening reminder — the "you don't even have to open the app" nudge. */
export function screeningReminderEmail({ firstName, items = [] }) {
  const list = items
    .map(
      (i) =>
        `<li style="margin-bottom:6px"><strong>${i.name}</strong>${
          i.frequency ? ` — <span style="color:#55657a">${i.frequency}</span>` : ""
        }</li>`
    )
    .join("");

  return {
    subject:
      items.length === 1
        ? `${items[0].name} is due`
        : `${items.length} preventive screenings are due`,
    html: `
      <div style="font-family:-apple-system,system-ui,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
        <p style="font-size:15px;line-height:1.55">Hi ${firstName || "there"},</p>
        <p style="font-size:15px;line-height:1.55">
          Based on your age and health profile, the following ${
            items.length === 1 ? "screening is" : "screenings are"
          } due:
        </p>
        <ul style="font-size:14px;line-height:1.5;padding-left:18px">${list}</ul>
        <p style="font-size:15px;line-height:1.55">
          These are standard preventive-care recommendations — worth raising with your
          clinician at your next visit.
        </p>
        <p style="font-size:12px;color:#8494a7;line-height:1.5;margin-top:26px">
          Guided Health AI is a wellness tool, not medical care. It does not diagnose or
          treat. If you think you have a medical emergency, call 911.
        </p>
      </div>`,
  };
}
