import React from "react";
import { Dna, FlaskConical, MessageCircle } from "lucide-react";
import { COLORS, SHADOW, DISPLAY, RADIUS } from "../theme/tokens";
import { BrandMark } from "../components/BrandMark";

/**
 * First thing a new visitor sees. The mockup dropped people straight onto a login
 * form with no explanation of what the product is — this says it in one screen and
 * then hands off to auth.
 */
export default function WelcomeScreen({ onContinue, onPrivacy }) {
  const points = [
    { Icon: FlaskConical, title: "Your bloodwork, read in context", body: "Upload a PDF or photo and see your markers against functional ranges over time." },
    { Icon: Dna, title: "Built on your genetics", body: "Your genetic and medication profile shapes what the platform tells you." },
    { Icon: MessageCircle, title: "Ask about your own data", body: "A health team that can see your profile and results, and shows its evidence." },
  ];

  return (
    <div style={{ padding: "44px 22px", minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 30 }}>
        <BrandMark size={30} fontSize={18} />
      </div>

      <h1 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 29, lineHeight: 1.15, letterSpacing: "-0.01em", marginBottom: 10 }}>
        Healthcare as unique<br />as your thumbprint.
      </h1>
      <p style={{ color: COLORS.textSecondary, fontSize: 14, lineHeight: 1.55, marginBottom: 28 }}>
        Traditional healthcare waits for something to go wrong. Thumbprint Health
        finds it before it does — your blood work, genetics, and daily health signals
        read together in one profile that gets smarter every day.
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
          Thumbprint Health is a wellness companion, not a medical device. It does not
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
