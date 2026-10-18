# Thumbprint agents: design

This is a copy of the Monitus agent system (Adam Handfinger), adapted for medicine. Same mechanics, different job descriptions, library and facts.

## The team: 1 manager + 4 specialists

The roster follows Adam's Oct 14 build spec, section 3.

| Agent | Monitus counterpart | Covers | Must never |
|---|---|---|---|
| **Advocate** (manager) | Manager | Routes the question, runs the huddle, writes the one answer the member sees, runs the bio-age simulator. Out-of-scope questions get "let's bring this to your clinician". | Answer a clinical question without a specialist; skip the safety check |
| **Bloodwork** | Defaults Expert (the core one) | CBC, CMP, lipids + ApoB, A1c + insulin, liver, kidney, iron, vitamins, hs-CRP; owns the PhenoAge and Heart Age explanations | Diagnose; recommend starting or changing a medication |
| **Hormone & Thyroid** | Bond Expert | Male and female modules: perimenopause and menopause, testosterone, estradiol, SHBG, progesterone, thyroid and antibodies; peptide education and FDA status only | Recommend a specific hormone, peptide or dose |
| **Medication & Interactions** | Contract Expert | Current meds, supplements, drug-supplement interactions, pharmacogenomics (CPIC A/B) once a report is on file | Start, stop or change a dose; it flags and explains only |
| **Lifestyle** | Construction Generalist | Nutrition, sleep, activity, wearable trends, check-in follow-up | Give medical advice |
| **General** (scope-limited, added Oct 18) | none | Only: the preventive screening schedule from the record, how the app works, preparing for an appointment, wellness questions the record already answers. Everything else (a rash, an injury, a new symptom) gets "let's bring this to your clinician" with what to raise | Answer anything off its approved list; diagnose; name a condition |

**Not counted in the five:**
- **Safety:** the Fact-Checker. It runs as code before and after the model, plus a model check.
- **Client pass:** sorts what goes up front and what goes below.
- These are steps in the pipeline, not agents the member sees.

## How a question runs

It runs on a Node service, as in Monitus `server.mjs`, and streams server-sent events.

1. **Pre-check (code).** `detectUrgentPatterns` on the question and the labs. A crisis or critical value bypasses the agents: emergency message, clinician notified.
2. **Route (cheap tier).** The Advocate brief returns JSON `{specialists[], reason}`. Code also forces specialists:
   - A medication or supplement is named → Medication.
   - Hormone or thyroid words → Hormone & Thyroid.
   - Any lab value is in question → Bloodwork.
3. **Research, in parallel (smart tier).** Each specialist prompt contains:
   - its `## Facts` slice: labs **with collection dates, sorted newest first**, meds, intake answers, wearables
   - its `## Knowledge` passages, from its own library sections only
   - its `ask`
   - the `SUMMARY_ASK` closing block
4. **Huddle, in parallel.** Each specialist sees the others' findings and writes three or fewer bullets: agree, conflict or revise. The current care-team UI already draws this.
5. **Routing lanes (code + data).** Each finding is matched against the escalation matrix (spec #25) and becomes either "You can act on this" or "Bring this to your provider". Matching is deterministic, like Monitus playbooks.
   - Built in `lib/escalation.mjs`. The newest reading of each matrix marker gets a lane card (`self`, or `provider` at level `flag` or `immediate`). Provider rules run in matrix order, first match wins; `lab_high`/`lab_low` read the range on the member's report; sex-specific rules use the profile's sex (unknown sex: the lower threshold applies, and the card says so).
   - A value is compared only in the matrix's unit. Spellings of one unit match ("K/uL" = "x10^9/L"); nothing is converted. Lp(a) routes to the provider in any unit, but its mg/dL threshold is applied only to mg/dL.
   - eGFR's trend rule needs the previous draw date, in the same unit, to be higher.
   - Section 9 overrides (`emergencyFor`) run before routing. A hit drawn within 90 days skips the agents and returns a hard-coded message; older ones are left to the urgency pre-check's recheck.
   - The `conditions` (ESC-02 to ESC-05) are text and travel on each card as context; code does not evaluate them yet.
6. **Compose.** The Advocate drafts from all findings, the huddle notes and the lane cards.
7. **Safety check.** The Fact-Checker brief and the code rules check:
   - doses
   - start, stop, increase or decrease next to a medication name
   - "you have…" diagnoses
   - stale-reading claims
   - every number traced to the facts

   If anything fails: one revision, then a deterministic scrub. Blocked outputs are logged for weekly medical director review: every fact-check flag, rule rewrite, rule scrub, crisis and Section 9 bypass is a row in `ghai.safety_events`, and `ghai.safety_review_last_week` is the list Adam reads (migration `20261018_care_team_logs.sql`).
8. **Finish.** Sources list, routing log, cost ledger, answer.
   - The routing log is `ghai.agent_runs`: which specialists ran, whether General took the question, and whether it fell back to the clinician, with General's one-line topic. `ghai.fallback_topics_last_30_days` counts the fallbacks by topic: the most common decides which agent is built next.
   - Both logs are written after the reply, as the member (their JWT through PostgREST; the service has no service-role key), and never fail the round (`lib/logs.mjs`).
   - Each provider-lane marker in the reply's lanes opens a follow-up (`ghai.follow_ups`, written by the app from the `reply` event). The morning check-in asks about it at 30 days and again at 60 (`src/lib/followUps.js`).

## What carries over unchanged from Monitus

- **Agents as markdown files:** `briefs/<agent>/brief.md` plus `briefs/shared/rules.md`, prepended to every agent. Routing metadata lives in a `BUILTIN` registry in code.
- **Shared rules,** adapted:
  - Never invent.
  - Name the source: "[Lab: Quest, Sep 17 2026]" or `[Rn] "Title"`.
  - Facts come from the record; expertise comes from the library.
  - Plain English.
  - Stay in your lane.
  - **Newest reading wins and is dated.** This is new, and it fixes the vitamin D bug.
  - Use the record; never send the member to fetch what's on screen.
  - Answer about the whole picture.
- **Library:** markdown files with frontmatter, one folder per section, using the same keyword `searchReference(sections, query, k)` interface (pgvector can come later). Every entry carries `evidence: Strong|Moderate|Emerging`, `source` and `approved_by`.
- **Event stream:** the same event types. The existing `CareTeam.jsx` animation reads them through a thin mapper.
- **Bench:** Adam (and later the medical director) asks questions, edits answers, and the trainer brief proposes typed changes to briefs, rules, the registry or the library. Changes are versioned in `agent_config_version` and approved before they go live. Saved tests are re-run by a judge. This is how the spec's "30–50 graded cases per agent" gets built.

## What changes for medicine

| Monitus | Thumbprint |
|---|---|
| Facts = liens, suits, UCCs per company | Facts = the member's labs (dated, with lab range), meds, intake, wearables, documents, check-ins, read through the member's JWT and RLS |
| Governing contract (rule 7: "say whether you had it") | The member's lab report: "No lipid panel on file since Mar 2025" goes in the first sentence when missing |
| Playbooks matched on a trigger | Escalation matrix and lane templates (spec #25) matched on marker + threshold |
| Library: 50-state lien law, Bond Default Manual | Library sections: `lipids-cardio/`, `metabolic/`, `kidney-liver/`, `blood-iron/`, `vitamins/`, `inflammation/`, `thyroid/`, `hormones-female/`, `hormones-male/`, `peptides/`, `medications/`, `pharmacogenomics/`, `supplements/`, `nutrition/`, `sleep/`, `activity/`, `preventive/` (USPSTF), `bio-age/` (Levine, PREVENT) |
| Fact-Checker codes GATE/RECORD/CITE… | DOSE, MED-CHANGE, DIAGNOSIS, STALE, UNSOURCED, NUMBER, ESCALATE |
| `carryCheck` writes counts in code | Code writes the "latest values" table and the bio-age numbers; the model never computes them |

## Where it lives

- `app/agents/`: `server.mjs`, `lib/` (llm, agents, manager, knowledge, facts-db, safety, bench), `briefs/`, `library/`.
- New Render web service `thumbprint-agents` (Node), added to `render.yaml`.
- The app's chat calls it instead of running `runCareTeam` in the browser. Today the browser does the orchestration and every call queues behind background AI jobs.
- `clinicalRules.js` moves to `supabase/functions/_shared/` so the server and browser share one copy, as `bloodworkScore.js` already does.

## Build order

1. **Server skeleton:** `llm.mjs` (OpenAI, smart and cheap tiers), shared rules, 5 briefs, registry, the dated facts renderer, and the route → research → huddle → compose → safety pipeline. Streams to the existing `CareTeam.jsx`.
2. **Starter library:** about 10–20 short entries per section, drafted from the guidelines in the Oct 14 spec, marked `approved_by: pending`, plus the escalation matrix as data.
3. **Switch the chat over** behind a flag, with a fallback to the current browser orchestration.
4. **Bench** for Adam: migrations, trainer allowlist, `/bench` page.
5. **Test sets** of 30–50 questions per agent, saved through the bench.

## Running it (step 1, built)

- `npm test` runs the pipeline with the model stubbed: the event contract, routing, record slices, the dose net and the crisis path. It also checks the library: frontmatter, length, no passage the safety net would block, the escalation matrix shape, and sample questions per specialist.
- `npm start` starts the service on :5190, or `AGENTS_PORT`. It reads the Supabase URL and anon key from `app/.env.local`.
  - With no `OPENAI_API_KEY`, model calls go through the `ghai-ai` edge function with the member's JWT.
- For the app against it locally, run the `app-with-agents` launch config. It is the dev server with `VITE_AGENTS_URL=http://localhost:5190`.
- If `VITE_AGENTS_URL` is unset, nothing changes: the chat runs the browser care team. If the service fails mid-round, the chat restarts the round in the browser.

| File | What it is |
|---|---|
| `briefs/` | Who each agent is: `shared/rules.md`, `advocate`, `advocate-answer`, `bloodwork`, `hormones`, `medications`, `lifestyle`, `general`, `safety` |
| `lib/team.mjs` | The roster (facts slice + library sections per agent) and the pipeline |
| `lib/safety.mjs` | Code checks before and after the model, from `src/lib/clinicalRules.js` |
| `lib/escalation.mjs` | Step 5: lab names → matrix markers, one lane card per marker, Section 9 emergency overrides, and the block compose reads |
| `lib/knowledge.mjs` | Library search: keyword overlap weighted by rarity, title words count double |
| `library/` | Step 2: 294 starter passages in `reference/<section>/`, the escalation matrix (`escalation.json`, spec #25), and a README listing every passage. All awaiting medical-director approval. `npm run library:readme` rebuilds the README |
| `lib/llm.mjs` | Model calls and the per-question cost ledger |
| `lib/logs.mjs` | The safety and routing logs, written with the member's JWT |
| `server.mjs` | `POST /chat` (SSE), `GET /health` |
