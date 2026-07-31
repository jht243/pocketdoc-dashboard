import React, { useState } from "react";
import { Activity } from "lucide-react";
import { COLORS, SHADOW, SERIF, RADIUS } from "../theme/tokens";
import { useAuth } from "../lib/AuthContext";

export default function AuthScreen({ onPrivacy }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    // Consent is captured before any health data is collected, not after.
    if (mode === "signup" && !consent) {
      setError("Please accept the terms to create an account.");
      return;
    }
    setBusy(true);
    const fn = mode === "signin" ? signIn : signUp;
    const { data, error: err } = await fn(email.trim(), password);
    setBusy(false);

    if (err) {
      setError(err.message);
      return;
    }
    // With email confirmation switched on, sign-up returns a user but no session —
    // the app can't proceed until they confirm, so say so rather than appearing stuck.
    if (mode === "signup" && !data?.session) {
      setNotice("Check your email to confirm your account, then sign in.");
      setMode("signin");
    }
  };

  const field = {
    width: "100%",
    padding: "13px 14px",
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.bgCardAlt,
    color: COLORS.textPrimary,
    fontSize: 14,
    outline: "none",
  };
  const label = {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
    display: "block",
  };

  return (
    <div style={{ padding: "48px 22px", minHeight: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          fontFamily: SERIF,
          fontWeight: 600,
          fontSize: 18,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            background: "linear-gradient(135deg, #0ea5e9, #22c55e)",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 2px 8px rgba(14,165,233,0.3)",
          }}
        >
          <Activity size={17} color="#fff" strokeWidth={2.5} />
        </div>
        Guided Health AI
      </div>

      <h1
        style={{
          fontFamily: SERIF,
          fontWeight: 500,
          fontSize: 26,
          letterSpacing: "-0.01em",
          marginBottom: 6,
        }}
      >
        {mode === "signin" ? "Welcome back" : "Create your account"}
      </h1>
      <p
        style={{
          color: COLORS.textSecondary,
          fontSize: 13.5,
          lineHeight: 1.5,
          marginBottom: 26,
        }}
      >
        {mode === "signin"
          ? "Sign in to pick up where you left off."
          : "Your health profile, screenings, and records stay private to you."}
      </p>

      <form onSubmit={submit}>
        <div style={{ marginBottom: 14 }}>
          <label style={label}>Email</label>
          <input
            style={field}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={label}>Password</label>
          <input
            style={field}
            type="password"
            required
            minLength={6}
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </div>

        {error && (
          <div
            style={{
              background: COLORS.badDim,
              border: `1px solid ${COLORS.danger}40`,
              color: COLORS.danger,
              fontSize: 12.5,
              padding: "10px 12px",
              borderRadius: RADIUS.sm,
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        )}
        {notice && (
          <div
            style={{
              background: COLORS.accentDim,
              border: `1px solid ${COLORS.accent}40`,
              color: COLORS.accent,
              fontSize: 12.5,
              padding: "10px 12px",
              borderRadius: RADIUS.sm,
              marginBottom: 14,
            }}
          >
            {notice}
          </div>
        )}

        {mode === "signup" && (
          <label
            style={{
              display: "flex", gap: 9, alignItems: "flex-start", cursor: "pointer",
              marginBottom: 16, fontSize: 12, lineHeight: 1.5,
              color: COLORS.textSecondary,
            }}
          >
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, accentColor: COLORS.accent }}
            />
            <span>
              I understand this is a wellness tool, not medical care, and it does not
              diagnose or treat. I agree to the{" "}
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); onPrivacy?.(); }}
                style={{ background: "none", border: "none", color: COLORS.accent, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}
              >
                privacy terms
              </button>
              .
            </span>
          </label>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            width: "100%",
            background: busy ? COLORS.bgCardAlt : COLORS.accent,
            color: busy ? COLORS.textMuted : COLORS.onAccent,
            border: "none",
            fontSize: 14,
            fontWeight: 700,
            padding: 14,
            borderRadius: RADIUS.sm,
            cursor: busy ? "default" : "pointer",
            boxShadow: busy ? "none" : SHADOW,
          }}
        >
          {busy
            ? "One moment…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError("");
          setNotice("");
        }}
        style={{
          background: "none",
          border: "none",
          color: COLORS.accent,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          marginTop: 18,
          width: "100%",
        }}
      >
        {mode === "signin"
          ? "Need an account? Sign up"
          : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
