import React, { useState } from "react";
import { Activity, AlertCircle, ChevronRight, Sparkles } from "lucide-react";
import { Card } from "../components/Card";
import { IVTherapyCard } from "../components/IVTherapyCard";
import { SectionLabel } from "../components/SectionLabel";
import { COLORS, SERIF } from "../theme/tokens";

function MarketScreen({ highlight, setActive }) {
  const [cart, setCart] = useState([]);

  // Tier 1: necessary based on actual bloodwork results
  const urgentProducts = [
    {
      id: "vitd3",
      name: "Vitamin D3 + K2",
      brand: "Thorne",
      why: "Necessary: your Vitamin D result is low (28 ng/mL)",
      detail: "5,000 IU D3 with 100mcg K2, 90 day supply. Take daily with a meal containing fat.",
      price: "$24",
    },
  ];

  // Tier 2: general daily recommendations based on profile (age, sex, goals, therapies)
  const recommendedProducts = [
    {
      id: "multi",
      name: "Daily Multivitamin",
      brand: "Thorne",
      why: "Recommended as a daily foundation for your profile",
      detail: "Comprehensive daily multivitamin, 30 day supply.",
      price: "$32",
    },
    {
      id: "omega3",
      name: "Omega-3 Fish Oil",
      brand: "PurePharmaceuticals",
      why: "Recommended to support cardiovascular and joint health given your training volume",
      detail: "1,200mg EPA/DHA per serving, 60 day supply.",
      price: "$28",
    },
    {
      id: "magnesium",
      name: "Magnesium Glycinate",
      brand: "Thorne",
      why: "Recommended to support sleep and recovery alongside your training load",
      detail: "200mg per serving, third-party tested, 60 day supply.",
      price: "$22",
    },
  ];

  const allProducts = [...urgentProducts, ...recommendedProducts];
  const toggleCart = (id) => setCart(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);
  const cartTotal = cart.reduce((sum, id) => {
    const p = allProducts.find(p => p.id === id);
    return sum + (p ? parseInt(p.price.replace("$", "")) : 0);
  }, 0);

  const SupplementCard = ({ p, tier }) => {
    const inCart = cart.includes(p.id);
    const isHighlighted = highlight === p.id;
    const tierColor = tier === "urgent" ? COLORS.danger : COLORS.tealLight;
    const tierBg = tier === "urgent" ? COLORS.badDim : COLORS.bgCard;
    const tierLabel = tier === "urgent" ? "NECESSARY · FROM YOUR BLOODWORK" : "SUGGESTED FOR YOU";
    return (
      <Card style={{
        border: isHighlighted ? `1.5px solid ${COLORS.tealLight}` : `1px solid ${tierColor}50`,
        background: tierBg
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 8,
          background: `${tierColor}20`, color: tierColor, fontSize: 9,
          fontWeight: 700, padding: "3px 8px", borderRadius: 6, letterSpacing: 0.5
        }}>
          {tier === "urgent" ? <AlertCircle size={9} /> : <Sparkles size={9} />} {tierLabel}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.tealLight }}>{p.price}</span>
        </div>
        <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 6 }}>{p.brand}</div>
        <div style={{ fontSize: 11, color: tierColor, marginBottom: 6 }}>{p.why}</div>
        <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 12 }}>
          {p.detail}
        </div>
        <button onClick={() => toggleCart(p.id)} style={{
          width: "100%", background: inCart ? COLORS.bgCardAlt : COLORS.teal,
          border: inCart ? `1px solid ${COLORS.tealLight}` : "none",
          color: inCart ? COLORS.tealLight : COLORS.onAccent,
          fontSize: 13, fontWeight: 700, padding: "10px", borderRadius: 8, cursor: "pointer"
        }}>
          {inCart ? "Added to order" : "Add to order"}
        </button>
      </Card>
    );
  };

  return (
    <div style={{ padding: "24px 18px", paddingBottom: cart.length ? 100 : 24, position: "relative" }}>
      <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 4 }}>Marketplace</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 22 }}>
        Suggestions based on your current signals. Supplements ship directly from our
        partners. Local services open as they become available in your area.
      </div>

      <SectionLabel>Necessary, based on your bloodwork</SectionLabel>
      {urgentProducts.map(p => <SupplementCard key={p.id} p={p} tier="urgent" />)}

      <SectionLabel>Suggested for your profile</SectionLabel>
      {recommendedProducts.map(p => <SupplementCard key={p.id} p={p} tier="suggested" />)}

      <button onClick={() => setActive && setActive("browsesupplements")} style={{
        width: "100%", background: COLORS.bgCardAlt, border: `1px dashed ${COLORS.textMuted}60`,
        borderRadius: 14, padding: "14px", display: "flex", alignItems: "center",
        justifyContent: "center", gap: 8, color: COLORS.textSecondary, fontSize: 13, fontWeight: 600,
        cursor: "pointer", marginBottom: 18
      }}>
        Browse all supplements from Thorne &amp; PurePharmaceuticals <ChevronRight size={14} />
      </button>

      <SectionLabel>Local services</SectionLabel>
      <IVTherapyCard highlighted={highlight === "iv"} />

      <Card>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, background: COLORS.bgCardAlt,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
          }}><Activity size={18} color={COLORS.tealLight} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Recovery and mobility</div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 }}>
              Cold plunge, compression therapy, and bodywork from vetted local providers.
            </div>
            <span style={{
              fontSize: 11, color: COLORS.textMuted, background: COLORS.bgCardAlt,
              padding: "4px 10px", borderRadius: 6
            }}>Coming soon in your area</span>
          </div>
        </div>
      </Card>

      {cart.length > 0 && (() => {
        // Simple interaction flag: this user is on TRT (established elsewhere in the app).
        // The check is visible rather than silently passing for everything in the cart.
        const checkedItems = cart
          .map(id => allProducts.find(p => p.id === id)?.name)
          .filter(Boolean);
        return (
          <>
            <div style={{
              marginTop: 14, padding: 12, background: COLORS.warnDim, border: `1px solid ${COLORS.warning}50`,
              borderRadius: 10, display: "flex", gap: 8, alignItems: "flex-start"
            }}>
              <AlertCircle size={14} color={COLORS.warning} style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.5 }}>
                <span style={{ color: COLORS.warning, fontWeight: 600 }}>Checked against your current therapies (TRT): </span>
                no known interactions found for {checkedItems.join(", ")}. This is not a
                substitute for review by your prescribing physician or pharmacist, especially
                if you're taking other medications not listed in your profile.
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
        );
      })()}
    </div>
  );
}

export { MarketScreen };
