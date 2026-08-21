import React from "react";
import { COLORS } from "../theme/tokens";

/**
 * The Health Score dial: one number, with each component as a ring and a bar.
 *
 * `components` arrive already scaled to their own max (50 each) from `useScoreModel`,
 * and only components with data behind them are passed in — so the denominator under
 * the dial is what the member could actually have earned today.
 */
function ScoreGauge({ components = [], totalScore = 0, totalMax = 0, bloodwork, onTap }) {
  // Rings sit close together near the outer edge so the centre stays clear for the
  // score readout — at tighter radii the inner ring cut straight through the label.
  // A third component needs a third ring, so the whole set thins and tightens rather
  // than the innermost one being pushed into the text.
  const dense = components.length > 2;
  const radii = dense ? [94, 82, 70] : [92, 77, 62];
  const stroke = dense ? 9 : 12;
  const captionSize = dense ? 9 : 10.5;
  const ringColors = [COLORS.gold, COLORS.accent, COLORS.violet];

  const Bar = ({ label, sub, value, max, color }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{label}</span>
        <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{value} / {max}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: COLORS.border, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.max(0, Math.min(1, value / max)) * 100}%`, background: color, borderRadius: 3 }} />
      </div>
      {sub && <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <button onClick={onTap} style={{
      background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", width: "100%"
    }}>
      <div style={{ position: "relative", width: 216, height: 216, margin: "0 auto" }}>
        <svg width="216" height="216" style={{ transform: "rotate(-90deg)" }}>
          <defs>
            <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          {components.slice(0, radii.length).map((component, i) => {
            const r = radii[i];
            const circumference = 2 * Math.PI * r;
            const pct = Math.max(0, Math.min(1, component.points / component.max));
            return (
              <g key={component.key}>
                <circle cx="108" cy="108" r={r} fill="none" stroke={COLORS.ringTrack} strokeWidth={stroke} />
                <circle cx="108" cy="108" r={r} fill="none"
                  stroke={i === 0 ? "url(#scoreGrad)" : ringColors[i]}
                  strokeWidth={stroke} strokeDasharray={`${circumference * pct} ${circumference}`} strokeLinecap="round"
                  style={i === 0 ? { filter: "drop-shadow(0 2px 8px rgba(22,163,74,0.25))" } : undefined} />
              </g>
            );
          })}
        </svg>
        <div style={{
          position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2
        }}>
          <span style={{ fontSize: dense ? 50 : 58, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: COLORS.textPrimary }}>{Math.round(totalScore)}</span>
          <span style={{ fontSize: captionSize, color: COLORS.textMuted, fontWeight: 600, letterSpacing: "0.1em" }}>OF {totalMax}</span>
          <span style={{ fontSize: captionSize, color: COLORS.textMuted, fontWeight: 600, letterSpacing: "0.1em" }}>HEALTH SCORE</span>
        </div>
      </div>
      <div style={{ marginTop: 18, padding: "0 8px", textAlign: "left" }}>
        {components.map((component, i) => (
          <Bar key={component.key} label={component.label} sub={component.sub}
            value={component.points} max={component.max} color={ringColors[i] || COLORS.tealLight} />
        ))}
        {bloodwork && !bloodwork.available && (
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>
            Bloodwork scoring is not live yet — it isn't counted for or against you.
          </div>
        )}
      </div>
    </button>
  );
}

export { ScoreGauge };
