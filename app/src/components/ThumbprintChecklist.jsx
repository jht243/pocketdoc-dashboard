import React from "react";
import { CheckCircle2, ChevronRight, ClipboardList, Dna, Droplet, Pill, Watch } from "lucide-react";
import { Card } from "./Card";
import { COLORS } from "../theme/tokens";

const ICONS = { blood: Droplet, pgx: Pill, cgx: Dna, history: ClipboardList, wearable: Watch };

function statusPill(item) {
  if (item.status === "done") return { label: "Done", bg: COLORS.goodDim, fg: COLORS.good };
  if (item.status === "uploaded") return { label: "Uploaded", bg: COLORS.accentDim, fg: COLORS.accent };
  if (item.status === "started") return { label: `${item.progress.done} of ${item.progress.total}`, bg: COLORS.accentDim, fg: COLORS.accent };
  return { label: item.required ? "Not started" : "Optional", bg: COLORS.neutralDim, fg: COLORS.textMuted };
}

// "Building your Thumbprint" — the Home screen's lead card until the baseline is in.
// Layout follows the spec's Day 0 screen: one progress line, then each piece of data
// with what it tells the platform and where to add it.
function ThumbprintChecklist({ checklist, setActive }) {
  const { items, done, total } = checklist;
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: COLORS.textPrimary }}>Building your Thumbprint</span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.accent }}>{done} of {total} done</span>
        </div>
        <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 10 }}>
          Your health score and personalized insights unlock as your bloodwork, genetics, and history come in.
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {items.filter((i) => i.required).map((i) => (
            <span key={i.id} style={{ flex: 1, height: 5, borderRadius: 3, background: i.status === "done" ? COLORS.good : i.status === "todo" ? COLORS.ringTrack : COLORS.accentSoft }} />
          ))}
        </div>
      </div>

      {items.map((item) => {
        const Icon = ICONS[item.id];
        const pill = statusPill(item);
        const isDone = item.status === "done";
        return (
          <button key={item.id} onClick={() => setActive(item.target)} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 12, textAlign: "left",
            background: "none", border: "none", borderTop: `1px solid ${COLORS.border}`,
            padding: "12px 16px", cursor: "pointer",
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: isDone ? COLORS.goodDim : COLORS.bgCardAlt }}>
              {isDone ? <CheckCircle2 size={17} color={COLORS.good} /> : <Icon size={16} color={COLORS.accent} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary }}>{item.title}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.4, marginTop: 1 }}>{item.detail}</div>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 99, background: pill.bg, color: pill.fg, flexShrink: 0, whiteSpace: "nowrap" }}>{pill.label}</span>
            <ChevronRight size={14} color={COLORS.textMuted} style={{ flexShrink: 0 }} />
          </button>
        );
      })}
    </Card>
  );
}

export { ThumbprintChecklist };
