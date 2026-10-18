-- Chat messages written while a member had Test mode on (removed 2026-10-18).
-- Those answers quote the demo profile ("vitamin D 28", "TPO 118", rosuvastatin),
-- not the member, and the members' own questions were asked about that demo data.
-- Nothing is deleted: the member can still read them behind a labelled divider,
-- but the care team's history and the insight cards no longer read them.
alter table ghai.conversation_messages
  add column if not exists from_test_mode boolean not null default false;

comment on column ghai.conversation_messages.from_test_mode is
  'Written while the member had Test mode on (removed 2026-10-18): answers quote the demo profile, not the member. Kept for the member to read; excluded from AI context and insights.';

-- The three accounts with chat history from Test mode (the fourth never chatted),
-- every message before the removal deploy.
update ghai.conversation_messages
set from_test_mode = true
where created_at < '2026-10-18 18:30:00+00'
  and user_id in (
    select id from auth.users
    where id::text like '5bec91b8%' or id::text like 'f8b8d1f0%' or id::text like 'e695b196%'
  );
