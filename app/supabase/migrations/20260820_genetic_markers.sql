-- Genetic markers — the structured genome data extracted from an uploaded
-- genetic report (AncestryDNA / 23andMe raw file, or a longevity/PGx report PDF).
--
-- Until now the genetic-import path stored the source file and then ran the
-- *lab-marker* extractor over it, so no genome ever reached the user's profile;
-- the Genetic Profile screen only ever showed illustrative demo data. This table
-- is the missing home for real per-user genomes and the interpretive notes that
-- come with them.
--
-- Owner-only, following the same `<table>_owner_only` convention as the rest of
-- the ghai schema. Rows are written from the browser under the user's own JWT
-- (the extraction + confirm happens client-side), so the policy is full CRUD
-- scoped to the row owner.
create table if not exists ghai.genetic_markers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- The report this genome was read out of, so a re-import can supersede the
  -- prior extraction and the profile can link back to the source document.
  document_id   uuid references ghai.documents(id) on delete set null,

  -- lifestyle = supplement/lifestyle-actionable; pharma = pharmacogenomic (drug
  -- metabolism). The Genetic Profile screen splits its two tabs on this.
  category      text not null default 'lifestyle'
                  check (category = any (array['lifestyle','pharma'])),

  gene          text not null,                 -- e.g. "MTHFR", "CYP2D6"
  variant       text,                          -- human label, e.g. "C677T heterozygous"
  genotype      text,                          -- raw call if present, e.g. "CT"
  rsid          text,                          -- dbSNP id if the report gives one

  -- favorable/normal = no concern; variant = actionable difference; watch = higher
  -- stakes / follow-up; unknown = reported but not interpreted.
  status        text not null default 'unknown'
                  check (status = any (array['normal','favorable','variant','watch','unknown'])),
  -- Informative | Moderate | Clinical | Watch — drives the card's emphasis.
  impact        text,

  title         text,                          -- one-line headline for the marker
  summary       text,                          -- "what this is" explanation
  -- The interpretive NOTES the report itself provides for this genome. This is
  -- the "notes for the genome" the product must preserve verbatim rather than
  -- paraphrase away — it is what the report actually told the user.
  notes         text,
  -- Structured, actionable follow-ups. lifestyle → ["take methylfolate…", …];
  -- pharma → [{ "name": "Codeine", "note": "reduced conversion…" }, …].
  recommendations jsonb not null default '[]'::jsonb,
  medications     jsonb not null default '[]'::jsonb,
  -- Compact line the AI advocate injects into its health context.
  ai_context    text,

  source        text,                          -- e.g. "AncestryDNA", "23andMe"
  -- The user reviews the AI extraction before it lands; true once they've kept it.
  confirmed     boolean not null default true,
  created_at    timestamptz not null default now()
);

comment on table ghai.genetic_markers is
  'Per-user genetic markers extracted from an uploaded genetic report, with the report''s own interpretive notes preserved. Owner-only.';

create index if not exists genetic_markers_user_idx
  on ghai.genetic_markers (user_id, created_at desc);

alter table ghai.genetic_markers enable row level security;

grant select, insert, update, delete on ghai.genetic_markers to authenticated;

create policy genetic_markers_owner_only on ghai.genetic_markers
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
