-- Care team trace on AI replies.
--
-- A reply from the Healthcare Advocate is now the end of a short care-team round:
-- the Advocate picks specialist advocates, each reports, they compare notes, and a
-- safety review runs before the member sees the answer. The chat draws that round,
-- and this column keeps its event log with the reply so a reloaded thread can still
-- show who was consulted and what each one said.
--
-- Null for member messages, for photo replies (which skip the team), and for every
-- reply written before this column existed.
alter table ghai.conversation_messages
  add column if not exists team jsonb;
