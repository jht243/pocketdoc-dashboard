import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card } from "../components/Card";
import { SectionLabel } from "../components/SectionLabel";
import { COLORS, SERIF } from "../theme/tokens";

// ---- ORDER LABS SCREEN (Tasso at-home collection) ----
function OrderLabsScreen({ setActive }) {
  const [cart, setCart] = useState([]);

  const recommended = [
    {
      id: "trt",
      name: "TRT monitoring panel",
      why: "Recommended monthly while on testosterone therapy",
      markers: "Total testosterone, free testosterone, SHBG, estradiol, hematocrit, PSA",
      price: "$89",
      turnaround: "2–3 days",
    },
    {
      id: "peptide",
      name: "Peptide therapy panel",
      why: "Recommended every 8–12 weeks while cycling peptides",
      markers: "IGF-1, fasting glucose, ALT, AST, creatinine, eGFR",
      price: "$79",
      turnaround: "2–3 days",
    },
  ];

  const browseAll = [
    {
      id: "hormone",
      name: "Hormone panel",
      markers: "Total & free testosterone, DHEA-S, FSH, LH, progesterone, SHBG, TSH",
      price: "$95",
      turnaround: "2–3 days",
    },
    {
      id: "liverkidney",
      name: "Liver & kidney function",
      markers: "ALT, AST, total bilirubin, albumin, creatinine, eGFR, cystatin C",
      price: "$69",
      turnaround: "2–3 days",
    },
    {
      id: "metabolic",
      name: "Metabolic panel",
      markers: "Glucose, HbA1c, cholesterol, HDL, LDL, triglycerides, ApoB, Lp(a)",
      price: "$85",
      turnaround: "2–3 days",
    },
    {
      id: "inflammation",
      name: "Inflammation & cardiovascular",
      markers: "hsCRP, ApoB, Lp(a), cholesterol panel",
      price: "$75",
      turnaround: "2–3 days",
    },
    {
      id: "thyroid",
      name: "Thyroid antibody panel",
      markers: "TSH, TPO antibodies, thyroglobulin antibodies",
      price: "$99",
      turnaround: "3–4 days",
    },
  ];

  const toggleCart = (id) => {
    setCart(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);
  };

  const allPanels = [...recommended, ...browseAll];
  const cartTotal = cart.reduce((sum, id) => {
    const p = allPanels.find(p => p.id === id);
    return sum + (p ? parseInt(p.price.replace("$", "")) : 0);
  }, 0);

  const PanelCard = ({ p, highlight }) => {
    const inCart = cart.includes(p.id);
    return (
      <Card style={highlight ? { border: `1px solid ${COLORS.gold}50`, background: COLORS.warnDim } : {}}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.tealLight }}>{p.price}</span>
        </div>
        {p.why && (
          <div style={{ fontSize: 11, color: COLORS.gold, marginBottom: 6 }}>{p.why}</div>
        )}
        <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 10 }}>
          {p.markers}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>Results in {p.turnaround}</span>
          <button onClick={() => toggleCart(p.id)} style={{
            background: inCart ? COLORS.bgCardAlt : COLORS.teal,
            border: inCart ? `1px solid ${COLORS.tealLight}` : "none",
            color: inCart ? COLORS.tealLight : COLORS.onAccent,
            fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 8, cursor: "pointer"
          }}>
            {inCart ? "Added" : "Add to order"}
          </button>
        </div>
      </Card>
    );
  };

  return (
    <div style={{ padding: "24px 18px", paddingBottom: cart.length ? 100 : 24 }}>
      <button onClick={() => setActive("labs")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Labs
      </button>

      <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 4 }}>Order bloodwork</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 }}>
        Collected at home with a Tasso device, no needle, no clinic visit.
      </div>
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 22 }}>
        A kit ships to you, you collect a small sample from your upper arm, and mail it back
        with the included prepaid label. Results sync automatically to your Labs and feed
        your pattern review.
      </div>

      <SectionLabel>Recommended for your therapies</SectionLabel>
      {recommended.map(p => <PanelCard key={p.id} p={p} highlight />)}

      <SectionLabel>Browse all panels</SectionLabel>
      {browseAll.map(p => <PanelCard key={p.id} p={p} />)}

      <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 8, lineHeight: 1.5 }}>
        Panel availability and exact markers may vary slightly based on current Tasso lab
        partner offerings. Some markers may require a traditional venous draw if not
        compatible with capillary collection.
      </div>

      {cart.length > 0 && (
        <div style={{
          position: "sticky", bottom: 0, left: 0, right: 0, marginTop: 18,
          background: COLORS.bgCard, borderTop: `1px solid ${COLORS.border}`,
          padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center",
          marginLeft: -18, marginRight: -18, marginBottom: -24
        }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{cart.length} panel{cart.length > 1 ? "s" : ""} selected</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>${cartTotal}</div>
          </div>
          <button style={{
            background: COLORS.teal, border: "none", color: COLORS.onAccent,
            fontSize: 13, fontWeight: 700, padding: "12px 22px", borderRadius: 10, cursor: "pointer"
          }}>
            Ship my kit
          </button>
        </div>
      )}
    </div>
  );
}

export { OrderLabsScreen };
