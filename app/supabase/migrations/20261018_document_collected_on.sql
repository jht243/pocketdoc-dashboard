-- The day a document's test was actually done: the blood draw, the scan, the
-- visit. Read from the document itself when it is named.
--
-- Until now the Records list dated every file by when it was uploaded, so four
-- Quest panels drawn months apart all read "Aug 28, 2026" — the afternoon the
-- member happened to upload them. The upload time is a fact about our app; the
-- test date is the fact about the member's health, and it is the one that decides
-- which reading is the newest.
--
-- Nullable on purpose: a one-time report (a DNA test) or a document that names no
-- date has no test date, and a blank column says "we don't know" honestly. The
-- app falls back to the upload date, labelled as such.
alter table ghai.documents
  add column if not exists collected_on date;

comment on column ghai.documents.collected_on is
  'Collection, draw or visit date read from the document when it was named. Null when the document gives none. Distinct from created_at, which is the upload time.';
