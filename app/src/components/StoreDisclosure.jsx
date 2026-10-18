import React from "react";
import { AlertCircle } from "lucide-react";
import { COLORS } from "../theme/tokens";

// The store's disclosure, shown above anything for sale. Adam Locker, Oct 19 2026:
// the clinical recommendation and the sale are two visibly separate moments, with
// the financial interest disclosed where the purchase happens. Nothing in the app's
// health answers or insight cards links here. Wording pending medical-director
// sign-off.
export const STORE_DISCLOSURE =
  "Thumbprint earns a commission on purchases made through these links (as an Amazon Associate), so we have a financial interest in what you buy here. Nothing in the store is a recommendation based on your record. If your provider suggests a supplement, an equivalent product from any pharmacy or store works the same. Check anything new against your medications and therapies with your provider or pharmacist first.";

export function StoreDisclosure({ style }) {
  return (
    <div style={{
      padding: 12, background: COLORS.warnDim, border: `1px solid ${COLORS.warning}50`,
      borderRadius: 10, display: "flex", gap: 8, alignItems: "flex-start", ...style,
    }}>
      <AlertCircle size={14} color={COLORS.warning} style={{ marginTop: 1, flexShrink: 0 }} />
      <div style={{ fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.5 }}>
        <span style={{ color: COLORS.warning, fontWeight: 600 }}>How the store works: </span>
        {STORE_DISCLOSURE}
      </div>
    </div>
  );
}
