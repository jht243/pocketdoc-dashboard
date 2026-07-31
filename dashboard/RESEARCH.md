# PocketDoc Dashboard — Competitor Research & Design Rationale

*Research date: July 14, 2026. Sources: product sites, UX teardowns, app-store reviews across 16 competitor apps.*

## Who we studied

| Category | Products |
|---|---|
| Bloodwork / longevity platforms | Function Health, InsideTracker, Superpower, Marek Health, Everlywell |
| Wearable apps | Oura, WHOOP, Apple Fitness (rings), Garmin Connect, Eight Sleep |
| AI health assistants / records | Guava Health, Ada, K Health, Bevel, Gyroscope, Kin |

## The best patterns (and where each came from)

1. **One giant answer at the top** *(Oura, WHOOP)* — a huge score in an animated ring answers "how am I today?" in under a second. 0–100 scale; green ≥85 "Optimal", amber 70–84, red <70 are the consumer-standard cut points.
2. **Crown badge at 85+** *(Oura)* — a tiny status reward users screenshot and share.
3. **Ring sweep + count-up on load** *(Apple Fitness)* — the ~1s draw animation is most of the perceived polish. Apple also proves celebration mechanics (closed-ring confetti, streaks) drive retention.
4. **Three-tier biomarker triage, not binary** *(fixes Function Health's #1 complaint)* — Optimal / Borderline / Attention. Function's flat in/out-of-range makes a mildly-off value look as scary as a critical one; reviewers explicitly ask for gradation and "digital bedside manner."
5. **Headline stat → category cards with out-of-range counts** *(Function Health)* — "87 of 102 optimal" then Heart / Hormones / Nutrients cards with severity badges turns 100+ markers into a 5-second triage surface.
6. **Nested optimal-zone trend chart** *(InsideTracker's signature)* — green optimal band inside a wider normal band, with the trend line shifting color as it crosses zones. Improvement (red→green) becomes viscerally legible and drives re-testing.
7. **Data first, chat one tap away** *(inverts Superpower's mistake)* — reviewers panned Superpower for putting AI chat before their lab data. The dashboard leads with health data; the Ask bar sits below and as a center orb in the tab bar.
8. **Anomaly-seeded prompt chips** *(WHOOP Coach, Oura Advisor, Guava)* — suggested questions generated from the user's actual data ("Why did my ferritin drop since April?"), not generic prompts. In Oura's beta, 75% of questions were about whatever score looked bad that day.
9. **Visit-prep generator** *(Guava is the proven spec)* — one page templated by appointment type: flagged markers with trends, med list, user-queued questions; shipped as PDF + secure link. Maps 1:1 to PocketDoc's Discussion Page feature.
10. **Personal baseline bands on wearable vitals** *(Oura)* — "▲ 6ms vs your baseline" reads as personalized, not judgmental.
11. **Strict color economy** *(WHOOP's rule)* — green/amber/red carry meaning, one accent (blue→violet) for AI/interactive, no decorative color. (WHOOP/Oura/Apple ship dark instrument-panel themes; we chose a clean light theme — Garmin's 2024 redesign and Everlywell prove light works when the layout is calm — with semantic color steps darkened for legibility on white.)
12. **Serif editorial headlines × big-number sans data** *(2025–26 "editorial wellness" trend; Superpower/Function marketing)* — premium without being clinical.

## Mistakes we deliberately avoided

- **Binary in/out-of-range flags** (Function) → three tiers everywhere.
- **Upsells before results** (InsideTracker's redesign was read as a downgrade) → the user's health is the first thing on screen.
- **Chat-first home** (Superpower) → data first, ask everywhere.
- **Jargon in insights** (WHOOP's documented weakness) and **walls of AI text** (Eight Sleep) → one short, plain-English coach-toned insight card tied to today's scores.
- **Score-algorithm churn** (Eight Sleep's trust collapse) → the demo shows one consistent scoring vocabulary.

## What's in the demo (dashboard/index.html)

Dummy persona "Dr. Adam Locker", 45: Health Score 86 (crown), sub-scores Sleep 82 / Activity 68 / Metabolic 91, 102 markers (87 optimal · 9 borderline · 6 attention) across 8 categories, ApoB trend (118→78, descending into the optimal zone — the classic 45-year-old male cardiology win), age-banded optimal ranges ("men 40–49"), Oura vitals, anomaly-seeded ask chips (ferritin drop, ApoB+LDL, age-normed testosterone), Dr. Patel preventive-cardiology visit-prep card with a working "Generate Discussion Page" interaction, meds adherence (rosuvastatin, D3, magnesium), and the AI-extraction receipt (Quest PDF → 34 markers).

Everything is a single self-contained HTML file — open it in any browser, no build step. Animations: ring sweep + count-ups on load, staggered scroll reveals, chart line draw, breathing ambient glow; `prefers-reduced-motion` respected.
