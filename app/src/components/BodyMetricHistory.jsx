import React, { useState } from "react";
import { X } from "lucide-react";
import { COLORS, SERIF } from "../theme/tokens";
import { Card } from "./Card";

// ---- BODY SCREEN (vitals, sleep detail, weight & composition) ----
// ---- WEIGHT / BODY FAT HISTORY (tap-in trend view) ----
// `series` and `goal` are the user's REAL data, passed down from BodyScreen. Nothing
// is fabricated here: with fewer than two real readings there is no trend to draw, so
// the view shows an honest empty state instead of an invented line.
function BodyMetricHistory({ metric, series, goal, onClose }) {
  const isWeight = metric === "weight";
  const unit = isWeight ? "lb" : "%";
  const label = isWeight ? "Weight" : "Body fat";
  const color = isWeight ? COLORS.tealLight : COLORS.gold;

  // Weekly cadence rather than daily, since daily weight/body fat readings are noisy
  // (water, sodium, glycogen) and a daily trend would visually overstate normal
  // fluctuation as if it were meaningful progress or regression.
  const data = (series || []).filter((v) => typeof v === "number" && Number.isFinite(v));
  const hasTrend = data.length >= 2;

  const [hoverIdx, setHoverIdx] = useState(null);
  const w = 320, h = 140, padTop = 16, padBottom = 24;
  const innerH = h - padTop - padBottom;
  const stepX = w / Math.max(1, data.length - 1);
  const allVals = goal != null ? [...data, goal] : data;
  const maxV = Math.max(...allVals) + 1;
  const minV = Math.min(...allVals) - 1;
  const toY = (v) => padTop + innerH * (1 - (v - minV) / (maxV - minV));

  const points = data.map((v, i) => [i * stepX, toY(v)]);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const goalY = toY(goal);

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * w;
    const idx = Math.round(x / stepX);
    setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)));
  };

  const weekLabel = (i) => {
    const weeksAgo = data.length - 1 - i;
    return weeksAgo === 0 ? "This week" : `${weeksAgo}wk ago`;
  };

  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, minHeight: "100%", zIndex: 100,
      background: COLORS.bgDeep, display: "flex", flexDirection: "column",
      padding: "20px 18px 100px"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 500, letterSpacing: "-0.01em" }}>{label} history</div>
        <button onClick={onClose} style={{
          background: COLORS.bgCardAlt, border: "none", borderRadius: 16, width: 32, height: 32,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
        }}><X size={16} color={COLORS.textSecondary} /></button>
      </div>

      {!hasTrend ? (
        <Card>
          <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6 }}>
            Not enough history yet to show a {label.toLowerCase()} trend. Once you have a
            few weeks of readings, your progress toward your goal will appear here.
          </div>
        </Card>
      ) : (<>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>Start</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{data[0]} {unit}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>Current</div>
          <div style={{ fontSize: 16, fontWeight: 700, color }}>{data[data.length - 1]} {unit}</div>
        </div>
        {goal != null && (
          <div>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>Goal</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.gold }}>{goal} {unit}</div>
          </div>
        )}
      </div>

      <Card>
        <div style={{ position: "relative" }}>
          {hoverIdx !== null && (
            <div style={{
              position: "absolute", pointerEvents: "none", zIndex: 5,
              left: `${(hoverIdx * stepX / w) * 100}%`, top: 0,
              transform: (hoverIdx * stepX) / w > 0.6 ? "translateX(-100%)" : "translateX(0%)",
              background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8,
              padding: "6px 9px", whiteSpace: "nowrap"
            }}>
              <div style={{ fontSize: 11, color: COLORS.textMuted }}>{weekLabel(hoverIdx)}</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{data[hoverIdx]} {unit}</div>
            </div>
          )}
          <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"
            onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)}>
            {goal != null && (
              <line x1={0} y1={goalY} x2={w} y2={goalY} stroke={COLORS.gold} strokeWidth="1.5" strokeDasharray="4 4" />
            )}
            <path d={path} fill="none" stroke={color} strokeWidth="2.5" />
            {hoverIdx !== null && (
              <circle cx={hoverIdx * stepX} cy={toY(data[hoverIdx])} r="4" fill={color} stroke={COLORS.bgDeep} strokeWidth="1.5" />
            )}
          </svg>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 10, color: COLORS.textMuted }}>{weekLabel(0)}</span>
          <span style={{ fontSize: 10, color: COLORS.textMuted }}>Today</span>
        </div>
      </Card>

      <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5, marginTop: 4 }}>
        Shown weekly rather than daily. Day-to-day {label.toLowerCase()} naturally fluctuates
        with water, sodium, and glycogen, a single day's number isn't a meaningful read on
        progress.
      </div>
      </>)}
    </div>
  );
}

export { BodyMetricHistory };
