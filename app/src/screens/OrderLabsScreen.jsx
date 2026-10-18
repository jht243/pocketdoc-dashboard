import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card } from "../components/Card";
import { SectionLabel } from "../components/SectionLabel";
import { COLORS, DISPLAY } from "../theme/tokens";
import { memberTherapies } from "../lib/therapies";

// ---- ORDER LABS SCREEN (Tasso at-home collection) ----
function OrderLabsScreen({ setActive, goBack, backLabel, userProfile, healthData }) {
  const [cart, setCart] = useState([]);
  const [showSoon, setShowSoon] = useState(false);

  // Each therapy panel is offered only to a member whose own record shows that
  // therapy (intake answers or medication list). Nobody else sees the section.
  const therapies = memberTherapies({ userProfile, healthData });

  // The standard founding-member order from the Oct 14 spec, listed first because it
  // is the only panel here that can produce a biological age: PhenoAge needs albumin,
  // creatinine, glucose and alkaline phosphatase (CMP), lymphocyte %, MCV, RDW and
  // WBC (CBC with differential) and hs-CRP, and none of the panels below carries the
  // CBC or the full CMP. No price yet, so none is shown rather than one we made up.
  const baseline = {
    id: "baseline",
    name: "Thumbprint baseline panel",
    why: "The panel that unlocks your biological age and your full scorecard",
    markers: "CBC with differential, comprehensive metabolic panel, hs-CRP, lipid panel and ApoB, HbA1c and fasting insulin, vitamin D, ferritin, B12, TSH and free T4",
    note: "Draw it fasting: water only for 8–12 hours beforehand, so glucose, insulin and lipids read true.",
    price: null,
  };
  const recommended = [
    {
      id: "trt",
      therapy: "trt",
      name: "TRT monitoring panel",
      why: "Recommended monthly while on testosterone therapy",
      markers: "Total testosterone, free testosterone, SHBG, estradiol, hematocrit, PSA",
      price: "$89",
      turnaround: "2–3 days",
    },
    {
      id: "peptide",
      therapy: "peptides",
      name: "Peptide therapy panel",
      why: "Recommended every 8–12 weeks while cycling peptides",
      markers: "IGF-1, fasting glucose, ALT, AST, creatinine, eGFR",
      price: "$79",
      turnaround: "2–3 days",
    },
  ].filter((p) => therapies[p.therapy]);

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

  const allPanels = [baseline, ...recommended, ...browseAll];
  const cartPanels = cart.map((id) => allPanels.find((p) => p.id === id)).filter(Boolean);
  // Only panels with a real price add to the total; an unpriced one is named instead
  // of being counted as $0, which would understate what the order costs.
  const cartTotal = cartPanels.reduce((sum, p) => sum + (p.price ? parseInt(p.price.replace("$", ""), 10) : 0), 0);
  const cartHasUnpriced = cartPanels.some((p) => !p.price);

  const PanelCard = ({ p, highlight }) => {
    const inCart = cart.includes(p.id);
    return (
      <Card style={highlight ? { border: `1px solid ${COLORS.accent}50`, background: COLORS.accentDim } : {}}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
          {p.price
            ? <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.tealLight }}>{p.price}</span>
            : <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, flexShrink: 0, marginLeft: 10 }}>Price coming soon</span>}
        </div>
        {p.why && (
          <div style={{ fontSize: 11, color: COLORS.accent, marginBottom: 6 }}>{p.why}</div>
        )}
        <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: p.note ? 6 : 10 }}>
          {p.markers}
        </div>
        {p.note && (
          <div style={{ fontSize: 11.5, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 10 }}>{p.note}</div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>{p.turnaround ? `Results in ${p.turnaround}` : ""}</span>
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
      <button onClick={goBack} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> {backLabel}
      </button>

      <div style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 4 }}>Order bloodwork</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 }}>
        Collected at home with a Tasso device, no needle, no clinic visit.
      </div>
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 22 }}>
        A kit ships to you, you collect a small sample from your upper arm, and mail it back
        with the included prepaid label. Once your results arrive, upload the PDF (or a
        photo of it) under Records and it files itself into your Labs.
      </div>

      <SectionLabel>Start here</SectionLabel>
      <PanelCard p={baseline} highlight />

      {recommended.length > 0 && (
        <>
          <SectionLabel>Recommended for your therapies</SectionLabel>
          {recommended.map(p => <PanelCard key={p.id} p={p} highlight />)}
        </>
      )}

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
          padding: "14px 18px", marginLeft: -18, marginRight: -18, marginBottom: -24
        }}>
          {/* Kit ordering isn't live. The button used to do nothing at all, which reads
              as broken, or worse, as an order that went through silently. */}
          {showSoon && (
            <div role="status" style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 10 }}>
              Ordering is coming soon. We'll let you know when you can order these panels here.
              Nothing has been ordered or charged.
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{cart.length} panel{cart.length > 1 ? "s" : ""} selected</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {cartTotal > 0 ? `$${cartTotal}` : "Price coming soon"}
              </div>
              {cartHasUnpriced && cartTotal > 0 && (
                <div style={{ fontSize: 10.5, color: COLORS.textMuted }}>plus the baseline panel, price coming soon</div>
              )}
            </div>
            <button onClick={() => setShowSoon(true)} style={{
              background: COLORS.teal, border: "none", color: COLORS.onAccent,
              fontSize: 13, fontWeight: 700, padding: "12px 22px", borderRadius: 10, cursor: "pointer"
            }}>
              Ship my kit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { OrderLabsScreen };
