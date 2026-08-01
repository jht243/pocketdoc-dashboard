import React from "react";
import { ChevronRight, LockKeyhole } from "lucide-react";
import { Card } from "./Card";
import { COLORS } from "../theme/tokens";

function LockedDataSection({ title, description, actionLabel, onAction, rows = 2 }) {
  return (
    <Card style={{ background: COLORS.bgCardAlt, border: `1px dashed ${COLORS.strokeStrong}`, padding: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: COLORS.border, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <LockKeyhole size={14} color={COLORS.textMuted} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textSecondary, marginTop: 1 }}>{title}</div>
          <div style={{ margin: "12px 0", opacity: 0.68 }}>
            {Array.from({ length: rows }).map((_, index) => (
              <div key={index} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: index < rows - 1 ? `1px solid ${COLORS.border}` : "none" }}>
                <span style={{ width: index === 0 ? "43%" : "58%", height: 8, borderRadius: 8, background: "rgba(132,148,167,0.22)" }} />
                <span style={{ width: "18%", height: 8, borderRadius: 8, background: "rgba(132,148,167,0.14)" }} />
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: COLORS.textSecondary }}>{description}</div>
          {onAction && <button onClick={onAction} style={{ display: "inline-flex", alignItems: "center", gap: 2, marginTop: 10, padding: 0, border: "none", background: "none", color: COLORS.tealLight, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
            {actionLabel} <ChevronRight size={14} />
          </button>}
        </div>
      </div>
    </Card>
  );
}

export { LockedDataSection };
