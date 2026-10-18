-- Provider follow-ups: the open loops a care-team answer leaves behind.
--
-- When an answer's routing lanes (agents/lib/escalation.mjs, from the escalation
-- matrix) put a marker in "Bring this to your provider", the app opens one
-- follow-up for it. Thirty days on, if it is still open, the morning check-in asks
-- once: "Have you had a chance to discuss your <marker> with your healthcare
-- provider?" Yes / No / Scheduled. At sixty days, still open, it asks again with
-- "It's still waiting". The rules live in src/lib/followUps.js.
--
--   open       raised, not yet discussed (a "No" leaves it open)
--   discussed  the member said Yes
--   scheduled  the member has an appointment booked; the check-in stops asking
--   dismissed  closed without an answer (reserved for a later "not relevant" control)
--
-- One open item per marker: the partial unique index makes a second open row for
-- the same marker fail, so two answers racing each other cannot duplicate it. A
-- closed item for the same reading is not reopened; a newer draw that still lands
-- in the provider lane opens a new one (reading_date tells them apart).
--
-- Written and read from the browser with the member's own JWT. Owner-only, like the
-- rest of the ghai schema; no delete through the API.

create table if not exists ghai.follow_ups (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  marker         text not null,                 -- escalation-matrix id, e.g. 'ferritin'
  marker_name    text not null,                 -- as the member sees it, e.g. 'Ferritin'
  lane_reason    text check (lane_reason is null or char_length(lane_reason) <= 1000),
  level          text check (level is null or level in ('flag', 'immediate')),
  reading        text,                          -- e.g. '12 ng/mL'
  reading_date   text,                          -- the draw date as the lab card shows it
  created_at     timestamptz not null default now(),
  status         text not null default 'open' check (status in ('open', 'discussed', 'scheduled', 'dismissed')),
  due_30         date not null,
  due_60         date not null,
  last_answer    text check (last_answer is null or last_answer in ('yes', 'no', 'scheduled')),
  last_asked_on  date,                          -- the member's local day they last answered
  updated_at     timestamptz not null default now()
);

comment on table ghai.follow_ups is
  'Open loops from provider-lane markers in care-team answers; asked about in the morning check-in at 30 and 60 days. Owner-only.';

create unique index if not exists follow_ups_one_open_per_marker
  on ghai.follow_ups (user_id, marker) where status = 'open';

create index if not exists follow_ups_user_idx
  on ghai.follow_ups (user_id, created_at desc);

-- updated_at follows every change, whoever writes it.
create or replace function ghai.follow_ups_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function ghai.follow_ups_touch() from public, anon, authenticated;

drop trigger if exists follow_ups_touch on ghai.follow_ups;
create trigger follow_ups_touch
  before update on ghai.follow_ups
  for each row execute function ghai.follow_ups_touch();

alter table ghai.follow_ups enable row level security;

revoke all on ghai.follow_ups from anon, authenticated;
grant select, insert, update on ghai.follow_ups to authenticated;

create policy follow_ups_owner_only on ghai.follow_ups
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
