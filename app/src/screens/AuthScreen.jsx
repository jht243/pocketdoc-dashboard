import React, { useState } from "react";
import { Activity } from "lucide-react";
import { COLORS, SHADOW, SERIF, RADIUS } from "../theme/tokens";
import { useAuth } from "../lib/AuthContext";

export default function AuthScreen({ onPrivacy }) {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState("signin"); // signin | signup | reset
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
    // Password reset: email only, no password. We always report success (even if the
    // email isn't registered) so the form can't be used to probe which emails exist.
    if (mode === "reset") {
      setBusy(true);
      const { error: err } = await resetPassword(email.trim());
      setBusy(false);
      if (err) { setError(err.message); return; }
      setNotice("If an account exists for that email, a password reset link is on its way.");
      setMode("signin");
      return;
    }
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
    // Sign-up returns a user but no session in two different situations, and they
    // need different messages:
    //  1. The email is already registered. Supabase hides this for anti-enumeration
    //     by returning a user with an empty `identities` array — detect that and
    //     tell them to sign in instead of "check your email" (which never arrives).
    //  2. A genuinely new account that must confirm via email before first sign-in.
    if (mode === "signup" && !data?.session) {
      const alreadyRegistered = data?.user?.identities?.length === 0;
      setNotice(
        alreadyRegistered
          ? "An account with this email already exists — sign in below."
          : "Check your email to confirm your account, then sign in."
      );
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
        {mode === "signin"
          ? "Welcome back"
          : mode === "reset"
            ? "Reset your password"
            : "Create your account"}
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
          : mode === "reset"
            ? "Enter your email and we'll send you a link to set a new password."
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
        {mode !== "reset" && (
          <div style={{ marginBottom: mode === "signin" ? 8 : 18 }}>
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
        )}

        {mode === "signin" && (
          <button
            type="button"
            onClick={() => { setMode("reset"); setError(""); setNotice(""); }}
            style={{
              background: "none", border: "none", color: COLORS.accent,
              fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0,
              marginBottom: 18, display: "block",
            }}
          >
            Forgot password?
          </button>
        )}

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
              : mode === "reset"
                ? "Send reset link"
                : "Create account"}
        </button>
      </form>

      <button
        onClick={() => {
          // From reset, go back to sign in; otherwise toggle sign in / sign up.
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
          : mode === "reset"
            ? "Back to sign in"
            : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
