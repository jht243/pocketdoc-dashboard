# Guided Health AI (GHAI)

Proactive health companion — web-based and mobile-friendly (no native app).

## Running locally

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # production build into dist/
```

## Project structure

```
src/
  main.jsx                 app entry
  App.jsx                  screen router + top-level state
  styles/global.css        reset (border-box) + base typography
  theme/tokens.js          COLORS, SHADOW, SERIF, SANS, RADIUS
  lib/
    api.js                 central AI gateway — all AI calls go through here
    preventiveCare.js      USPSTF Grade A/B evaluator (age/sex/risk)
    uspstfScreeningRules.json  structured screening rules (source of truth)
    recommendations.js     daily recommendation engine
    scoring.js             health-score model
  components/              PhoneFrame, TabBar, Card, SectionLabel, ScoreGauge,
                           ScoreBreakdownModal, ScoreTrendChart, BodyMetricHistory,
                           IVTherapyCard
  screens/                 17 screens (Onboarding, Home, AIChat, Labs, Records,
                           PreventiveCare, Medications, GeneticProfile, ...)
```

## Configuration

Copy `.env.example` to `.env.local`.

| Variable | Purpose |
| --- | --- |
| `VITE_AI_ENDPOINT` | AI gateway URL. Empty = Anthropic direct. |
| `VITE_AI_MODEL` | Model id for all AI calls. |

## Emails

Branded transactional mail (header → subheader → body → CTA) lives in `src/lib/emailLayout.js`. Preview at `/emails/preview.html`. Auth templates (confirm signup, reset, etc.) are in `emails/auth/` — apply them to Supabase Auth with `npm run emails:apply` (needs a personal access token) or paste via the dashboard. See `emails/README.md`.

## Status

This is the V1 frontend, ported from the single-file mockup. Working today:

- All 17 screens in the PocketDoc light design system
- Preventive-care rules engine (USPSTF Grade A/B baseline, risk-adjusted)
- Health-score model and daily recommendation engine
- File upload (PDF / image / camera capture)

### Known gaps — next phases

1. **No persistence.** All state is in-memory and resets on refresh. No database,
   no auth. (Phase B/C)
2. **AI calls need a backend.** `lib/api.js` posts directly to the provider with
   no API key, which only works inside a sandboxed preview. Phase D stands up a
   server proxy; point `VITE_AI_ENDPOINT` at it and every screen follows — no
   screen changes needed.
3. Email reminders, physician share link, private/demo modes are not built yet.

## Wearables

Oura is integrated end-to-end (OAuth2 → webhooks → normalized `wearable_daily` →
Home vitals, health score, and AI chat context). It needs credentials and a deploy
before it does anything — see `OURA-INTEGRATION-SPEC.md` §11–12.

Note for future device work: Apple Health and Health Connect are **not** reachable
from a web app — both are on-device SDKs requiring a native shell. Google Fit is
retired (no new developers since May 2024, end-of-service late 2026); its cloud
successor is the Google Health API, formerly the Fitbit Web API.
