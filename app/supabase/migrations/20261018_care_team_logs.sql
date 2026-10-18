-- Two logs behind the care team: what the safety layer blocked, and who answered.
--
-- 1. ghai.safety_events: every time the safety layer blocks or rewrites something
--    before the member sees it. The Oct 14 spec (and agents/DESIGN.md step 7):
--    "Blocked outputs are logged for weekly medical director review." Adam is the
--    acting medical director; the view at the bottom is his weekly list.
--      fact_check    the Fact-Checker flagged the draft and it was revised
--      rule_rewrite  a forbidden-output rule (dose, med change, diagnosis) was broken
--                    and the reply was rewritten by the model
--      rule_scrub    the rewrites did not clear it, so sentences were cut in code
--      crisis        crisis language: the team was skipped and the 988 line sent
--      emergency     a fresh Section 9 value: the team was skipped and the
--                    hard-coded emergency message sent
--
-- 2. ghai.agent_runs: one row per answered question: which specialists ran, whether
--    the General agent took it, and whether the answer fell back to "let's bring this
--    to your clinician". The spec's point: the most common fallback topics decide
--    which agent gets built next.
--
-- Both are written with the MEMBER'S OWN JWT, from the agents service (PostgREST,
-- which holds no service-role key) and from the browser fallback. So a member may
-- insert and read their own rows, and nobody may update or delete one through the
-- API: a log a member could edit is not a log. user_id defaults to auth.uid(), so the
-- writer never has to send it, and the policy refuses anyone else's id.
--
-- message_id is the member's question in ghai.conversation_messages, when the app
-- had stored it. No foreign key on purpose: deleting a conversation must not delete
-- or rewrite the safety record of it.

create table if not exists ghai.safety_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  source      text not null check (source in ('agents', 'browser')),
  kind        text not null check (kind in ('fact_check', 'rule_rewrite', 'rule_scrub', 'crisis', 'emergency')),
  rule        text check (rule is null or char_length(rule) <= 1000),
  excerpt     text check (excerpt is null or char_length(excerpt) <= 1000),
  question    text check (question is null or char_length(question) <= 1000),
  message_id  uuid
);

comment on table ghai.safety_events is
  'Every reply the safety layer blocked or rewrote, for the weekly medical-director review. Insert and read own rows only; never updated or deleted through the API.';
comment on column ghai.safety_events.excerpt is 'The offending text as the model wrote it, capped at about 500 characters by the writer.';
comment on column ghai.safety_events.message_id is 'The member''s question in ghai.conversation_messages, when stored. No FK, so the log outlives a deleted thread.';

create index if not exists safety_events_created_idx on ghai.safety_events (created_at desc);
create index if not exists safety_events_user_idx on ghai.safety_events (user_id, created_at desc);

alter table ghai.safety_events enable row level security;

revoke all on ghai.safety_events from anon, authenticated;
grant select, insert on ghai.safety_events to authenticated;

create policy safety_events_insert_own on ghai.safety_events
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy safety_events_read_own on ghai.safety_events
  for select to authenticated
  using (user_id = (select auth.uid()));


create table if not exists ghai.agent_runs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  source       text not null default 'agents' check (source in ('agents', 'browser')),
  -- team: the specialists ran. crisis / emergency: code answered and no agent ran.
  path         text not null default 'team' check (path in ('team', 'crisis', 'emergency')),
  question     text check (question is null or char_length(question) <= 1000),
  specialists  text[] not null default '{}',
  general      boolean not null default false,
  fallback     boolean not null default false,
  -- What the General agent called an out-of-scope question ("skin rash",
  -- "knee injury"), so fallbacks can be counted by topic.
  topic        text check (topic is null or char_length(topic) <= 120),
  seconds      numeric,
  cost_usd     numeric(10, 4),
  model_calls  integer,
  message_id   uuid
);

comment on table ghai.agent_runs is
  'One row per answered chat question: which agents ran, and whether it fell back to "bring this to your clinician". Insert and read own rows only.';

create index if not exists agent_runs_created_idx on ghai.agent_runs (created_at desc);
create index if not exists agent_runs_fallback_idx on ghai.agent_runs (created_at desc) where fallback;

alter table ghai.agent_runs enable row level security;

revoke all on ghai.agent_runs from anon, authenticated;
grant select, insert on ghai.agent_runs to authenticated;

create policy agent_runs_insert_own on ghai.agent_runs
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy agent_runs_read_own on ghai.agent_runs
  for select to authenticated
  using (user_id = (select auth.uid()));


-- The weekly review lists. Run them in the Supabase SQL editor, which reads as the
-- table owner and so sees every member's rows:
--
--   select * from ghai.safety_review_last_week;
--   select * from ghai.fallback_topics_last_30_days;
--
-- And the week at a glance, by rule:
--
--   select kind, rule, count(*) from ghai.safety_review_last_week
--   group by kind, rule order by count(*) desc;
--
-- security_invoker means a member querying these through the API would see only
-- their own rows anyway; the grants are revoked so the API does not offer them.

create or replace view ghai.safety_review_last_week
  with (security_invoker = true) as
select
  e.created_at,
  e.source,
  e.kind,
  e.rule,
  e.excerpt,
  e.question,
  e.user_id,
  e.message_id
from ghai.safety_events e
where e.created_at >= now() - interval '7 days'
order by e.created_at desc;

comment on view ghai.safety_review_last_week is
  'Last 7 days of blocked or rewritten replies, newest first, for the weekly medical-director review.';

create or replace view ghai.fallback_topics_last_30_days
  with (security_invoker = true) as
select
  coalesce(nullif(lower(trim(r.topic)), ''), '(no topic named)') as topic,
  count(*) as questions,
  max(r.created_at) as last_asked,
  (array_agg(r.question order by r.created_at desc))[1:3] as examples
from ghai.agent_runs r
where r.fallback and r.created_at >= now() - interval '30 days'
group by 1
order by questions desc;

comment on view ghai.fallback_topics_last_30_days is
  'Out-of-scope questions the General agent sent to the clinician, by topic: which agent to build next.';

revoke all on ghai.safety_review_last_week from anon, authenticated;
revoke all on ghai.fallback_topics_last_30_days from anon, authenticated;
