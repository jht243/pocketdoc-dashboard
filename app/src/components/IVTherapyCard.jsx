import React, { useState, useEffect } from "react";
import { Plus, Search, Sparkles, Star } from "lucide-react";
import { COLORS } from "../theme/tokens";
import { Card } from "./Card";

// ---- MARKET SCREEN (positioning only, no transactions yet) ----
function IVTherapyCard({ highlighted }) {
  const [mode, setMode] = useState("inhome"); // inhome | inoffice
  const [searching, setSearching] = useState(true);

  // Simulated AI local search results, ranked by rating/reviews like a Google Maps style search.
  // In production this would query local providers in real time.
  useEffect(() => {
    setSearching(true);
    const t = setTimeout(() => setSearching(false), 900);
    return () => clearTimeout(t);
  }, [mode]);

  const results = {
    inhome: [
      { name: "Revive IV Mobile Wellness", rating: 4.9, reviews: 312, price: "$179", note: "Same-day, arrives in ~45 min" },
      { name: "DripDoc Concierge", rating: 4.7, reviews: 188, price: "$199", note: "Next available: today, 6:00 PM" },
    ],
    inoffice: [
      { name: "Vitality IV Lounge", rating: 4.8, reviews: 540, price: "$129", note: "2.3 mi away" },
      { name: "Pure Drip Bar", rating: 4.6, reviews: 276, price: "$149", note: "3.1 mi away" },
      { name: "Restore IV & Wellness", rating: 4.6, reviews: 201, price: "$135", note: "4.4 mi away" },
    ],
  };

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
          <div style={{ fontSize: 12, color: COLORS.textSecondary }}>
            Glutathione, zinc, vitamin C, and electrolytes, suggested based on this morning's
            early illness signal from your Oura ring.
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button onClick={() => setMode("inhome")} style={{
          flex: 1, padding: "8px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
          background: mode === "inhome" ? COLORS.teal : COLORS.bgCardAlt,
          color: mode === "inhome" ? COLORS.onAccent : COLORS.textSecondary,
          border: "none"
        }}>In-home / in-office visit</button>
        <button onClick={() => setMode("inoffice")} style={{
          flex: 1, padding: "8px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
          background: mode === "inoffice" ? COLORS.teal : COLORS.bgCardAlt,
          color: mode === "inoffice" ? COLORS.onAccent : COLORS.textSecondary,
          border: "none"
        }}>Go to a location</button>
      </div>

      {searching ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "14px 0",
          color: COLORS.textSecondary, fontSize: 12
        }}>
          <Search size={14} />
          Searching providers near you, ranked by rating and reviews...
        </div>
      ) : (
        <div>
          {results[mode].map((r, i) => (
            <div key={r.name} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 0", borderBottom: i < results[mode].length - 1 ? `1px solid ${COLORS.border}` : "none"
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <Star size={11} color={COLORS.gold} fill={COLORS.gold} />
                  <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{r.rating} ({r.reviews})</span>
                  <span style={{ fontSize: 11, color: COLORS.textMuted }}>&middot; {r.note}</span>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.tealLight }}>{r.price}</div>
                <button style={{
                  marginTop: 4, background: "none", border: `1px solid ${COLORS.border}`,
                  color: COLORS.textSecondary, fontSize: 10, padding: "3px 8px", borderRadius: 6, cursor: "pointer"
                }}>View</button>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 10, lineHeight: 1.5 }}>
            Ranked using public ratings and reviews. Booking opens once a paid partner is
            available in your area; for now, contact providers directly.
          </div>
        </div>
      )}
    </Card>
  );
}

export { IVTherapyCard };
