-- Chat persistence — the AI conversation survives the session.
--
-- Until now the advocate's thread lived only in a React useState, so it was lost
-- the moment the member switched tabs: they could ask about a ferritin result,
-- leave to look something up, come back, and find an empty screen. That is the
-- exact failure mode that makes a health companion feel like a throwaway chatbot,
-- so every message is now stored permanently against the member and replayed into
-- the prompt on each turn.
--
-- Phase 1 is a single continuous conversation per member. `conversation_id` is
-- written now (one implicit thread) but not yet read, so phase 2 can introduce
-- separate named threads plus a history panel without a schema change.
--
-- Owner-only, following the same `<table>_owner_only` convention as the rest of
-- the ghai schema. Rows are written from the browser under the member's own JWT.
create table if not exists ghai.conversation_messages (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,

  -- Phase 2: the thread this message belongs to. Null = the single implicit
  -- conversation every phase-1 member has.
  conversation_id uuid,

  role            text not null check (role = any (array['user','assistant'])),
  text            text,

  -- Web-research sources for an assistant reply. Stored with the message because
  -- an answer that comes back without its citations is a different answer.
  citations       jsonb not null default '[]'::jsonb,

  -- Path in the private `health-docs` bucket for a photo the member attached.
  -- The image has to be stored, not just displayed: the whole thread is re-sent to
  -- the model every turn, so a photo from last week still has to reach it today.
  image_path      text,

  -- True for the "something went wrong" bubbles, so a transient gateway failure
  -- can be re-rendered as an error rather than replayed as if the AI said it.
  is_error        boolean not null default false,

  created_at      timestamptz not null default now()
);

comment on table ghai.conversation_messages is
  'Every message in a member''s AI advocate conversation, stored permanently and replayed into the prompt. Owner-only.';

create index if not exists conversation_messages_user_idx
  on ghai.conversation_messages (user_id, created_at);

alter table ghai.conversation_messages enable row level security;

grant select, insert, update, delete on ghai.conversation_messages to authenticated;

create policy conversation_messages_owner_only on ghai.conversation_messages
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
