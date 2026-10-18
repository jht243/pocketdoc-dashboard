-- In-app screening questionnaires: the four USPSTF screenings that are questions
-- rather than tests, run inside the app from Preventive care.
--
--   phq2         PHQ-2, depression                       0–6, positive at 3+
--   gad2         GAD-2, anxiety                          0–6, positive at 3+
--   auditc       AUDIT-C, unhealthy alcohol use          0–12, positive at 4+ (men) / 3+ (women)
--   single_drug  NIDA single-question drug screen        times in the past year, positive at 1+
--
-- Scoring lives in src/lib/screeningQuestionnaires.js. Completing one also marks the
-- matching ghai.screenings row done for that month, through the same path as any
-- other tick on Preventive care; this table keeps what was answered and how it
-- scored, which the screenings row has no room for.
--
-- Its own table rather than a JSON column on ghai.screenings: that table holds one
-- row per schedule item, so a second PHQ-2 next year would overwrite the first, and
-- a member's answer history is exactly what a clinician wants to see.
--
-- One row per completion. Written and read from the browser with the member's own
-- JWT. Owner-only, like the rest of the ghai schema; insert and read only — a
-- completed questionnaire is a record, not a draft.

create table if not exists ghai.screening_questionnaires (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  instrument    text not null check (instrument in ('phq2', 'gad2', 'auditc', 'single_drug')),
  schedule_key  text not null check (schedule_key in ('depression', 'anxiety', 'alcohol', 'drug_use')),
  answers       jsonb not null default '{}'::jsonb,   -- question id → the item's scored value
  score         integer not null check (score >= 0),
  positive      boolean not null,
  cutoff        integer,                               -- the threshold applied (AUDIT-C is sex-specific)
  completed_on  date not null default current_date,    -- the member's local day
  created_at    timestamptz not null default now()
);

comment on table ghai.screening_questionnaires is
  'Completed in-app screening questionnaires (PHQ-2, GAD-2, AUDIT-C, single-question drug screen): answers, score and whether positive. Owner-only.';

create index if not exists screening_questionnaires_user_idx
  on ghai.screening_questionnaires (user_id, completed_on desc);

alter table ghai.screening_questionnaires enable row level security;

revoke all on ghai.screening_questionnaires from anon, authenticated;
grant select, insert on ghai.screening_questionnaires to authenticated;

create policy screening_questionnaires_owner_only on ghai.screening_questionnaires
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Same release: ghai.screenings.urgency used to hold an age-based guess for items
-- nobody had recorded ("overdue" two years past the start age). The app now says
-- "Not on file" for those and writes null; "overdue" / "due_soon" are kept only for
-- a recorded date past (or near) its interval. Clear the old guesses so nothing
-- reading the table directly sees a never-recorded screening as overdue. The app
-- rewrites every row on the member's next save anyway; this only makes it true now.
update ghai.screenings
   set urgency = null, updated_at = now()
 where completed_at is null
   and urgency in ('overdue', 'due_soon', 'upcoming');
