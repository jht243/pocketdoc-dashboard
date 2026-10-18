import React, { useState, useEffect } from "react";
import { Activity, ChevronRight, ExternalLink, Sparkles } from "lucide-react";
import { Card } from "../components/Card";
import { IVTherapyCard } from "../components/IVTherapyCard";
import { SectionLabel } from "../components/SectionLabel";
import { StoreDisclosure } from "../components/StoreDisclosure";
import { COLORS, DISPLAY } from "../theme/tokens";
import { searchProducts } from "../lib/amazon";

// The store is kept apart from the member's health guidance (Adam Locker, Oct 19
// 2026): no slot here is chosen from their labs, and nothing the Advocate or an
// insight card says links here. A recommendation comes from the provider; buying
// is a separate step, with the commission disclosed above the products. Amazon
// PA-API supplies the real product for each slot (image, title, brand, price and
// an affiliate link); without it each card falls back to a plain Amazon search.
const SLOTS = [
  {
    id: "multi",
    keywords: "daily multivitamin third party tested",
    fallbackName: "Daily Multivitamin",
    why: "A daily foundation many people use to cover common gaps.",
  },
  {
    id: "omega3",
    keywords: "omega 3 fish oil epa dha",
    fallbackName: "Omega-3 Fish Oil",
    why: "Commonly used to support cardiovascular and joint health.",
  },
  {
    id: "magnesium",
    keywords: "magnesium glycinate",
    fallbackName: "Magnesium Glycinate",
    why: "Commonly used to support sleep and muscle recovery.",
  },
];

function amazonSearchUrl(keywords) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(keywords)}`;
}

function MarketScreen({ setActive, goBack, backLabel }) {
  const slots = SLOTS;
  // { [slotId]: { loading, product, error } }
  const [products, setProducts] = useState({});

  useEffect(() => {
    let cancelled = false;
    setProducts(Object.fromEntries(slots.map((s) => [s.id, { loading: true }])));

    slots.forEach(async (slot) => {
      const { items, error } = await searchProducts(slot.keywords, { itemCount: 1 });
      if (cancelled) return;
      setProducts((prev) => ({
        ...prev,
        [slot.id]: { loading: false, product: items?.[0] || null, error },
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [slots]);

  const SupplementCard = ({ slot }) => {
    const state = products[slot.id] || { loading: true };
    const product = state.product;
    const tierColor = COLORS.tealLight;
    const tierBg = COLORS.bgCard;
    const tierLabel = "GENERAL PRODUCT";

    const title = product?.title || slot.fallbackName;
    const buyUrl = product?.url || amazonSearchUrl(slot.keywords);

    return (
      <Card style={{
        border: `1px solid ${tierColor}50`,
        background: tierBg
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 10,
          background: `${tierColor}20`, color: tierColor, fontSize: 9,
          fontWeight: 700, padding: "3px 8px", borderRadius: 6, letterSpacing: 0.5
        }}>
          <Sparkles size={9} /> {tierLabel}
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {/* Product image (real, from Amazon) */}
          <div style={{
            width: 74, height: 74, borderRadius: 10, flexShrink: 0, overflow: "hidden",
            background: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            border: `1px solid ${COLORS.border}`
          }}>
            {state.loading ? (
              <div style={{ fontSize: 9, color: COLORS.textMuted }}>…</div>
            ) : product?.image ? (
              <img src={product.image} alt={title} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            ) : (
              <Activity size={20} color={COLORS.textMuted} />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>
                {state.loading ? "Finding the best option…" : title}
              </div>
              {product?.price && (
                <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.tealLight, flexShrink: 0 }}>{product.price}</span>
              )}
            </div>
            {product?.brand && (
              <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>{product.brand}</div>
            )}
            <div style={{ fontSize: 11, color: tierColor, marginTop: 6, lineHeight: 1.4 }}>{slot.why}</div>
          </div>
        </div>

        <a
          href={buyUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          style={{
            marginTop: 12, width: "100%", boxSizing: "border-box", background: COLORS.teal,
            color: COLORS.onAccent, textDecoration: "none", fontSize: 13, fontWeight: 700,
            padding: "10px", borderRadius: 8, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6
          }}
        >
          {product ? "View on Amazon" : "Search on Amazon"} <ExternalLink size={13} />
        </a>
      </Card>
    );
  };

  return (
    <div style={{ padding: "24px 18px", position: "relative" }}>
      <button onClick={goBack} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> {backLabel}
      </button>

      <div style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 4 }}>Marketplace</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 22 }}>
        Common staples, not personalized advice. Products and prices are live from
        Amazon. Local services open as they become available in your area.
      </div>

      <StoreDisclosure style={{ marginBottom: 18 }} />

      <SectionLabel>General products</SectionLabel>
      {slots.map((slot) => <SupplementCard key={slot.id} slot={slot} />)}

      <button onClick={() => setActive && setActive("browsesupplements")} style={{
        width: "100%", background: COLORS.bgCardAlt, border: `1px dashed ${COLORS.textMuted}60`,
        borderRadius: 14, padding: "14px", display: "flex", alignItems: "center",
        justifyContent: "center", gap: 8, color: COLORS.textSecondary, fontSize: 13, fontWeight: 600,
        cursor: "pointer", marginBottom: 18
      }}>
        Browse all supplements <ChevronRight size={14} />
      </button>

      <SectionLabel>Local services</SectionLabel>
      <IVTherapyCard />

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
    </div>
  );
}

export { MarketScreen };
