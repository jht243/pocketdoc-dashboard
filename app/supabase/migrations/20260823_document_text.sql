-- Full text of an uploaded document, so the AI advocate can actually read it.
--
-- Until now an upload produced a storage object and a `documents` row holding a
-- file name, and that file name was the ONLY thing that reached the chat's health
-- context. The model was shown "Longevity Report.pdf" and nothing else, so it
-- answered questions about bloodwork it had never seen — confidently, because it
-- knew the file existed.
--
-- Structured extraction (lab_markers, genetic_markers) stays the primary path:
-- markers are reviewable, trendable and scoreable. This column is for everything
-- extraction throws away — the narrative of a longevity report, a radiologist's
-- impression, a physician's note — which is often the part the member is asking
-- about.
alter table ghai.documents
  add column if not exists extracted_text text,
  add column if not exists extracted_at   timestamptz,
  -- Kept so a failed read is visible in the UI as "couldn't read this file"
  -- rather than looking identical to a file nobody has opened yet.
  add column if not exists extract_error  text;

comment on column ghai.documents.extracted_text is
  'Plain-text transcription of the uploaded file, injected into the AI health context so the model reads the document itself rather than only its file name.';
