-- Product analytics for the scores and results screens (Oct 14 spec, "Analytics
-- events to log"): do members care about the scores, which systems draw interest,
-- does the simulator drive engagement, is "lab range vs target" useful, are results
-- taken to the doctor, how often do data gaps block a score.
--
-- One row per event, written by the member's own app with their JWT. Insert and read
-- own rows only; never updated or deleted through the API. The event list is fixed
-- here so a typo in the app can't invent a new event name.

create table if not exists ghai.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  event       text not null check (event in (
                'score_viewed', 'scorecard_system_opened', 'simulator_opened',
                'simulator_lever_tried', 'target_why_opened', 'discussion_export',
                'score_missing_prompt_shown')),
  props       jsonb not null default '{}'::jsonb check (pg_column_size(props) <= 2000)
);

comment on table ghai.analytics_events is
  'Product analytics for the score and results screens. Insert and read own rows only.';

create index if not exists analytics_events_event_idx on ghai.analytics_events (event, created_at desc);

alter table ghai.analytics_events enable row level security;

revoke all on ghai.analytics_events from anon, authenticated;
grant select, insert on ghai.analytics_events to authenticated;

create policy analytics_events_insert_own on ghai.analytics_events
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy analytics_events_read_own on ghai.analytics_events
  for select to authenticated
  using (user_id = (select auth.uid()));

-- In the SQL editor (reads as the table owner, so every member's rows):
--   select event, count(*), count(distinct user_id) as members
--   from ghai.analytics_events where created_at >= now() - interval '30 days'
--   group by event order by count(*) desc;
