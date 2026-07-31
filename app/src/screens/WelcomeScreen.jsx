import React from "react";
import { Activity, FlaskConical, Calendar, MessageCircle } from "lucide-react";
import { COLORS, SHADOW, SERIF, RADIUS } from "../theme/tokens";

/**
 * First thing a new visitor sees. The mockup dropped people straight onto a login
 * form with no explanation of what the product is — this says it in one screen and
 * then hands off to auth.
 */
export default function WelcomeScreen({ onContinue, onPrivacy }) {
  const points = [
    { Icon: Calendar, title: "Know what you're due for", body: "An age-based screening schedule, adjusted for your risk factors." },
    { Icon: FlaskConical, title: "Keep your bloodwork in one place", body: "Upload a PDF or photo and see your markers over time." },
    { Icon: MessageCircle, title: "Ask questions about your own data", body: "An assistant that can see your profile and results." },
  ];

  return (
    <div style={{ padding: "44px 22px", minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 30 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 10,
          background: "linear-gradient(135deg, #0ea5e9, #22c55e)",
          display: "grid", placeItems: "center",
          boxShadow: "0 2px 8px rgba(14,165,233,0.3)",
        }}>
          <Activity size={17} color="#fff" strokeWidth={2.5} />
        </div>
        <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 18 }}>Guided Health AI</span>
      </div>

      <h1 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 29, lineHeight: 1.15, letterSpacing: "-0.01em", marginBottom: 10 }}>
        Your health,<br />organized and ahead of you.
      </h1>
      <p style={{ color: COLORS.textSecondary, fontSize: 14, lineHeight: 1.55, marginBottom: 28 }}>
        Most care is reactive — you see a doctor once something is wrong. This keeps
        track of what you should be doing, and what your own results are telling you.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 30 }}>
        {points.map(({ Icon, title, body }) => (
          <div key={title} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{
              width: 34, height: 34, flexShrink: 0, borderRadius: 11,
              background: COLORS.accentDim, display: "grid", placeItems: "center",
            }}>
              <Icon size={17} color={COLORS.accent} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 2 }}>{title}</div>
              <div style={{ color: COLORS.textSecondary, fontSize: 12.5, lineHeight: 1.5 }}>{body}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "auto" }}>
        <button
          onClick={onContinue}
          style={{
            width: "100%", background: COLORS.accent, color: COLORS.onAccent,
            border: "none", fontSize: 14.5, fontWeight: 700, padding: 15,
            borderRadius: RADIUS.sm, cursor: "pointer", boxShadow: SHADOW,
          }}
        >
          Get started
        </button>
        <p style={{ color: COLORS.textMuted, fontSize: 11, lineHeight: 1.5, textAlign: "center", marginTop: 14 }}>
          Guided Health AI is a wellness companion, not a medical device. It does not
          diagnose or treat, and it never replaces your clinician.{" "}
          <button
            onClick={onPrivacy}
            style={{ background: "none", border: "none", color: COLORS.accent, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 }}
          >
            Privacy
          </button>
        </p>
      </div>
    </div>
  );
}
