-- Oura Ring integration — tables.
--
-- Three tables, two trust levels:
--   oura_connections / oura_oauth_states  service_role only. These hold OAuth
--     credentials; the browser must never read them, so RLS is enabled with NO
--     policy at all (deny-by-default) and the grants are revoked outright.
--   wearable_daily                        owner-readable, following the same
--     `<table>_owner_only` convention as the rest of the ghai schema. Writes come
--     from the sync function under service_role, so the policy is read-only.
--
-- wearable_daily is deliberately vendor-neutral: `source` is the only thing that
-- knows about Oura. A second device later means a new sync function, not a new table.

-- ---------------------------------------------------------------- token vault
create table if not exists ghai.oura_connections (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  -- Oura's own user id, from /v2/usercollection/personal_info. Webhook events
  -- identify the member by this, not by our user_id, so it must be indexed/unique.
  oura_user_id       text unique not null,
  access_token_enc   text not null,
  refresh_token_enc  text not null,
  token_expires_at   timestamptz not null,
  -- Scopes actually GRANTED (Oura lets the user decline individual ones at consent),
  -- not the scopes we asked for.
  scopes             text[] not null default '{}',
  status             text not null default 'connected',  -- connected | revoked | error
  last_sync_at       timestamptz,
  last_error         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table ghai.oura_connections is
  'Per-user Oura OAuth tokens (encrypted at the application layer). service_role only — never exposed to the browser.';

alter table ghai.oura_connections enable row level security;
revoke all on ghai.oura_connections from anon, authenticated;

-- ------------------------------------------------- CSRF state for the OAuth hop
-- The Oura callback lands as a plain browser redirect with no JWT, so the `state`
-- nonce is the only thing tying the returning request back to a signed-in user.
create table if not exists ghai.oura_oauth_states (
  nonce       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  return_to   text,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

comment on table ghai.oura_oauth_states is
  'Short-lived OAuth state nonces. Consumed (deleted) on callback; service_role only.';

alter table ghai.oura_oauth_states enable row level security;
revoke all on ghai.oura_oauth_states from anon, authenticated;

create index if not exists oura_oauth_states_expires_at_idx
  on ghai.oura_oauth_states (expires_at);

-- --------------------------------------------------- normalized daily wearable
create table if not exists ghai.wearable_daily (
  user_id                 uuid not null references auth.users(id) on delete cascade,
  day                     date not null,
  source                  text not null default 'oura',

  -- scores (0-100)
  sleep_score             int,
  readiness_score         int,
  activity_score          int,

  -- vitals. hrv_ms and resting_hr come from the nightly `sleep` session, NOT from
  -- readiness contributors (those are 0-100 scores, not physical units).
  hrv_ms                  numeric,
  resting_hr              int,
  average_hr              numeric,
  sleep_efficiency        numeric,   -- stored 0-1
  total_sleep_minutes     int,
  deep_sleep_minutes      int,
  rem_sleep_minutes       int,
  awake_minutes           int,
  temp_deviation_c        numeric,   -- can be negative
  spo2_percent            numeric,

  -- activity
  steps                   int,
  active_calories         int,
  high_activity_minutes   int,
  medium_activity_minutes int,
  -- Derived, not reported by Oura — Oura has no training-zone concept. Currently
  -- medium + high activity minutes (Oura's medium band is MET 4-7). See lib/oura.ts.
  zone2_minutes           int,

  -- Untouched Oura payloads, keyed by collection. A mapping bug is then fixable by
  -- reprocessing rather than re-fetching (which would burn rate limit and, for old
  -- days, may no longer be available).
  raw                     jsonb not null default '{}'::jsonb,
  synced_at               timestamptz not null default now(),

  primary key (user_id, day, source)
);

comment on table ghai.wearable_daily is
  'Vendor-neutral daily wearable rollup. Written by the sync functions (service_role), read by the app.';

alter table ghai.wearable_daily enable row level security;

-- Read-only for the owner: all writes go through the sync Edge Functions, so there
-- is no legitimate path for a browser to insert or edit a biometric row.
create policy wearable_daily_owner_only
  on ghai.wearable_daily
  for select
  using ((select auth.uid()) = user_id);

create index if not exists wearable_daily_user_day_idx
  on ghai.wearable_daily (user_id, day desc);
