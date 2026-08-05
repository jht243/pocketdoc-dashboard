/**
 * Transactional email.
 *
 * Nothing here ever sees the Resend key. The browser calls our `ghai-send-email`
 * Edge Function with the user's Supabase JWT, and the function holds the key in its
 * own environment. Putting the key in a VITE_* var would inline it into the public
 * bundle, so it deliberately does not exist on this side.
 */
import { supabase, isConfigured } from "./supabase";
import { EMAIL_COLORS, renderEmailLayout } from "./emailLayout";

export async function sendEmail({ to, subject, html, text, replyTo }) {
  if (!isConfigured) return { error: new Error("Supabase not configured") };

  const { data, error } = await supabase.functions.invoke("ghai-send-email", {
    body: { to, subject, html, text, replyTo },
  });
  if (error) console.error("sendEmail", error);
  return { data, error };
}

/** Screening reminder — the "you don't even have to open the app" nudge. */
export function screeningReminderEmail({ firstName, items = [], ctaUrl = "https://guidedhealth.ai" }) {
  const list = items
    .map(
      (i) =>
        `<li style="margin-bottom:8px"><strong style="color:${EMAIL_COLORS.text}">${i.name}</strong>${
          i.frequency
            ? ` — <span style="color:${EMAIL_COLORS.textSecondary}">${i.frequency}</span>`
            : ""
        }</li>`
    )
    .join("");

  const countLabel =
    items.length === 1
      ? "screening is due"
      : `${items.length} preventive screenings are due`;

  const html = renderEmailLayout({
    preheader:
      items.length === 1
        ? `${items[0].name} is due — review your preventive care schedule.`
        : `${items.length} screenings are due — review your preventive care schedule.`,
    headline: items.length === 1 ? `${items[0].name} is due` : "Screenings due",
    subheader: `Hi ${firstName || "there"} — based on your age and health profile, the following ${countLabel}.`,
    bodyHtml: `
      <ul style="margin-top:0;margin-bottom:16px;padding-left:20px;font-size:14px;line-height:1.5;color:${EMAIL_COLORS.text}">${list}</ul>
      <p style="margin-top:0;margin-bottom:0">These are standard preventive-care recommendations — worth raising with your clinician at your next visit.</p>
    `,
    ctaLabel: "Open Guided Health AI",
    ctaUrl,
  });

  return {
    subject:
      items.length === 1
        ? `${items[0].name} is due`
        : `${items.length} preventive screenings are due`,
    html,
    text: [
      `Hi ${firstName || "there"},`,
      "",
      `Based on your profile, the following ${countLabel}:`,
      ...items.map((i) => `- ${i.name}${i.frequency ? ` (${i.frequency})` : ""}`),
      "",
      `Open Guided Health AI: ${ctaUrl}`,
      "",
      "Guided Health AI is a wellness companion, not medical care.",
    ].join("\n"),
  };
}
