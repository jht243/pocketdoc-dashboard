import React from "react";
import { ClipboardList, FileText, HeartPulse, Home, MessageCircle } from "lucide-react";
import { COLORS } from "../theme/tokens";

// Tab names follow the spec's Home · Biology · Protocol · Records · Team. "Care" holds
// the Protocol slot: it is the hub for medications, genetics and preventive care,
// which is what our Protocol-equivalent content already lives in.
function TabBar({ active, setActive }) {
  const tabs = [
    { id: "home", icon: Home, label: "Home" },
    { id: "labs", icon: HeartPulse, label: "Biology" },
    { id: "profile", icon: ClipboardList, label: "Care" },
    { id: "records", icon: FileText, label: "Records" },
    { id: "aichat", icon: MessageCircle, label: "Team" },
  ];
  return (
    <div style={{
      flexShrink: 0, height: 80, position: "relative", zIndex: 10,
      background: COLORS.bgCardAlt,
      borderTop: `1px solid ${COLORS.border}`,
      display: "flex", alignItems: "center", justifyContent: "space-around",
      paddingBottom: 16
    }}>
      {tabs.map(t => {
        const isActive = active === t.id;
        const color = isActive ? COLORS.accent : COLORS.textMuted;
        return (
          <button key={t.id} onClick={() => setActive(t.id)} aria-current={isActive ? "page" : undefined} style={{
            background: "none", border: "none", display: "flex", flexDirection: "column",
            alignItems: "center", gap: 3, cursor: "pointer", padding: "4px 8px", minWidth: 56
          }}>
            {/* Active indicator: a small accent dot above the icon, as in the spec mockups. */}
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: isActive ? COLORS.accent : "transparent", marginBottom: 1 }} />
            <t.icon size={20} color={color} strokeWidth={isActive ? 2.1 : 1.75} />
            <span style={{ fontSize: 10.5, color, fontWeight: isActive ? 600 : 400 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export { TabBar };
