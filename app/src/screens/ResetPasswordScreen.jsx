import React, { useState } from "react";
import { Activity } from "lucide-react";
import { COLORS, SHADOW, SERIF, RADIUS } from "../theme/tokens";
import { useAuth } from "../lib/AuthContext";

// ---- SET NEW PASSWORD (recovery) ----
// Shown when the user arrives from a password-reset email. They have a temporary
// recovery session; entering a new password writes it and drops them into the app.
export default function ResetPasswordScreen() {
  const { updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setBusy(true);
    const { error: err } = await updatePassword(password);
    setBusy(false);
    if (err) { setError(err.message); return; }
    // On success `recovering` flips false in context and the app renders itself;
    // this brief confirmation covers the moment before that re-render.
    setDone(true);
  };

  const field = {
    width: "100%", padding: "13px 14px", borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.border}`, background: COLORS.bgCardAlt,
    color: COLORS.textPrimary, fontSize: 14, outline: "none",
  };
  const label = { fontSize: 12, color: COLORS.textSecondary, marginBottom: 6, display: "block" };

  return (
    <div style={{ padding: "48px 22px", minHeight: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: SERIF, fontWeight: 600, fontSize: 18, marginBottom: 28 }}>
        <div style={{ width: 30, height: 30, borderRadius: 10, background: "linear-gradient(135deg, #0ea5e9, #22c55e)", display: "grid", placeItems: "center", boxShadow: "0 2px 8px rgba(14,165,233,0.3)" }}>
          <Activity size={17} color="#fff" strokeWidth={2.5} />
        </div>
        Guided Health AI
      </div>

      <h1 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 26, letterSpacing: "-0.01em", marginBottom: 6 }}>
        Set a new password
      </h1>
      <p style={{ color: COLORS.textSecondary, fontSize: 13.5, lineHeight: 1.5, marginBottom: 26 }}>
        Choose a new password for your account. You'll be signed in right after.
      </p>

      {done ? (
        <div style={{ background: COLORS.goodDim, border: `1px solid ${COLORS.good}40`, color: COLORS.good, fontSize: 13, padding: "12px 14px", borderRadius: RADIUS.sm }}>
          Password updated. Taking you in…
        </div>
      ) : (
        <form onSubmit={submit}>
          <div style={{ marginBottom: 14 }}>
            <label style={label}>New password</label>
            <input style={field} type="password" required minLength={6} autoComplete="new-password"
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={label}>Confirm new password</label>
            <input style={field} type="password" required minLength={6} autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter your new password" />
          </div>

          {error && (
            <div style={{ background: COLORS.badDim, border: `1px solid ${COLORS.danger}40`, color: COLORS.danger, fontSize: 12.5, padding: "10px 12px", borderRadius: RADIUS.sm, marginBottom: 14 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={busy} style={{
            width: "100%", background: busy ? COLORS.bgCardAlt : COLORS.accent,
            color: busy ? COLORS.textMuted : COLORS.onAccent, border: "none",
            fontSize: 14, fontWeight: 700, padding: 14, borderRadius: RADIUS.sm,
            cursor: busy ? "default" : "pointer", boxShadow: busy ? "none" : SHADOW,
          }}>
            {busy ? "Saving…" : "Update password"}
          </button>
        </form>
      )}

      {!done && (
        <button onClick={() => signOut()} style={{
          background: "none", border: "none", color: COLORS.textMuted, fontSize: 13,
          fontWeight: 600, cursor: "pointer", marginTop: 18, width: "100%",
        }}>
          Cancel
        </button>
      )}
    </div>
  );
}
