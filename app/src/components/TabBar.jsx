import React from "react";
import { Crown, FileText, FlaskConical, Home, MessageCircle } from "lucide-react";
import { COLORS } from "../theme/tokens";

function TabBar({ active, setActive }) {
  const tabs = [
    { id: "home", icon: Home, label: "Today" },
    { id: "aichat", icon: MessageCircle, label: "Ask" },
    { id: "records", icon: FileText, label: "Records" },
    { id: "labs", icon: FlaskConical, label: "Labs" },
    { id: "profile", icon: Crown, label: "Care" },
  ];
  return (
    <div style={{
      flexShrink: 0, height: 86, position: "relative", zIndex: 10,
      background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)",
      borderTop: `1px solid ${COLORS.border}`,
      display: "flex", alignItems: "center", justifyContent: "space-around",
      paddingBottom: 18
    }}>
      {tabs.map(t => {
        const isActive = active === t.id;
        return (
          <button key={t.id} onClick={() => setActive(t.id)} style={{
            background: "none", border: "none", display: "flex", flexDirection: "column",
            alignItems: "center", gap: 4, cursor: "pointer", padding: "4px 8px"
          }}>
            <t.icon size={20} color={isActive ? COLORS.tealLight : COLORS.textMuted} strokeWidth={1.75} />
            <span style={{
              fontSize: 10, color: isActive ? COLORS.tealLight : COLORS.textMuted,
              fontWeight: isActive ? 600 : 400
            }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export { TabBar };
