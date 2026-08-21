-- Wearable health score — persistence.
--
-- Two things get stored that previously existed only for as long as a render:
--
--   1. wearable_daily gains the computed wearable sub-score. The sync worker writes
--      it on every sync, so the breakdown a member reads is the one that was
--      calculated against the baseline as it stood that day — not a recomputation
--      against a baseline that has since moved. `score_detail` holds the FULL result
--      object (per-metric tiers, deviations, floors, alerts, confidence, the Oura
--      sanity check), because a score you can't explain after the fact is a number,
--      not a clinical record.
--
--   2. health_score_daily records the combined Health Score — wearable + bloodwork +
--      preventive care — one row per member per day, so the overall number has a
--      history of its own rather than being recomputed from whatever today's inputs
--      happen to be.
--
-- Vendor-neutral throughout, matching wearable_daily: nothing here says "Oura".

-- ------------------------------------------------ the wearable sub-score (0-50)
alter table ghai.wearable_daily
  add column if not exists wearable_score       numeric,      -- 0-50, daily + trend
  add column if not exists wearable_daily_score numeric,      -- 0-35 component
  add column if not exists wearable_trend_score numeric,      -- 0-15 component
  add column if not exists score_label          text,         -- Excellent | Good | Fair | Low | Critical
  add column if not exists score_confidence     int,          -- 35-100, data-quality confidence
  add column if not exists score_version        text,         -- rubric version the score was computed under
  add column if not exists score_detail         jsonb,        -- the full result object
  add column if not exists score_computed_at    timestamptz;

comment on column ghai.wearable_daily.wearable_score is
  'Computed wearable sub-score (0-50) for this day: 35-point daily component plus 15-point trend component, scored against the member''s own rolling baseline. Written by the sync worker.';
comment on column ghai.wearable_daily.score_confidence is
  'Data-quality confidence (35-100) derived from how many days of baseline history existed when this score was computed. Disclosed to the member.';
comment on column ghai.wearable_daily.score_detail is
  'Full scoring result: per-metric value/baseline/deviation/tier/points, safety-floor overrides, generated alerts, and the Oura-readiness sanity check.';

-- Finding the days that still need scoring (a backfill, or a rubric version bump)
-- without scanning every biometric row anyone has ever synced.
create index if not exists wearable_daily_unscored_idx
  on ghai.wearable_daily (user_id, day desc)
  where wearable_score is null;

-- Alert lookups run across members ("who tripped a clinical floor last night"), so
-- the alert array inside score_detail needs to be reachable without a full scan.
create index if not exists wearable_daily_alerts_idx
  on ghai.wearable_daily using gin ((score_detail -> 'alerts'));

-- ------------------------------------------------- the combined Health Score
create table if not exists ghai.health_score_daily (
  user_id           uuid not null references auth.users(id) on delete cascade,
  day               date not null,

  -- The three components of the overall score. Each is nullable: a member with no
  -- wearable connected still has a preventive-care score worth recording, and
  -- storing 0 for "not measured" would be a lie the history could never undo.
  wearable_score    numeric,   -- 0-50, copied from wearable_daily for this day
  bloodwork_score   numeric,   -- 0-50, lab markers vs clinical thresholds; null when
                               -- the panel is too thin or too old to score
  preventive_score  numeric,   -- 0-50, preventive-care coverage

  total_score       numeric not null,
  total_max         numeric not null,
  label             text,
  -- Component breakdown as rendered, so the score is explainable later even after
  -- the schedule, the rubric or the member's data have all moved on.
  detail            jsonb not null default '{}'::jsonb,
  score_version     text,
  computed_at       timestamptz not null default now(),

  primary key (user_id, day)
);

comment on table ghai.health_score_daily is
  'Daily history of the combined Health Score (wearable + bloodwork + preventive care), one row per member per day.';

alter table ghai.health_score_daily enable row level security;

-- Owner read/write. Unlike wearable_daily — where every row is a biometric fact that
-- must only ever come from a sync worker — this table is a derived summary of data
-- the member already owns, so the app writes it directly as the score is computed.
create policy health_score_daily_owner_select
  on ghai.health_score_daily for select
  using ((select auth.uid()) = user_id);

create policy health_score_daily_owner_insert
  on ghai.health_score_daily for insert
  with check ((select auth.uid()) = user_id);

create policy health_score_daily_owner_update
  on ghai.health_score_daily for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on ghai.health_score_daily to authenticated;

create index if not exists health_score_daily_user_day_idx
  on ghai.health_score_daily (user_id, day desc);
