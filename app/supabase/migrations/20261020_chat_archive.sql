-- Archived conversations: the chat can be cleared without losing it.
--
-- Until now the only way to start fresh was the trash button, which deletes the
-- thread for good. Dr. Locker (Oct 20): "maybe we need to have an archive button so
-- that certain things don't leave the chat". Archiving moves the open thread into a
-- conversation of its own: off the chat screen and out of what the advocate replays,
-- but kept, readable, restorable, and still read by the insight cards.
--
-- This is the `conversation_id` column the phase 1 migration (20260822) left for
-- separate threads. Null is still the open conversation; a message with a
-- conversation id belongs to an archived one.
create table if not exists ghai.conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- The member's first question in the thread, clipped: no model call to name it.
  title       text,
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);

comment on table ghai.conversations is
  'A member''s archived AI advocate conversations. Messages point here through conversation_messages.conversation_id; null there is the open thread. Owner-only.';

create index if not exists conversations_user_idx
  on ghai.conversations (user_id, archived_at desc);

alter table ghai.conversations enable row level security;

grant select, insert, update, delete on ghai.conversations to authenticated;

create policy conversations_owner_only on ghai.conversations
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Deleting an archived conversation deletes its messages. Phase 1 never wrote a
-- conversation id, so every existing row is null and satisfies this.
alter table ghai.conversation_messages
  add constraint conversation_messages_conversation_fk
  foreign key (conversation_id) references ghai.conversations(id) on delete cascade;

create index if not exists conversation_messages_conversation_idx
  on ghai.conversation_messages (conversation_id, created_at);
