# Oura Ring integration — implementation spec

> **Status: built.** The code described below is in the repo and the migration is
> applied. Two things changed during implementation and are corrected in place:
> webhook subscriptions turned out to be *application*-scoped rather than per-user
> (§8), and turning the score on required wiring the ring's base half too (§9).
> Remaining work is credentials + deployment — see §11.

Replaces the hard-coded Oura data in the test snapshot with a real, per-user OAuth2
connection. Written against the app as it exists today: React + Vite browser client,
Supabase (`ghai` schema) for auth/data, Deno Edge Functions for anything holding a secret.

---

## 1. What this feeds

Every Oura-shaped field in the app is currently faked in
[`testMode.js`](src/lib/testMode.js) and only reachable in test mode. Real users see
nothing. This integration makes `healthData.today`, `healthData.vitals`, and the
Oura parts of `healthData.score` real.

| Consumer | File | What it needs |
|---|---|---|
| Daily score ring | [`scoring.js:44`](src/lib/scoring.js) | `score.sleepScore`, `score.sleepNote`, `score.zone2Minutes` |
| Home vitals chips | [`HomeScreen.jsx:31`](src/screens/HomeScreen.jsx) | `vitals[]` — `{ label, value, sub, color }` |
| AI chat context | [`AIChatScreen.jsx:56`](src/screens/AIChatScreen.jsx) | `today.readiness`, `readinessTypical`, `hrv`, `hrvBaseline`, `restingHR`, `restingHRBaseline` |
| Discussion page | [`DiscussionPageScreen.jsx:81`](src/screens/DiscussionPageScreen.jsx) | resting HR trend, overnight temp deviation, HRV vs baseline |
| Recommendations | [`recommendations.js`](src/lib/recommendations.js) | `today.*` (skin temp, sleep efficiency, strain) |
| Connected devices UI | [`ProfileScreen.jsx:107`](src/screens/ProfileScreen.jsx) | real connect/disconnect + last-sync time |

**Design rule:** the sync layer writes to a normalized `wearable_daily` table. Nothing
downstream learns the word "Oura" beyond a `source` column. Adding WHOOP or Eight Sleep
later means a new sync function, not new screen code.

---

## 2. Prerequisites (start these first — they have lead time)

1. **Register the OAuth app** at <https://cloud.ouraring.com> → API Applications.
   Yields `client_id` + `client_secret`.
2. **Redirect URI** must be registered exactly:
   `https://<project>.supabase.co/functions/v1/ghai-oura-callback`
3. **Personal Access Tokens are dead** (deprecated Dec 2025). OAuth2 authorization
   code is the only path. Don't prototype with a PAT.
4. **The 10-user cap.** A newly registered app connects at most 10 Oura users until
   Oura approves it. Fine for MVP and demos; **submit for review before any real
   launch** — this is the only gate with an unknown wait.
5. API access is free. Rate limit is 5,000 requests / 5 min, enforced per-token *and*
   per-application.

---

## 3. Architecture

```
Browser (React)
   │  supabase.functions.invoke("ghai-oura-connect")   ← user JWT attached
   ▼
ghai-oura-connect  ──► returns Oura authorize URL (with signed state)
   │
   │  user consents at cloud.ouraring.com
   ▼
ghai-oura-callback  (public, --no-verify-jwt)
   │  code → tokens, fetch personal_info, encrypt + store, create webhook subs,
   │  backfill 30 days, redirect back to the app
   ▼
ghai-oura-webhook  (public, --no-verify-jwt)
   │  Oura POSTs {event_type, data_type, object_id, user_id} — no payload data
   │  → look up token by oura_user_id → fetch the object → upsert wearable_daily
   ▼
ghai.wearable_daily   ← the only thing the client reads (RLS: own rows)
```

Three trust rules, all forced by the existing codebase's conventions:

- `client_secret` lives **only** in Edge Function secrets, never in a `VITE_*` var.
  Same pattern as `ghai-amazon` and `ghai-ai`.
- Access/refresh tokens are **never** returned to the browser.
- The client reads normalized rows, not the Oura API.

---

## 4. Database schema (`ghai` schema)

```sql
-- ---------- token vault ----------
create table ghai.oura_connections (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  oura_user_id       text unique not null,      -- from /v2/usercollection/personal_info
  access_token_enc   text not null,             -- AES-GCM, see §5
  refresh_token_enc  text not null,
  token_expires_at   timestamptz not null,
  scopes             text[] not null default '{}',
  status             text not null default 'connected',  -- connected | revoked | error
  last_sync_at       timestamptz,
  last_error         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Nothing but service_role touches tokens. The client never selects from here.
alter table ghai.oura_connections enable row level security;
revoke all on ghai.oura_connections from anon, authenticated;

-- ---------- CSRF state for the OAuth round-trip ----------
create table ghai.oura_oauth_states (
  nonce       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  return_to   text,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
alter table ghai.oura_oauth_states enable row level security;
revoke all on ghai.oura_oauth_states from anon, authenticated;

-- ---------- the normalized daily record (vendor-neutral) ----------
create table ghai.wearable_daily (
  user_id                uuid not null references auth.users(id) on delete cascade,
  day                    date not null,
  source                 text not null default 'oura',

  sleep_score            int,        -- daily_sleep.score
  readiness_score        int,        -- daily_readiness.score
  activity_score         int,        -- daily_activity.score

  hrv_ms                 numeric,    -- sleep.average_hrv
  resting_hr             int,        -- sleep.lowest_heart_rate
  average_hr             numeric,    -- sleep.average_heart_rate
  sleep_efficiency       numeric,    -- sleep.efficiency (0-100)
  total_sleep_minutes    int,        -- sleep.total_sleep_duration / 60
  deep_sleep_minutes     int,
  rem_sleep_minutes      int,
  temp_deviation_c       numeric,    -- daily_readiness.temperature_deviation
  spo2_percent           numeric,    -- daily_spo2.spo2_percentage.average

  steps                  int,
  active_calories        int,
  high_activity_minutes  int,
  medium_activity_minutes int,
  zone2_minutes          int,        -- DERIVED — see §7

  raw                    jsonb not null default '{}'::jsonb,  -- untouched Oura payloads
  synced_at              timestamptz not null default now(),
  primary key (user_id, day, source)
);

alter table ghai.wearable_daily enable row level security;
create policy "own rows" on ghai.wearable_daily
  for select using (auth.uid() = user_id);
create index on ghai.wearable_daily (user_id, day desc);
```

Keeping `raw` means a mapping mistake is recoverable by reprocessing rather than
re-fetching — worth the storage at this scale.

---

## 5. Token encryption

Tokens are long-lived credentials to a person's health data. RLS alone isn't enough —
anyone with a DB backup gets them. Encrypt at the function layer with WebCrypto AES-GCM:

- Secret `OURA_TOKEN_KEY` = base64 32-byte key, set via Supabase function secrets.
- Store as `base64(iv) || ':' || base64(ciphertext)`.
- One shared helper `supabase/functions/_shared/crypto.ts` exporting `seal()` / `open()`.

Refresh handling: Oura access tokens expire (~24h) and refresh tokens rotate on use.
The sync path must (a) refresh when `token_expires_at` is within 5 minutes, and
(b) **persist the new refresh token immediately** — dropping a rotated refresh token
silently bricks the connection until the user reconnects.

---

## 6. Edge Functions

Four new functions under `supabase/functions/`, following the `ghai-amazon` house style
(CORS const, `json()` helper, header docblock naming the secrets).

### `ghai-oura-connect` — JWT required
Reads `user.id` from the JWT. Inserts a nonce row into `oura_oauth_states` (5-min TTL),
returns:

```
https://cloud.ouraring.com/oauth/authorize
  ?response_type=code
  &client_id=<CLIENT_ID>
  &redirect_uri=<callback>
  &state=<nonce>
  &scope=personal daily heartrate workout spo2
```

**Scopes:** request `personal` (needed for `oura_user_id`), `daily`, `heartrate`,
`workout`, `spo2`. Skip `email`, `tag`, `session` — nothing in the app uses them, and
Oura lets users decline individual scopes at the consent screen, so ask for less.

### `ghai-oura-callback` — deploy with `--no-verify-jwt`
This is a browser redirect target, so there's no JWT. Identity comes from `state`.

1. Look up + delete the nonce. Reject if missing or expired.
2. `POST https://api.ouraring.com/oauth/token` with `grant_type=authorization_code`,
   HTTP Basic auth (`client_id:client_secret`).
3. `GET /v2/usercollection/personal_info` → `id` is `oura_user_id`.
4. Encrypt and upsert `oura_connections`. Record the **granted** scopes from the token
   response, not the requested ones.
5. Run a 30-day backfill inline, so the user lands on a populated Home screen.
6. `302` back to `${SITE_URL}/?oura=connected`.

Webhook subscriptions are *not* created here — see §8; they're application-scoped and
set up once, not per user.

Every failure path redirects to `?oura=error&reason=…` — never leaves a blank function
response in the user's browser.

### `ghai-oura-webhook` — deploy with `--no-verify-jwt`
- **GET** = Oura's verification handshake. Oura calls the URL with `verification_token`
  and `challenge` query params; compare the token against the `OURA_WEBHOOK_VERIFICATION_TOKEN`
  secret and echo `{"challenge": "<challenge>"}`. Fail this and the subscription is never created.
- **POST** = an event: `{ event_type, data_type, object_id, event_time, user_id }`.
  **The payload carries no data** — it's a pointer. Verify the HMAC signature, map
  `user_id` → our `user_id` via `oura_connections.oura_user_id`, then fetch the object
  and upsert. Return `200` fast; do the fetch without blocking the response where possible.

### `ghai-oura-sync`
Shared worker used by webhook handling, the nightly cron, and a manual "Sync now".
Fetches the five collections in parallel, merges by `day`, upserts. Two callers, two
auth modes: a user JWT syncs that user only; an `x-cron-secret` header syncs any or
all users. The nightly pass is the safety net — webhooks drop and Oura revises the
previous night for hours, so it re-syncs a trailing 3 days for everyone. One user's
revoked token is caught per-user and never aborts the sweep.

### `ghai-oura-status` / `ghai-oura-disconnect` — JWT required
`oura_connections` is service-role only, so the browser has no read path to it at all.
`status` is that path, returning only what the Profile screen needs — never a token,
never the Oura user id. It reports `lastSyncAt` **and** `lastDay` separately: the job
running and data actually arriving diverge when a ring sits on the charger.
`disconnect` deletes the token row outright rather than flagging it inactive, and
takes an explicit `purge` flag for the synced biometric rows — the UI asks rather than
guessing, since "I sold my ring" and "delete my health data" are different intents.

---

## 7. Field mapping — Oura → app

`GET https://api.ouraring.com/v2/usercollection/<collection>?start_date=&end_date=`
returns `{ data: [...], next_token }`. Paginate on `next_token`.

| App field | Oura source | Notes |
|---|---|---|
| `score.sleepScore` | `daily_sleep.score` | 0–100 |
| `today.readiness` | `daily_readiness.score` | |
| `today.hrv` | `sleep.average_hrv` | **ms — only from `sleep`.** `daily_readiness.contributors.hrv_balance` is a 0–100 *score*, not milliseconds. Easy mistake. |
| `today.restingHR` | `sleep.lowest_heart_rate` | This is what Oura calls resting HR |
| `today.skinTempDeviation` | `daily_readiness.temperature_deviation` | °C, can be negative |
| `today.sleepEfficiency` | `sleep.efficiency` | Oura gives 0–100; app expects 0–1 → divide |
| `today.strainYesterday` | derived from `daily_activity.score` of `day - 1` | low/moderate/high buckets |
| `score.zone2Minutes` | **derived — see below** | |
| `vitals[]` | computed from the above + baselines | |

`sleep` returns one row per sleep *session*; a night can have naps. Select the
`type = 'long_sleep'` session for the day, not the first row.

### Zone 2 has no Oura equivalent — decide this explicitly

`scoring.js` scores "Zone 2+ minutes" and Oura does not expose training zones. Two options:

- **Simple:** `zone2_minutes = medium_activity_minutes + high_activity_minutes` from
  `daily_activity`. Oura's medium band is MET 4–7, which brackets Zone 2 reasonably.
  Zero extra API calls.
- **Accurate:** fetch the `daily_activity.met` time-series (288 × 5-min samples) and
  count samples with `met >= 4`. More faithful, one more field to store.

**Recommendation: ship the simple version**, store `raw`, and upgrade later without a
re-fetch. Either way the UI label should read "Active minutes (MET 4+)" rather than
"Zone 2+" — claiming a heart-rate zone we aren't measuring is the kind of thing this
app shouldn't do.

### Baselines are ours to compute

The UI shows "8ms below baseline" / "+12 vs baseline". **Oura does not return
baselines.** Compute a trailing 14-day median from `wearable_daily`, excluding the
current day, and require ≥7 days of history before showing any "vs baseline" copy.
Until then show the raw value with no comparison — a baseline drawn from three days is
noise presented as a signal.

---

## 8. Webhook subscriptions

**Correction from the original spec:** subscriptions are **application-scoped, not
per-user**. One subscription per `(data_type, event_type)` covers every member who
connects, and events carry Oura's `user_id` to identify who. So this is one-time setup
plus renewal — run `scripts/oura-webhook-subscriptions.mjs create` once, not something
the OAuth callback does per connection.

`POST /v2/webhook/subscription`, authenticated with `x-client-id` / `x-client-secret`
headers (not a bearer token). One subscription per `(data_type, event_type)` pair:

| data_type | event_type |
|---|---|
| `daily_sleep` | `create`, `update` |
| `daily_readiness` | `create`, `update` |
| `daily_activity` | `create`, `update` |
| `sleep` | `create`, `update` |
| `daily_spo2` | `create` |

`update` matters — Oura revises the previous night's scores hours after first publishing
them. Subscribe-to-create-only and the app shows stale numbers all day.

**Subscriptions expire and must be renewed** via the renew endpoint. Put renewal in the
same nightly cron as the trailing re-sync.

Oura's own guidance: webhooks over polling. They report no properly-webhooked customer
has ever hit the rate limit.

---

## 9. Client changes

**New: `src/lib/wearableStore.js`** — mirrors `profileStore.js` conventions (DB shape in,
app shape out, all mapping in one file):

```js
export async function loadWearableSnapshot(userId)  // → { today, vitals, score }
export async function loadOuraStatus(userId)        // → { connected, lastSyncAt, scopes }
export async function startOuraConnect()            // invoke connect fn, window.location = url
export async function disconnectOura(userId)
export async function syncOuraNow(userId)
```

**`App.jsx`** — the loader at line ~113 already does `Promise.all([...])`; add
`loadWearableSnapshot(user.id)` to it and merge into `setLiveHealthData`:

```js
setLiveHealthData({
  labs: …, records: …,
  today:  wearable?.today  ?? null,
  vitals: wearable?.vitals ?? [],
  score:  { ...(wearable?.score ?? {}) },
});
```

`healthData.score` previously existed only in test mode. `useScoreModel` returns
`hasData: false` when `score` is absent, so live users have never seen the ring.

**This surfaced a second gap.** The ring has two halves: daily (wearable) and base
(preventive-care coverage). Switching on `score` with only the daily half would render
the base half at a flat zero — which reads as a terrible score, not an absent one. So
`buildBaseItems(schedule, completedItems)` was added to `scoring.js`, deriving the base
half from the same schedule the Preventive Care screen renders, weighted by category
(cancer 10 / cardiovascular 9 / others 8). An overdue screening scores zero, same as
one never done — the base ring answers "how much of your screening is current", and a
colonoscopy two years late is not partially current.

`buildLiveScore` in `App.jsx` returns `undefined` when neither half has data, so the
locked "unlock your score" panel still shows rather than an honest-looking zero ring.

**`ProfileScreen.jsx`** — the Connected devices list is hard-coded (line 107) and its
buttons do nothing. Make it data-driven off `loadOuraStatus`:
- Oura: real Connect / "Synced 4m ago" + Disconnect.
- **Remove the "Google Fit" row entirely** — the API stopped accepting new developers in
  May 2024 and reaches end-of-service late 2026. It cannot be built.
- Mark Apple Health / Apple Watch as "Requires the mobile app" rather than "available";
  HealthKit has no cloud API and is unreachable from a web client. Offering a Connect
  button that can never work is worse than not listing it.
- Eight Sleep / WHOOP / Garmin / CGM: leave as "available" only if the roadmap is real.

**Test mode is unaffected.** `healthData` resolves to the snapshot when test mode is on
(`App.jsx:81`), so the demo persona keeps working exactly as-is and is still the
fallback for screenshots.

---

## 10. Security & compliance notes

- Consent is per-scope and revocable at Oura's end. If a refresh returns
  `invalid_grant`, set `status = 'revoked'`, stop syncing, and surface a reconnect
  prompt — don't retry in a loop.
- Disconnect must **delete** the token row and the webhook subscriptions, not just flag
  them. Offer deleting synced `wearable_daily` rows too.
- This is identifiable health data. It inherits whatever BAA/HIPAA posture the rest of
  GHAI has; worth confirming the Supabase project's tier covers it before real users
  connect.
- Don't log tokens, `object_id` payloads, or raw biometrics in function logs.

---

## 11. What's done, what's left

**Written and verified:** migration (applied), `_shared/crypto.ts`, `_shared/oura.ts`,
`_shared/admin.ts`, the six Edge Functions, `scripts/oura-webhook-subscriptions.mjs`,
`wearableShape.js` + `wearableStore.js`, `scoring.js` base items, `App.jsx` wiring,
`ProfileScreen` device UI. Production build passes; the mapping, encryption, baseline
and base-item logic are unit-tested.

**Left — needs credentials, which none of the above can be end-to-end tested without:**

1. Register the Oura app; set the secrets below.
2. Deploy the functions. Two of them take user-less inbound calls and **must** skip
   JWT verification, or Oura's redirect and handshake both fail:
   ```bash
   supabase functions deploy ghai-oura-connect
   supabase functions deploy ghai-oura-sync
   supabase functions deploy ghai-oura-status
   supabase functions deploy ghai-oura-disconnect
   supabase functions deploy ghai-oura-callback --no-verify-jwt
   supabase functions deploy ghai-oura-webhook --no-verify-jwt
   ```
3. `node scripts/oura-webhook-subscriptions.mjs create` (verifies the callback as a
   side effect — a good smoke test that step 2 worked).
4. Connect a real ring and confirm the backfill lands.
5. Schedule the nightly `ghai-oura-sync` with the cron secret, and monthly
   `oura-webhook-subscriptions.mjs renew`.
6. Submit the Oura app for review before real users — the 10-user cap is the only
   gate with an unknown wait.

## 12. Secrets to set

```
OURA_CLIENT_ID
OURA_CLIENT_SECRET
OURA_WEBHOOK_VERIFICATION_TOKEN   # any long random string; must match the script's env
OURA_TOKEN_KEY                    # openssl rand -base64 32
OURA_CRON_SECRET                  # guards the cron/webhook path into ghai-oura-sync
SITE_URL                          # redirect target after consent
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.

## 13. Open decisions for you

1. **Zone 2 proxy** — simple sum vs. MET time-series (§7). Recommend simple.
2. **Backfill window** — 30 days is enough for a 14-day baseline plus trend. Longer is
   cheap but slower on first connect.
3. **Multi-device precedence** — when Eight Sleep or WHOOP lands, which wins for a
   shared field like HRV? Worth deciding before a second source exists, not after.
4. **Approval timing** — submit the Oura app for review now, or after the client sees
   the demo? The 10-user cap doesn't block a demo, but the review has no stated SLA.

---

### Reference

- [Oura API v2 docs](https://api.ouraring.com/v2/docs) · [Oura Cloud / app registration](https://cloud.ouraring.com/docs)
- [Oura for Organizations — the API](https://partnersupport.ouraring.com/hc/en-us/articles/20949682312211-The-Oura-API)
- [Integration walkthrough](https://www.aifitnessapi.com/integrate/oura-api) · [Error handling](https://cloud.ouraring.com/docs/error-handling)

> Field names in §7 follow the documented v2 shapes; confirm each against a live
> response on the first backfill and adjust the mapper — that's why `raw` is stored.
