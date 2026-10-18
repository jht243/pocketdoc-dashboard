import React, { useState } from "react";
import { Clock } from "lucide-react";
import { COLORS } from "../theme/tokens";

/**
 * Placeholder "Order" button for tests the member can't order in the app yet
 * (Oct 7 call: Adam wants the order buttons in place for the pharmacogenomic test and
 * the genetic panels before ordering is live).
 *
 * Tapping it only opens a short note saying ordering is coming. Nothing is charged,
 * nothing is sent, nothing is recorded, and the wording never suggests an order went
 * through: a member who believes a test is on its way would wait for a kit that never
 * ships.
 */
function OrderComingSoon({ testName, label = "Order", style }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={style}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          background: open ? COLORS.bgCardAlt : "none",
          border: `1px solid ${COLORS.tealLight}66`,
          color: COLORS.tealLight,
          borderRadius: 999,
          padding: "4px 12px",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        {label}
      </button>
      {open && (
        <div
          role="status"
          style={{
            marginTop: 8,
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            background: COLORS.bgCardAlt,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 10,
            padding: "9px 11px",
          }}
        >
          <Clock size={13} color={COLORS.textMuted} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, fontSize: 11.5, color: COLORS.textSecondary, lineHeight: 1.5 }}>
            Ordering is coming soon. We'll let you know when you can order{" "}
            {testName ? `a ${testName} test` : "this test"} here. Nothing has been ordered or charged.
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{ background: "none", border: "none", padding: 0, color: COLORS.textMuted, fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}

export { OrderComingSoon };
