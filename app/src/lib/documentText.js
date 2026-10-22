/**
 * Read an uploaded health document into plain text the AI advocate can use.
 *
 * Structured extraction (lab markers, genomes) is still the primary path — it's
 * reviewable, trendable and scoreable. But it only captures what fits its schema.
 * A longevity report's narrative, a doctor's note, a radiology impression, the
 * interpretation paragraph under a lab table: none of that survives extraction to
 * `{name, value, unit}`, and until now none of it reached the chat, which saw the
 * file name alone.
 *
 * So: transcribe the whole document once at upload, store it, and give the model
 * the document itself.
 */
import { callAI, firstText } from "./api";
import { renameDocument } from "./profileStore";
import { openPdf, renderPages, MAX_PAGES } from "./pdfRead";
import { applyTieBreak, checkDates, hasUsableText, reconcile, untracedAgainst } from "./readCheck";
import { cleanName, needsContentName, needsNaming, parseNameReply } from "./documentNames";

export { needsContentName, needsNaming } from "./documentNames";

/**
 * How much of one document we keep.
 *
 * Generous — a full lab panel with interpretation runs long, and truncating the
 * middle of a report is how the AI ends up confidently discussing half a result.
 * The chat applies its own, tighter budget when assembling context; this is the
 * storage cap.
 */
export const MAX_DOCUMENT_CHARS = 24000;

const TRANSCRIBE_PROMPT = `You are transcribing a health document (a lab report, genetic report, longevity report, imaging report, or clinical note) into plain text for a health record.

Rules:
- Transcribe what the document actually says. Do not summarize, interpret, add, or omit.
- Keep every numeric result with its unit and reference range, and keep results in the order they appear.
- Render tables as one line per row: "Marker: value unit (reference range) — flag".
- Keep section headings, the collection/report date, the ordering provider, and the lab or company name.
- Preserve any narrative interpretation, impression, or recommendation text verbatim — it matters as much as the numbers.
- Output the transcription only. No preamble, no commentary, no markdown fences.
- If the document contains nothing health-related, output exactly: NO_CONTENT`;

/** A .txt upload (e.g. a raw genotype export) needs no model — just decode it. */
function decodeBase64Text(base64) {
  try {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch (err) {
    console.error("decodeBase64Text", err);
    return "";
  }
}

function truncate(text) {
  const clean = String(text || "").trim();
  if (clean.length <= MAX_DOCUMENT_CHARS) return clean;
  // Say so in the text itself. A silently cut-off document reads to the model as a
  // complete one, and it will draw conclusions from a report that simply stops.
  return `${clean.slice(0, MAX_DOCUMENT_CHARS)}\n\n[Transcription truncated — this document is longer than the health record stores in full.]`;
}

/**
 * Pull a stored file back down as base64, for documents uploaded before they were
 * being transcribed — the file is in the bucket, but nothing ever read it.
 *
 * @param {string} url  a short-lived signed URL from getDocumentUrl()
 */
export async function fetchAsBase64(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Couldn't download the stored file (${response.status}).`);
  const buffer = new Uint8Array(await response.arrayBuffer());
  // Chunked so a multi-megabyte PDF doesn't blow the argument limit on apply().
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buffer.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, buffer.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// The second read is written differently on purpose: the same prompt twice tends to
// make the same mistake twice. It lists rows only, so the two reads are compared row
// by row (readCheck.js).
const SECOND_READ_PROMPT = `You are checking a transcription of a health document. Read the document yourself, independently.

List every result row exactly as printed, one per line: "Name: value unit (reference range)". Copy every digit, decimal point, unit and range character by character. Also write every date printed on the document (collection, report, received) on its own line, as printed. Do not add rows that are not printed, do not skip rows, do not correct or round anything. If a value cannot be read with certainty, write "Name: UNREADABLE". Output the lines only.`;

const TIE_PROMPT = `Two careful reads of this health document disagreed about the rows listed below. Look at the document and, for each row, write exactly what is printed: "Name: value unit (reference range)", character by character. If a row is not on the document, write "Name: NOT ON DOCUMENT". If you cannot read it with certainty, write "Name: UNREADABLE". Output one line per row, nothing else.`;

const pageBlocks = (pages) => pages.map((url) => {
  const [, mediaType, data] = /^data:([^;]+);base64,(.*)$/.exec(url) || [];
  return { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data }, detail: "high" };
});

async function read(system, blocks, ask, maxTokens = 8192) {
  const data = await callAI({ system, messages: [{ role: "user", content: [...blocks, { type: "text", text: ask }] }], maxTokens });
  return firstText(data, "").trim();
}

/**
 * A scan or a photo, read twice and reconciled (readCheck.js). Rows the two reads
 * disagree on, or that only one of them saw, get a third, targeted read; a value two
 * reads agree on is kept, anything else is marked unclear and never becomes a result.
 */
async function readChecked(blocks) {
  const first = await read(TRANSCRIBE_PROMPT, blocks, "Transcribe this document to plain text.");
  if (!first || first === "NO_CONTENT") return { text: first, unclear: [] };
  const second = await read(SECOND_READ_PROMPT, blocks, "List every result row exactly as printed.", 4096);
  const found = reconcile(first, second);
  let settled = { text: first, unclear: [] };
  if (found.disputed.length || found.missing.length) {
    const rows = [...found.disputed.map((d) => d.primary), ...found.missing];
    const third = await read(TIE_PROMPT, blocks, `Rows to read:\n${rows.join("\n")}`, 2048).catch(() => "");
    settled = applyTieBreak(first, found, third);
  }
  // A date only one read saw is not trusted either: it places the panel in time.
  const dated = checkDates(settled.text, second);
  return { text: dated.text, unclear: settled.unclear };
}

/**
 * A PDF's own text, reformatted into the transcription layout. The text layer is the
 * document's characters, so a number the model changed or added while reformatting is
 * caught here, and the raw text is kept instead.
 */
async function fromTextLayer(layer) {
  const shaped = await read(TRANSCRIBE_PROMPT, [{ type: "text", text: `The document's own text, extracted from the PDF (rows are in printed order; columns are separated by spaces):\n\n${layer}` }], "Transcribe this document to plain text, keeping every number exactly as it appears above.");
  if (!shaped || shaped === "NO_CONTENT") return shaped;
  return untracedAgainst(shaped, layer).length ? layer : shaped;
}

/**
 * @param {string} base64      the file's base64 payload (no data-URL prefix)
 * @param {string} mediaType   the browser-reported MIME type, which may be wrong or empty
 * @returns {Promise<{text: string, error: string|null, unclear: string[]}>}
 *   `unclear`: rows that could not be read with certainty, by name. They are marked as
 *   unclear in the text and are never recorded as results.
 */
export async function extractDocumentText(base64, mediaType = "") {
  if (!base64) return { text: "", error: "No file content.", unclear: [] };

  const cleanType = String(mediaType || "").toLowerCase();
  const isText = cleanType.startsWith("text/") || cleanType.includes("plain");
  const isImage = cleanType.startsWith("image/") && !cleanType.includes("pdf");

  if (isText) {
    const text = truncate(decodeBase64Text(base64));
    return { text, error: text ? null : "Couldn't read this text file.", unclear: [] };
  }

  try {
    let result;
    if (isImage) {
      result = await readChecked([{ type: "image", source: { type: "base64", media_type: cleanType, data: base64 }, detail: "high" }]);
    } else {
      // Anything that isn't clearly an image is treated as a PDF: `file.type` is empty
      // or wrong often enough on mobile that trusting it loses whole documents.
      const pdf = await openPdf(base64).catch((err) => { console.warn("openPdf", err); return null; });
      if (pdf && hasUsableText(pdf.text)) {
        result = { text: await fromTextLayer(pdf.text), unclear: [] };
      } else if (pdf) {
        result = await readChecked(pageBlocks(await renderPages(pdf)));
      } else {
        // pdf.js couldn't open it: the file itself, still read twice and checked.
        result = await readChecked([{ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }]);
      }
      if (pdf && pdf.pageCount > pdf.read && result.text) {
        result.text = `${result.text}\n\n[Only the first ${MAX_PAGES} of ${pdf.pageCount} pages were read.]`;
      }
    }
    const raw = String(result.text || "").trim();
    if (!raw || raw === "NO_CONTENT") {
      return { text: "", error: "No readable health content found in this file.", unclear: [] };
    }
    return { text: truncate(raw), error: null, unclear: result.unclear || [] };
  } catch (err) {
    console.error("extractDocumentText", err);
    return { text: "", error: err.message || "Extraction failed.", unclear: [] };
  }
}

const NAME_PROMPT = `You name health documents for a member's records list, and read off the date the test was done.

Return ONLY JSON, no other text, no markdown, in exactly this shape:
{"title": "...", "collected_on": "YYYY-MM-DD" or null}

"title" is short — it has to fit one line on a phone. Shape it as:
  [Company] [short type]
with NO date in it. Examples:
  "Quest Bloodwork", "Labcorp Bloodwork", "Rhythm Bloodwork", "Function Health Bloodwork",
  "Cardiology Visit Note", "Chest X-Ray Report", "AncestryDNA Longevity Report",
  "23andMe Raw Genotype Data", "Prenuvo MRI Report".

Title rules:
- Any blood test or lab panel — one panel or many, annual or not — is "[Company] Bloodwork". Never "Annual", never "Blood Panel", never a list of the panels it covers.
- Use the short name the company goes by ("Quest", not "Quest Diagnostics Nichols Institute"; "Labcorp", not "Laboratory Corporation of America").
- Other documents get a short type of two or three words ("Visit Note", "X-Ray Report", "Genotype Data").
- Omit the company if the document doesn't name one.
- Never include the patient's name, date of birth, account, accession, claim or order numbers, or any other identifier.
- No date, no file extension, no trailing punctuation.
- If you can't tell what the document is, use "UNKNOWN".

"collected_on" is the day the test was done: the specimen collection or draw date for labs, the exam date for imaging, the visit date for a clinical note. Use it over a report, received or print date when both are given; use the report date only if it is the only date. Never use a date of birth. null if the document gives no such date, and null for one-time genetic or DNA reports. Never invent a date.`;

/** How much of a transcription the namer sees — the header holds everything a name needs. */
const NAME_SOURCE_CHARS = 4000;

/**
 * A human name for a document, read from its transcription — what the member would
 * call it, instead of "IMG_4821.HEIC" or "R0034492_final(2).pdf" — plus the day its
 * test was done, read in the same call.
 *
 * @returns {Promise<{title: string|null, collectedOn: string|null}|null>} null when
 *   the call failed (worth trying again on another visit); a null `title` when the
 *   model read the document and couldn't say what it is
 */
export async function nameDocument(text) {
  const source = String(text || "").trim().slice(0, NAME_SOURCE_CHARS);
  if (!source) return null;
  try {
    const data = await callAI({
      system: NAME_PROMPT,
      messages: [{ role: "user", content: [{ type: "text", text: `Document transcription:\n\n${source}` }] }],
      maxTokens: 80,
    });
    return parseNameReply(firstText(data, ""));
  } catch (err) {
    // A document keeping its upload name is a cosmetic miss, never a reason to fail
    // the read that produced the text.
    console.error("nameDocument", err);
    return null;
  }
}

/**
 * Name a stored document from its transcription and save the name and test date.
 *
 * @returns {Promise<{name: string, collectedOn: string|null}|null>} what was saved,
 *   or null if the document kept the name it had
 */
export async function nameStoredDocument(document, text) {
  if (!document?.id || !text || !needsNaming(document)) return null;
  const redo = !needsContentName(document.file_name);
  const read = await nameDocument(text);
  if (!read) return null;
  let name = read.title;
  if (!name) {
    // An upload name stays until a later read can do better. An old dated name has
    // already said what the document is, so it keeps that minus the date — otherwise
    // a document the model can't place would be re-read on every visit.
    if (!redo) return null;
    name = cleanName(document.file_name);
    if (!name) return null;
  }
  const { error } = await renameDocument(document.id, name, { collectedOn: read.collectedOn });
  return error ? null : { name, collectedOn: read.collectedOn };
}
