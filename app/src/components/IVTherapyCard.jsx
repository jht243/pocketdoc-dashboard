import React from "react";
import { Plus, Sparkles } from "lucide-react";
import { COLORS } from "../theme/tokens";
import { Card } from "./Card";

// ---- IV immune support (informational only) ----
// Describes the option generically. We intentionally do NOT list or rank specific
// providers or clinics — the app never recommends a particular provider.
function IVTherapyCard({ highlighted }) {
  return (
    <Card style={{ border: highlighted ? `1.5px solid ${COLORS.tealLight}` : `1px solid ${COLORS.warning}40` }}>
      {highlighted && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 8,
          background: `${COLORS.tealLight}20`, color: COLORS.tealLight, fontSize: 10,
          fontWeight: 700, padding: "3px 8px", borderRadius: 6, letterSpacing: 0.5
        }}>
          <Sparkles size={10} /> SUGGESTED FOR YOU
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, background: COLORS.bgCardAlt,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
        }}><Plus size={18} color={COLORS.warning} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>IV immune support</div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5 }}>
            When you have an early illness signal, some people use IV or oral hydration
            support (fluids, electrolytes, zinc, and vitamin C). Rest and hydration are the
            foundation.
          </div>
        </div>
      </div>

      <div style={{
        fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.5,
        background: COLORS.bgCardAlt, borderRadius: 10, padding: "10px 12px"
      }}>
        If you'd like IV therapy, look for a licensed clinic or mobile service and confirm it's
        appropriate for you with a licensed clinician first. We don't endorse or rank specific
        providers.
      </div>
    </Card>
  );
}

export { IVTherapyCard };
