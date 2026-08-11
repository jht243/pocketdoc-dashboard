import React, { useState, useEffect } from "react";
import { AlertCircle, ChevronRight, ExternalLink } from "lucide-react";
import { Card } from "../components/Card";
import { COLORS, SERIF } from "../theme/tokens";
import { searchProducts } from "../lib/amazon";

// ---- BROWSE SUPPLEMENTS (live Amazon catalog by category) ----
// Each category chip is an Amazon keyword search. Products, images, prices, and
// affiliate links are live from the Creators API via the ghai-amazon proxy.

const CATEGORIES = [
  { label: "Popular", keywords: "best selling supplements" },
  { label: "Stress & recovery", keywords: "ashwagandha supplement" },
  { label: "Performance", keywords: "creatine monohydrate" },
  { label: "Gut health", keywords: "daily probiotic supplement" },
  { label: "Immune", keywords: "zinc vitamin c supplement" },
  { label: "Recovery", keywords: "collagen peptides" },
  { label: "Energy", keywords: "b complex vitamin" },
];

function amazonSearchUrl(keywords) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(keywords)}`;
}

function BrowseSupplementsScreen({ setActive }) {
  const [activeCat, setActiveCat] = useState(CATEGORIES[0]);
  const [state, setState] = useState({ loading: true, items: [], error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, items: [], error: null });

    (async () => {
      const { items, error } = await searchProducts(activeCat.keywords, { itemCount: 8 });
      if (cancelled) return;
      setState({ loading: false, items: items || [], error });
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCat]);

  return (
    <div style={{ padding: "24px 18px" }}>
      <button onClick={() => setActive("market")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Marketplace
      </button>

      <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 4 }}>Browse supplements</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 18 }}>
        Live from Amazon. Prices and availability update in real time.
      </div>

      {/* Category chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18, overflowX: "auto", paddingBottom: 4 }}>
        {CATEGORIES.map((c) => (
          <button key={c.label} onClick={() => setActiveCat(c)} style={{
            padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
            whiteSpace: "nowrap", flexShrink: 0,
            background: activeCat.label === c.label ? COLORS.teal : COLORS.bgCardAlt,
            color: activeCat.label === c.label ? COLORS.onAccent : COLORS.textSecondary, border: "none"
          }}>{c.label}</button>
        ))}
      </div>

      {state.loading ? (
        <Card><div style={{ fontSize: 13, color: COLORS.textMuted, textAlign: "center", padding: "18px 0" }}>
          Loading {activeCat.label.toLowerCase()} products…
        </div></Card>
      ) : state.items.length === 0 ? (
        <Card>
          <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5, textAlign: "center", padding: "8px 0" }}>
            Couldn't load live products right now.
            <br />
            <a href={amazonSearchUrl(activeCat.keywords)} target="_blank" rel="noopener noreferrer sponsored"
              style={{ color: COLORS.tealLight, fontWeight: 600 }}>
              Search "{activeCat.keywords}" on Amazon →
            </a>
          </div>
        </Card>
      ) : (
        <Card>
          {state.items.map((p, i) => (
            <div key={p.asin || i} style={{
              display: "flex", gap: 12, alignItems: "center",
              padding: "11px 0", borderBottom: i < state.items.length - 1 ? `1px solid ${COLORS.border}` : "none"
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 8, flexShrink: 0, overflow: "hidden",
                background: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                border: `1px solid ${COLORS.border}`
              }}>
                {p.image
                  ? <img src={p.image} alt={p.title} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                  : <span style={{ fontSize: 9, color: COLORS.textMuted }}>—</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3,
                  overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
                  WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.title || "Product"}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                  {[p.brand, p.price].filter(Boolean).join(" · ")}
                </div>
              </div>
              <a href={p.url || amazonSearchUrl(activeCat.keywords)} target="_blank" rel="noopener noreferrer sponsored"
                style={{
                  background: COLORS.teal, color: COLORS.onAccent, textDecoration: "none",
                  fontSize: 11, fontWeight: 700, padding: "7px 10px", borderRadius: 7,
                  display: "flex", alignItems: "center", gap: 4, flexShrink: 0
                }}>
                View <ExternalLink size={11} />
              </a>
            </div>
          ))}
        </Card>
      )}

      <div style={{
        marginTop: 16, padding: 12, background: COLORS.warnDim, border: `1px solid ${COLORS.warning}50`,
        borderRadius: 10, display: "flex", gap: 8, alignItems: "flex-start"
      }}>
        <AlertCircle size={14} color={COLORS.warning} style={{ marginTop: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.5 }}>
          <span style={{ color: COLORS.warning, fontWeight: 600 }}>Before you order: </span>
          supplements can interact with prescription medications and current therapies. This
          isn't a substitute for review by your prescribing physician or pharmacist. As an
          Amazon Associate, purchases through these links may earn the app a commission.
        </div>
      </div>
    </div>
  );
}

export { BrowseSupplementsScreen };
