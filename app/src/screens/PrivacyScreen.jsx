import React from "react";
import { ChevronRight } from "lucide-react";
import { COLORS, SERIF } from "../theme/tokens";

export const CONSENT_VERSION = "v2";

/**
 * Plain-language privacy summary shown before any health data is collected.
 * Deliberately not legal boilerplate — this is the pre-launch placeholder that a
 * healthcare attorney should review and replace before real users are onboarded.
 */
export default function PrivacyScreen({ onBack }) {
  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 17, marginBottom: 6 }}>{title}</h2>
      <p style={{ color: COLORS.textSecondary, fontSize: 13, lineHeight: 1.6 }}>{children}</p>
    </div>
  );

  return (
    <div style={{ padding: "26px 20px 40px", minHeight: "100%" }}>
      {onBack && (
        <button
          onClick={onBack}
          style={{
            background: "none", border: "none", color: COLORS.textSecondary,
            display: "flex", alignItems: "center", gap: 4, cursor: "pointer",
            fontSize: 13, padding: 0, marginBottom: 16,
          }}
        >
          <ChevronRight size={16} style={{ transform: "rotate(180deg)" }} /> Back
        </button>
      )}

      <h1 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 25, letterSpacing: "-0.01em", marginBottom: 6 }}>
        Privacy &amp; your data
      </h1>
      <p style={{ color: COLORS.textMuted, fontSize: 12, marginBottom: 24 }}>
        Version {CONSENT_VERSION} · Pre-launch draft
      </p>

      <Section title="What we collect">
        The profile you enter during onboarding (age, sex, risk factors, conditions,
        medications), any documents you upload such as bloodwork, and your
        conversations with the assistant.
      </Section>

      <Section title="Who can see it">
        Only you. Your records are stored under your account and access is enforced at
        the database level, so no other user can read them. We do not sell your data
        and we do not share it with advertisers.
      </Section>

      <Section title="How the assistant uses it">
        When you ask a question, your profile, results and recent messages in the
        conversation are sent to an AI provider to generate an answer.
      </Section>

      <Section title="Your conversations are kept">
        Your conversation with the assistant is saved to your account and stays there,
        so you can pick up where you left off instead of starting over each time.
        Photos you attach are stored the same way. Signing out or closing the app
        never deletes any of it — only you can, using the delete button on the chat
        screen, and deleting the conversation removes its photos with it.
      </Section>

      <Section title="This is not medical care">
        Guided Health AI is a wellness and organization tool. It does not diagnose,
        treat, or prescribe, and the assistant can be wrong. Always confirm anything
        you read here with a qualified clinician. If you think you have a medical
        emergency, call 911.
      </Section>

      <Section title="Deleting your data">
        You can request deletion of your account and all associated records at any
        time, and we will remove them.
      </Section>

      <div
        style={{
          background: COLORS.warnDim,
          border: `1px solid ${COLORS.warning}40`,
          borderRadius: 12,
          padding: 12,
          fontSize: 12,
          lineHeight: 1.55,
          color: COLORS.textSecondary,
        }}
      >
        <strong style={{ color: COLORS.textPrimary }}>Note for the team:</strong> this
        is placeholder copy for internal testing. It must be reviewed and replaced by
        a healthcare attorney before onboarding real users.
      </div>
    </div>
  );
}
