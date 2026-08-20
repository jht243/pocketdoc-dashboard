import React, { useState } from "react";
import { ChevronRight, Dna, Sparkles } from "lucide-react";
import { Card } from "../components/Card";
import { LockedDataSection } from "../components/LockedDataSection";
import { COLORS, SERIF } from "../theme/tokens";

// ---- HOME SCREEN ----
// ---- PROFILE SCREEN ----
// ---- GENETIC PROFILE SCREEN ----
// Shows known genetic markers split into two distinct sections:
// 1. Supplement & lifestyle markers (lower stakes, actionable at user level)
// 2. Pharmacogenomic markers (medication metabolism, higher stakes, physician-discussion framing)
// Each marker shows what it means for this specific user, not a generic description.
function GeneticProfileScreen({ setActive, healthData }) {
  const [activeSection, setActiveSection] = useState("lifestyle"); // lifestyle | pharma

  // Real imported genomes are rich objects (from ghai.genetic_markers). Test mode
  // instead puts a handful of plain strings on `healthData.genetics` and expects the
  // illustrative demo set below to stand in for a real import. So: if we have any
  // object-shaped markers, those are the user's real data and win; a string-only
  // array means test mode, where the demo set is the intended display.
  const importedMarkers = (healthData?.genetics || []).filter((g) => g && typeof g === "object" && g.gene);
  const isDemo = !importedMarkers.length && Boolean(healthData?.genetics?.length);
  const hasGenetics = importedMarkers.length > 0 || isDemo;

  // Supplement & lifestyle markers — illustrative demo set, shown only in test mode.
  // Real users see their own imported genomes rendered from `importedMarkers` instead.
  const demoLifestyleMarkers = [
    {
      gene: "MTHFR",
      variant: "C677T heterozygous",
      status: "variant",
      impact: "Moderate",
      title: "Folate processing — reduced efficiency",
      what: "Your MTHFR enzyme runs at roughly 65% efficiency, reducing your ability to convert folic acid into its active form (methylfolate). This affects B vitamin metabolism, homocysteine regulation, and methylation broadly.",
      forYou: [
        "Take methylfolate (L-5-MTHF) rather than folic acid — standard folic acid may not convert properly for you.",
        "Methylcobalamin (active B12) is preferable to cyanocobalamin for the same reason.",
        "Your homocysteine should be checked annually — elevated homocysteine is a cardiovascular risk factor your standard panel may not include.",
        "When you see TikTok content recommending B-complex supplements, the form matters for you specifically. Most cheap B-complexes use folic acid, not methylfolate.",
      ],
      aiContext: "MTHFR C677T heterozygous: supplement recommendations should specify methylated B vitamins. Flag any folic acid recommendations as potentially suboptimal.",
    },
    {
      gene: "VDR",
      variant: "Taq1 TT",
      status: "variant",
      impact: "Moderate",
      title: "Vitamin D receptor — reduced absorption efficiency",
      what: "Your vitamin D receptor variant reduces how efficiently your cells respond to vitamin D, meaning you may need higher serum levels than standard reference ranges to achieve the same cellular effect.",
      forYou: [
        "Your current level of 28 ng/mL is low for anyone, but especially so given this variant. Target serum level is likely 50-70 ng/mL for you rather than the standard 30-50 ng/mL floor.",
        "Vitamin D3 with K2 (already ordered) is the right form. Consider a higher dose than standard — worth discussing with your physician.",
        "Magnesium is required to activate vitamin D — deficiency in one limits the other.",
        "Retest in 8-10 weeks after supplementing, not the standard 12 weeks, given absorption efficiency.",
      ],
      aiContext: "VDR Taq1 TT: Vitamin D needs are elevated above standard reference ranges. Current level of 28 ng/mL is more concerning than it would be for a standard genotype.",
    },
    {
      gene: "COMT",
      variant: "Val158Met heterozygous",
      status: "variant",
      impact: "Moderate",
      title: "Dopamine & estrogen metabolism — slower breakdown",
      what: "COMT breaks down dopamine, adrenaline, and estrogens. Your variant reduces this enzyme's activity somewhat, meaning these compounds clear more slowly. This affects stress response, mood regulation, and estrogen balance.",
      forYou: [
        "You may be more sensitive to high-stress periods and slower to return to baseline after them — relevant to your CrossFit competition load.",
        "Caffeine timing matters more for you: late-day caffeine will affect sleep more than it would a fast COMT metabolizer.",
        "Magnesium and B6 support COMT function and are particularly relevant given this variant.",
        "When you see content about 'estrogen detox' supplements — DIM, calcium d-glucarate — there is a legitimate basis for this given your COMT status, worth discussing rather than dismissing.",
      ],
      aiContext: "COMT Val158Met heterozygous: slower dopamine and estrogen clearance. Relevant to stress recovery, caffeine sensitivity, and estrogen metabolism recommendations.",
    },
    {
      gene: "ACTN3",
      variant: "RR genotype",
      status: "favorable",
      impact: "Informative",
      title: "Muscle fiber composition — power-oriented",
      what: "ACTN3 R577X determines whether you produce alpha-actinin-3, a protein found only in fast-twitch muscle fibers. Your RR genotype means you produce it fully, strongly associated with power and sprint performance.",
      forYou: [
        "Your genetics support the power/strength profile consistent with competitive CrossFit — this isn't just training, it's partly your biology.",
        "Zone 2 cardio will still improve your aerobic base and is important for longevity, but your natural adaptation leans toward high-intensity work.",
        "Recovery from high-intensity sessions may require more deliberate attention than it would for a slower-twitch dominant athlete.",
        "Creatine monohydrate has stronger evidence for RR genotypes than for XX genotypes — worth including in your supplement stack.",
      ],
      aiContext: "ACTN3 RR: power-oriented muscle fiber genetics. Creatine has stronger evidence base. High-intensity training is naturally well-suited.",
    },
    {
      gene: "FUT2",
      variant: "Non-secretor (AA)",
      status: "variant",
      impact: "Moderate",
      title: "Gut microbiome & probiotic response",
      what: "FUT2 secretor status determines which carbohydrate structures you express on your gut lining, directly affecting which bacteria can colonize there. Non-secretors like you have a different microbiome composition and respond differently to probiotic strains.",
      forYou: [
        "Lactobacillus and many Bifidobacterium strains have weaker evidence for non-secretors. Standard probiotic products marketed broadly may give you little benefit.",
        "Saccharomyces boulardii is effective regardless of secretor status and is a better starting point.",
        "Non-secretors have elevated susceptibility to certain gut infections (H. pylori, norovirus) — relevant to your health record.",
        "Prebiotic fiber (specifically pectin and resistant starch) is more reliably beneficial for you than probiotic supplements.",
      ],
      aiContext: "FUT2 non-secretor: standard probiotic recommendations are less applicable. Saccharomyces boulardii and prebiotic fiber are better starting points.",
    },
    {
      gene: "HLA-DQ",
      variant: "DQ2.5 heterozygous",
      status: "watch",
      impact: "Watch",
      title: "Autoimmune & gluten sensitivity risk",
      what: "HLA-DQ2.5 is present in over 95% of people with celiac disease, though most DQ2.5 carriers never develop celiac. It also confers elevated risk for certain other autoimmune conditions. Given your rising TPO antibodies, this is worth tracking.",
      forYou: [
        "You don't necessarily have celiac disease, but you carry the genetic prerequisite. Given your TPO antibody trend, an anti-gliadin antibody test and anti-tTG antibody test at your next panel would be informative.",
        "If your TPO antibodies continue rising, a gluten-free trial for 8-12 weeks has evidence for reducing thyroid antibodies in HLA-DQ2.5 carriers with autoimmune thyroid involvement.",
        "This marker is directly relevant to your existing lab pattern and worth raising explicitly at your endocrinology appointment.",
      ],
      aiContext: "HLA-DQ2.5 heterozygous: elevated autoimmune susceptibility, directly relevant to rising TPO antibody trend. Celiac screening and gluten-autoimmune connection should be considered.",
    },
  ];

  // Pharmacogenomic markers. These govern drug metabolism and carry different framing:
  // always described as "discuss with your prescriber" not "here's what to do."
  const demoPharmaMarkers = [
    {
      gene: "CYP2D6",
      variant: "Intermediate metabolizer",
      status: "watch",
      impact: "Clinical",
      title: "Antidepressants, opioids, ADHD medications",
      what: "CYP2D6 metabolizes roughly 25% of commonly prescribed drugs. Intermediate metabolizers process these drugs more slowly than average, meaning standard doses may produce higher-than-expected blood levels.",
      medications: [
        { name: "SSRIs (fluoxetine, paroxetine, sertraline)", note: "May accumulate; start low, monitor closely" },
        { name: "Codeine", note: "Reduced conversion to morphine; less effective for pain" },
        { name: "Tamoxifen", note: "Reduced activation; discuss alternative breast cancer treatments if relevant" },
        { name: "Atomoxetine (Strattera)", note: "Significantly elevated plasma levels; dose adjustment needed" },
        { name: "Beta-blockers (metoprolol)", note: "Enhanced and prolonged effect; lower doses may be appropriate" },
      ],
      discuss: "Before starting any new psychiatric, pain, or cardiac medication, let your prescriber know you are a CYP2D6 intermediate metabolizer. Ask whether a pharmacogenomic dose adjustment is appropriate.",
      aiContext: "CYP2D6 intermediate metabolizer: SSRIs, codeine, tamoxifen, atomoxetine, and beta-blockers all require prescriber discussion. Standard doses may accumulate.",
    },
    {
      gene: "CYP2C19",
      variant: "Normal metabolizer",
      status: "normal",
      impact: "Informative",
      title: "Blood thinners, PPIs, antidepressants",
      what: "CYP2C19 metabolizes clopidogrel (Plavix), proton pump inhibitors (omeprazole), and several antidepressants. Your normal metabolizer status means standard doses of these medications are appropriate.",
      medications: [
        { name: "Clopidogrel (Plavix)", note: "Normal conversion to active form — standard dosing appropriate" },
        { name: "Omeprazole / pantoprazole", note: "Standard metabolism — normal dosing appropriate" },
      ],
      discuss: "No dose adjustments needed for CYP2C19-metabolized drugs based on this result.",
      aiContext: "CYP2C19 normal metabolizer: no pharmacogenomic concerns for this pathway.",
    },
    {
      gene: "CYP1A2",
      variant: "Slow metabolizer",
      status: "variant",
      impact: "Clinical",
      title: "Caffeine, certain antidepressants, clozapine",
      what: "CYP1A2 metabolizes caffeine, theophylline, and several psychiatric medications. Slow metabolizers clear these compounds significantly more slowly than average.",
      medications: [
        { name: "Caffeine", note: "Clears slowly — elevated cardiovascular risk from heavy caffeine intake; afternoon coffee is more disruptive to sleep than average" },
        { name: "Clozapine", note: "Significant accumulation risk; psychiatrist must be informed" },
        { name: "Theophylline", note: "Narrow therapeutic window; dose adjustment required" },
      ],
      discuss: "Your slow caffeine metabolism is clinically relevant. Limit intake to before noon. If ever prescribed clozapine or theophylline, your prescriber must know your CYP1A2 status.",
      aiContext: "CYP1A2 slow metabolizer: caffeine clears slowly — directly relevant to sleep quality and HRV. Afternoon caffeine is a meaningful contributing factor to below-baseline device readings.",
    },
    {
      gene: "SLCO1B1",
      variant: "rs4149056 heterozygous",
      status: "watch",
      impact: "Clinical",
      title: "Statin-induced muscle damage risk",
      what: "SLCO1B1 affects how statins are transported into the liver. Your variant is associated with a significantly elevated risk of statin-induced myopathy (muscle breakdown) at standard doses.",
      medications: [
        { name: "Simvastatin", note: "High myopathy risk — avoid or use very low dose" },
        { name: "Atorvastatin", note: "Moderate risk — if prescribed, start at lowest dose and monitor CK levels" },
        { name: "Rosuvastatin / pravastatin", note: "Lower SLCO1B1 dependence — safer options if a statin is needed" },
      ],
      discuss: "If a statin is ever recommended for cardiovascular risk, inform your prescriber of this result. Rosuvastatin or pravastatin are safer options for your genotype than simvastatin or high-dose atorvastatin.",
      aiContext: "SLCO1B1 variant: elevated statin myopathy risk. If statin therapy is ever discussed, rosuvastatin or pravastatin are preferable genotype-appropriate options.",
    },
    {
      gene: "CYP2C9",
      variant: "Normal metabolizer",
      status: "normal",
      impact: "Informative",
      title: "Warfarin, NSAIDs, diabetes medications",
      what: "CYP2C9 metabolizes warfarin, ibuprofen, celecoxib, and some diabetes drugs. Normal metabolizer status means standard dosing is appropriate.",
      medications: [
        { name: "Warfarin", note: "Standard dosing appropriate — no dose adjustment needed" },
        { name: "NSAIDs (ibuprofen, celecoxib)", note: "Normal metabolism" },
      ],
      discuss: "No dose adjustments needed for CYP2C9-metabolized drugs.",
      aiContext: "CYP2C9 normal metabolizer: no pharmacogenomic concerns for warfarin or NSAIDs.",
    },
  ];

  // The sets actually rendered: the user's imported genomes when present, split by
  // the `category` the extraction assigned; the demo set in test mode.
  const lifestyleMarkers = isDemo
    ? demoLifestyleMarkers
    : importedMarkers.filter((m) => m.category !== "pharma");
  const pharmaMarkers = isDemo
    ? demoPharmaMarkers
    : importedMarkers.filter((m) => m.category === "pharma");

  const statusColors = {
    normal: COLORS.tealLight,
    favorable: COLORS.tealLight,
    variant: COLORS.warning,
    watch: COLORS.danger,
    unknown: COLORS.textMuted,
  };

  const impactBg = {
    "Informative": COLORS.bgCardAlt,
    "Moderate": COLORS.warnDim,
    "Clinical": COLORS.badDim,
    "Watch": COLORS.badDim,
  };

  const LifestyleMarkerCard = ({ m }) => {
    const [open, setOpen] = useState(false);
    return (
      <Card style={{ border: `1px solid ${statusColors[m.status]}30`, background: impactBg[m.impact] }}>
        <button onClick={() => setOpen(!open)} style={{
          width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{m.gene}</span>
                {m.variant && <span style={{
                  fontSize: 10, color: statusColors[m.status], background: `${statusColors[m.status]}20`,
                  padding: "2px 7px", borderRadius: 5, fontWeight: 600
                }}>{m.variant}</span>}
              </div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{m.title}</div>
            </div>
            <ChevronRight size={16} color={COLORS.textMuted} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0, marginTop: 2 }} />
          </div>
        </button>
        {open && (
          <div style={{ marginTop: 12 }}>
            {m.what && (
              <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 12 }}>
                {m.what}
              </div>
            )}
            {m.notes && (
              <div style={{ marginBottom: 12, padding: "10px 12px", background: COLORS.bgCard, borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.gold, marginBottom: 6, letterSpacing: 0.5 }}>
                  FROM YOUR REPORT
                </div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6 }}>{m.notes}</div>
              </div>
            )}
            {(m.forYou || []).length > 0 && (
              <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.gold, marginBottom: 8, letterSpacing: 0.5 }}>
                WHAT THIS MEANS FOR YOU
              </div>
            )}
            {(m.forYou || []).map((point, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7 }}>
                <span style={{ color: COLORS.tealLight, flexShrink: 0, marginTop: 1 }}>·</span>
                <span style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5 }}>{point}</span>
              </div>
            ))}
            <div style={{
              marginTop: 12, padding: "8px 10px", background: COLORS.bgCard,
              borderRadius: 8, display: "flex", gap: 6, alignItems: "flex-start"
            }}>
              <Sparkles size={12} color={COLORS.tealLight} style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5 }}>
                Your AI advocate uses this when you ask about supplements, nutrition, or lifestyle recommendations.
              </div>
            </div>
          </div>
        )}
      </Card>
    );
  };

  const PharmaMarkerCard = ({ m }) => {
    const [open, setOpen] = useState(false);
    return (
      <Card style={{ border: `1px solid ${statusColors[m.status]}30`, background: impactBg[m.impact] }}>
        <button onClick={() => setOpen(!open)} style={{
          width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{m.gene}</span>
                {m.variant && <span style={{
                  fontSize: 10, color: statusColors[m.status], background: `${statusColors[m.status]}20`,
                  padding: "2px 7px", borderRadius: 5, fontWeight: 600
                }}>{m.variant}</span>}
                <span style={{
                  fontSize: 10, color: m.impact === "Clinical" ? COLORS.danger : COLORS.textMuted,
                  background: COLORS.bgCardAlt, padding: "2px 7px", borderRadius: 5
                }}>{m.impact}</span>
              </div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{m.title}</div>
            </div>
            <ChevronRight size={16} color={COLORS.textMuted} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0, marginTop: 2 }} />
          </div>
        </button>
        {open && (
          <div style={{ marginTop: 12 }}>
            {m.what && (
              <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6, marginBottom: 12 }}>
                {m.what}
              </div>
            )}
            {m.notes && (
              <div style={{ marginBottom: 12, padding: "10px 12px", background: COLORS.bgCard, borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.gold, marginBottom: 6, letterSpacing: 0.5 }}>
                  FROM YOUR REPORT
                </div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6 }}>{m.notes}</div>
              </div>
            )}
            {(m.medications || []).length > 0 && (
              <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.warning, marginBottom: 8, letterSpacing: 0.5 }}>
                AFFECTED MEDICATIONS
              </div>
            )}
            {(m.medications || []).map((med, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", padding: "7px 0",
                borderBottom: i < m.medications.length - 1 ? `1px solid ${COLORS.border}` : "none"
              }}>
                <span style={{ fontSize: 12, flex: 1 }}>{med.name}</span>
                <span style={{ fontSize: 11, color: COLORS.textMuted, maxWidth: 160, textAlign: "right" }}>{med.note}</span>
              </div>
            ))}
            <div style={{
              marginTop: 12, padding: "10px 12px",
              background: m.status === "normal" ? COLORS.bgCard : COLORS.badDim,
              border: `1px solid ${m.status === "normal" ? COLORS.border : COLORS.danger + "40"}`,
              borderRadius: 10
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: m.status === "normal" ? COLORS.tealLight : COLORS.warning, marginBottom: 4 }}>
                DISCUSS WITH YOUR PRESCRIBER
              </div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5 }}>
                {m.discuss || "Share this pharmacogenomic result with your prescriber before starting or changing any affected medication."}
              </div>
            </div>
            <div style={{
              marginTop: 10, padding: "8px 10px", background: COLORS.bgCard,
              borderRadius: 8, display: "flex", gap: 6, alignItems: "flex-start"
            }}>
              <Sparkles size={12} color={COLORS.tealLight} style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5 }}>
                Your AI advocate flags this when you ask about medications. It never tells you what to take — it ensures you ask the right questions of the right person.
              </div>
            </div>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div style={{ padding: "24px 18px" }}>
      <button onClick={() => setActive("profile")} style={{
        background: "none", border: "none", display: "flex", alignItems: "center", gap: 6,
        color: COLORS.textSecondary, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18
      }}>
        <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back to Profile
      </button>

      <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em", marginBottom: 4 }}>Genetic profile</div>
      <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 6 }}>
        {hasGenetics
          ? "Based on your imported genetic data."
          : "Import a genetic source to see your markers."}
      </div>

      {!hasGenetics && (
        <div style={{ marginTop: 16 }}>
          <LockedDataSection
            title="No genetic data connected"
            description="Connect 23andMe or import a clinical genetic panel to see your supplement, lifestyle, and pharmacogenomic markers here. Nothing is shown until your own data is imported."
            actionLabel="Import genetic data"
            onAction={() => setActive("importlabs")}
            rows={3}
          />
        </div>
      )}

      {hasGenetics && (<>
      <div style={{
        fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 22,
        padding: "10px 12px", background: COLORS.bgCardAlt, borderRadius: 10
      }}>
        These markers inform your AI advocate's recommendations. They are not diagnoses.
        Pharmacogenomic findings should always be discussed with a licensed prescriber before
        any medication change.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={() => setActiveSection("lifestyle")} style={{
          flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
          background: activeSection === "lifestyle" ? COLORS.teal : COLORS.bgCardAlt,
          color: activeSection === "lifestyle" ? COLORS.onAccent : COLORS.textSecondary, border: "none"
        }}>Supplements & lifestyle</button>
        <button onClick={() => setActiveSection("pharma")} style={{
          flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
          background: activeSection === "pharma" ? COLORS.teal : COLORS.bgCardAlt,
          color: activeSection === "pharma" ? COLORS.onAccent : COLORS.textSecondary, border: "none"
        }}>Pharmacogenomics</button>
      </div>

      {activeSection === "lifestyle" && (
        <>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 14, lineHeight: 1.5 }}>
            Tap any marker to see what it means for your supplement and lifestyle decisions specifically.
          </div>
          {lifestyleMarkers.map((m, i) => <LifestyleMarkerCard key={m.id || `${m.gene}-${i}`} m={m} />)}
          <button onClick={() => setActive("importlabs")} style={{
            width: "100%", background: COLORS.bgCardAlt, border: `1px dashed ${COLORS.gold}50`,
            borderRadius: 14, padding: "14px", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8, color: COLORS.gold, fontSize: 13,
            fontWeight: 600, cursor: "pointer", marginTop: 6
          }}>
            <Dna size={16} /> Import additional genetic data
          </button>
        </>
      )}

      {activeSection === "pharma" && (
        <>
          <div style={{
            padding: "10px 12px", background: COLORS.badDim, border: `1px solid ${COLORS.danger}30`,
            borderRadius: 10, fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5, marginBottom: 14
          }}>
            Pharmacogenomic findings show how your genes affect drug metabolism. This information
            is for discussion with your prescriber only. Never adjust or stop a medication based
            on this screen alone.
          </div>
          {pharmaMarkers.map((m, i) => <PharmaMarkerCard key={m.id || `${m.gene}-${i}`} m={m} />)}
        </>
      )}
      </>)}
    </div>
  );
}

export { GeneticProfileScreen };
