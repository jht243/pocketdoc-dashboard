import React, { useState } from "react";
import { Lock } from "lucide-react";
import { PhoneFrame } from "./PhoneFrame";
import { COLORS, SHADOW, SERIF, RADIUS } from "../theme/tokens";

// Shared-password gate in front of the whole app. Only the SHA-256 of the password
// ships in the bundle, never the password itself. This is a front-door gate for a
// static site, not real access control — member data is still protected by
// Supabase auth + RLS behind it.
const PASSWORD_SHA256 = "ef790cce729633c1f9ecd96a24b805d292a18723801fa9e02be3dfc9c624df4e";
const STORAGE_KEY = "pocketdoc.siteGate";

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function readUnlocked() {
  try {
    return localStorage.getItem(STORAGE_KEY) === PASSWORD_SHA256;
  } catch {
    return false;
  }
}

export default function SiteGate({ children }) {
  const [unlocked, setUnlocked] = useState(readUnlocked);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (unlocked) return children;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const hash = await sha256(password);
    setBusy(false);
    if (hash !== PASSWORD_SHA256) {
      setError("That password isn't right.");
      return;
    }
    // Storing the hash (not a bare flag) means changing the password re-locks everyone.
    try {
      localStorage.setItem(STORAGE_KEY, hash);
    } catch {
      // Private mode / blocked storage: unlock for this visit only.
    }
    setUnlocked(true);
  };

  return (
    <div
      style={{
        background: "radial-gradient(1200px 800px at 50% -10%, #ffffff 0%, #e4e9ef 60%)",
        padding: 16,
        height: "100dvh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <PhoneFrame>
        <div style={{ padding: "48px 22px", minHeight: "100%" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "linear-gradient(135deg, #0ea5e9, #22c55e)",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 2px 8px rgba(14,165,233,0.3)",
              marginBottom: 22,
            }}
          >
            <Lock size={20} color="#fff" strokeWidth={2.5} />
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
            Enter password
          </h1>
          <p style={{ color: COLORS.textSecondary, fontSize: 13.5, lineHeight: 1.5, marginBottom: 26 }}>
            This site is password protected.
          </p>

          <form onSubmit={submit}>
            <input
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="Password"
              style={{
                width: "100%",
                padding: "13px 14px",
                borderRadius: RADIUS.sm,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.bgCardAlt,
                color: COLORS.textPrimary,
                fontSize: 14,
                outline: "none",
                marginBottom: 14,
              }}
            />
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
              {busy ? "One moment…" : "Continue"}
            </button>
          </form>
        </div>
      </PhoneFrame>
    </div>
  );
}
