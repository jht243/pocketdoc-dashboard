import React, { useState } from "react";
import { COLORS } from "../theme/tokens";
import { Card } from "./Card";
import { SectionLabel } from "./SectionLabel";

function ScoreTrendChart() {
  // last 14 days: base and daily points (each out of 50)
  const rawData = [
    { base: 30, daily: 20 }, { base: 30, daily: 24 }, { base: 30, daily: 18 },
    { base: 30, daily: 27 }, { base: 32, daily: 22 }, { base: 32, daily: 19 },
    { base: 32, daily: 25 }, { base: 32, daily: 30 }, { base: 32, daily: 21 },
    { base: 32, daily: 17 }, { base: 28, daily: 20 }, { base: 28, daily: 26 },
    { base: 28, daily: 19 }, { base: 26, daily: 50 },
  ];
  const todayDate = new Date(2026, 5, 29); // June 29, 2026
  const data = rawData.map((d, i) => {
    const date = new Date(todayDate);
    date.setDate(date.getDate() - (rawData.length - 1 - i));
    return { ...d, date };
  });

  const [hoverIdx, setHoverIdx] = useState(null);
  const w = 320, h = 110, padTop = 8, padBottom = 18, max = 100;
  const innerH = h - padTop - padBottom;
  const stepX = w / (data.length - 1);

  const baseLine = data.map((d, i) => [i * stepX, padTop + innerH * (1 - d.base / max)]);
  const totalLine = data.map((d, i) => [i * stepX, padTop + innerH * (1 - (d.base + d.daily) / max)]);

  const path = (pts) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const baseAreaPath = `${path(baseLine)} L${(data.length - 1) * stepX},${padTop + innerH} L0,${padTop + innerH} Z`;
  const totalAreaPath = `${path(totalLine)} L${(data.length - 1) * stepX},${padTop + innerH} L0,${padTop + innerH} Z`;

  const todayTotal = data[data.length - 1].base + data[data.length - 1].daily;
  const weekAgoTotal = data[data.length - 7].base + data[data.length - 7].daily;
  const delta = todayTotal - weekAgoTotal;

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * w;
    const idx = Math.round(x / stepX);
    setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)));
  };

  const fmtDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const hovered = hoverIdx !== null ? data[hoverIdx] : null;
  const hoveredTotal = hovered ? hovered.base + hovered.daily : null;
  const hoveredX = hoverIdx !== null ? hoverIdx * stepX : null;
  const hoveredY = hoverIdx !== null ? totalLine[hoverIdx][1] : null;

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <SectionLabel>14-day trend</SectionLabel>
        <span style={{ fontSize: 12, color: delta >= 0 ? COLORS.tealLight : COLORS.danger, fontWeight: 600 }}>
          {delta >= 0 ? "+" : ""}{delta} pts vs last week
        </span>
      </div>
      <div style={{ position: "relative" }}>
        {hoverIdx !== null && (
          <div style={{
            position: "absolute", pointerEvents: "none", zIndex: 5,
            left: `${(hoveredX / w) * 100}%`, top: 0,
            transform: hoveredX / w > 0.6 ? "translateX(-100%)" : "translateX(0%)",
            background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8,
            padding: "6px 9px", whiteSpace: "nowrap"
          }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>{fmtDate(hovered.date)}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary }}>{hoveredTotal} pts</div>
          </div>
        )}
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"
          onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)}
          style={{ touchAction: "none" }}>
          <path d={totalAreaPath} fill={COLORS.tealLight} opacity="0.22" />
          <path d={path(totalLine)} fill="none" stroke={COLORS.tealLight} strokeWidth="2" />
          <path d={baseAreaPath} fill={COLORS.gold} opacity="0.30" />
          <path d={path(baseLine)} fill="none" stroke={COLORS.gold} strokeWidth="2" />
          {hoverIdx !== null && (
            <g>
              <line x1={hoveredX} y1={padTop} x2={hoveredX} y2={padTop + innerH}
                stroke={COLORS.textMuted} strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={hoveredX} cy={hoveredY} r="4" fill={COLORS.tealLight} stroke={COLORS.bgDeep} strokeWidth="1.5" />
            </g>
          )}
        </svg>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 10, color: COLORS.textMuted }}>{fmtDate(data[0].date)}</span>
        <span style={{ fontSize: 10, color: COLORS.textMuted }}>Today</span>
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: COLORS.gold }} />
          <span style={{ fontSize: 11, color: COLORS.textSecondary }}>Base</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: COLORS.tealLight }} />
          <span style={{ fontSize: 11, color: COLORS.textSecondary }}>Total (base + daily)</span>
        </div>
      </div>
    </Card>
  );
}

export { ScoreTrendChart };
