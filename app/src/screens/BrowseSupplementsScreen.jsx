import React, { useState } from "react";
import { AlertCircle, ChevronRight } from "lucide-react";
import { Card } from "../components/Card";
import { COLORS, SERIF } from "../theme/tokens";

// ---- BROWSE SUPPLEMENTS (general partner catalog) ----
function BrowseSupplementsScreen({ setActive }) {
  const [cart, setCart] = useState([]);
  const [filter, setFilter] = useState("all");

  const catalog = [
    { id: "ashwagandha", name: "Ashwagandha", brand: "Thorne", category: "Stress & recovery", price: "$26" },
    { id: "creatine", name: "Creatine Monohydrate", brand: "Thorne", category: "Performance", price: "$30" },
    { id: "probiotic", name: "Daily Probiotic", brand: "PurePharmaceuticals", category: "Gut health", price: "$34" },
    { id: "zincc", name: "Zinc + Vitamin C", brand: "PurePharmaceuticals", category: "Immune support", price: "$19" },
    { id: "collagen", name: "Collagen Peptides", brand: "Thorne", category: "Recovery", price: "$38" },
    { id: "b complex", name: "B-Complex", brand: "PurePharmaceuticals", category: "Energy", price: "$21" },
  ];
  const brands = ["all", "Thorne", "PurePharmaceuticals"];
  const visible = filter === "all" ? catalog : catalog.filter(c => c.brand === filter);

  const toggleCart = (id) => setCart(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);
  const cartTotal = cart.reduce((sum, id) => {
    const p = catalog.find(p => p.id === id);
    return sum + (p ? parseInt(p.price.replace("$", "")) : 0);
  }, 0);

  return (
    <div style={{ padding: "24px 18px", paddingBottom: cart.length ? 100 : 24, position: "relative" }}>
      <button onClick={() => setActive("market")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Marketplace
      </button>

      <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 4 }}>Supplement partners</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 18 }}>
        Browse the full catalog from our connected supplement partners.
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {brands.map(b => (
          <button key={b} onClick={() => setFilter(b)} style={{
            padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
            background: filter === b ? COLORS.teal : COLORS.bgCardAlt,
            color: filter === b ? COLORS.onAccent : COLORS.textSecondary, border: "none"
          }}>{b === "all" ? "All brands" : b}</button>
        ))}
      </div>

      <Card>
        {visible.map((p, i) => {
          const inCart = cart.includes(p.id);
          return (
            <div key={p.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "11px 0", borderBottom: i < visible.length - 1 ? `1px solid ${COLORS.border}` : "none"
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{p.brand} &middot; {p.category}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: COLORS.tealLight, fontWeight: 600 }}>{p.price}</span>
                <button onClick={() => toggleCart(p.id)} style={{
                  background: inCart ? COLORS.bgCardAlt : COLORS.teal,
                  border: inCart ? `1px solid ${COLORS.tealLight}` : "none",
                  color: inCart ? COLORS.tealLight : COLORS.onAccent,
                  fontSize: 11, fontWeight: 700, padding: "6px 10px", borderRadius: 7, cursor: "pointer"
                }}>{inCart ? "Added" : "Add"}</button>
              </div>
            </div>
          );
        })}
      </Card>

      {cart.length > 0 && (
        <>
          <div style={{
            marginTop: 14, padding: 12, background: COLORS.warnDim, border: `1px solid ${COLORS.warning}50`,
            borderRadius: 10, display: "flex", gap: 8, alignItems: "flex-start"
          }}>
            <AlertCircle size={14} color={COLORS.warning} style={{ marginTop: 1, flexShrink: 0 }} />
            <div style={{ fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.5 }}>
              <span style={{ color: COLORS.warning, fontWeight: 600 }}>Before you order: </span>
              supplements can interact with prescription medications and current therapies.
              This isn't a substitute for review by your prescribing physician or pharmacist.
            </div>
          </div>
          <div style={{
            position: "sticky", bottom: 0, left: 0, right: 0, marginTop: 14,
            background: COLORS.bgCard, borderTop: `1px solid ${COLORS.border}`,
            padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center",
            marginLeft: -18, marginRight: -18, marginBottom: -24
          }}>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{cart.length} item{cart.length > 1 ? "s" : ""}</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>${cartTotal}</div>
            </div>
            <button style={{
              background: COLORS.teal, border: "none", color: COLORS.onAccent,
              fontSize: 13, fontWeight: 700, padding: "12px 22px", borderRadius: 10, cursor: "pointer"
            }}>
              Checkout
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export { BrowseSupplementsScreen };
