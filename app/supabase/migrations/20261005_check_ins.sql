-- Morning check-in — one short daily survey per member.
--
-- The daily reason to open the app between blood draws (Morning Check-In spec,
-- Sep 24 docs; Sep 30 call). Each row is one member-day: the one-tap answers, the
-- optional free-text note, and the one-sentence reply the platform showed back.
-- Over a 16-week draw cycle these rows are the behavioural history the AI reads
-- next to the bloodwork.
--
-- `day` is the member's own local calendar date, not a UTC timestamp: the check-in
-- window (5–11 AM) and the streak are both defined in local time, and a member in
-- Los Angeles checking in at 7 AM must not land on "tomorrow".
--
-- A skipped day is stored as a row with `skipped = true` and no answers. Skips are
-- capped (2 per 14 days) in the app; storing them is what lets the streak survive one.
--
-- Owner-only, following the same `<table>_owner_only` convention as the rest of
-- the ghai schema. Rows are written from the browser under the member's own JWT.
create table if not exists ghai.check_ins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  day         date not null,
  answers     jsonb not null default '{}'::jsonb,
  note        text check (note is null or char_length(note) <= 140),
  skipped     boolean not null default false,
  response    text,
  created_at  timestamptz not null default now(),
  unique (user_id, day)
);

comment on table ghai.check_ins is
  'One morning check-in per member per local day: one-tap answers, optional note, and the reply shown. Owner-only.';

create index if not exists check_ins_user_day_idx
  on ghai.check_ins (user_id, day desc);

alter table ghai.check_ins enable row level security;

grant select, insert, update, delete on ghai.check_ins to authenticated;

create policy check_ins_owner_only on ghai.check_ins
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
