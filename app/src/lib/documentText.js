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
import { readDocument } from "./agentsClient";
import { verifiedDate } from "./readCheck";
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

/**
 * Read a file to text for the record. Since Oct 22 2026 a PDF or a photo is read by
 * the care team on the agents service (agents/lib/ingest.mjs): the specialist reads
 * it with the document tools (the PDF's own text, or its pages rendered sharp), the
 * Fact Checker reads it independently, and any row the two reads don't agree on is
 * marked unclear rather than guessed. A text file is its own text and needs no read.
 *
 * @param {string} base64      the file's base64 payload (no data-URL prefix)
 * @param {string} mediaType   the browser-reported MIME type, which may be wrong or empty
 * @param {object} [opts]
 * @param {"labs"|"genetic"} [opts.kind]  which specialist reads it
 * @returns {Promise<{text: string, error: string|null, unclear: string[]}>}
 */
export async function extractDocumentText(base64, mediaType = "", { kind = "labs" } = {}) {
  if (!base64) return { text: "", error: "No file content.", unclear: [] };
  const cleanType = String(mediaType || "").toLowerCase();
  if (cleanType.startsWith("text/") || cleanType.includes("plain")) {
    const text = truncate(decodeBase64Text(base64));
    return { text, error: text ? null : "Couldn't read this text file.", unclear: [] };
  }
  try {
    const out = await readDocument({ kind, file: base64, mediaType, extract: false });
    if (!out.text) return { text: "", error: "No readable health content found in this file.", unclear: [] };
    return { text: truncate(out.text), error: null, unclear: out.unclear || [] };
  } catch (err) {
    console.error("extractDocumentText", err);
    return { text: "", error: err.message || "Reading failed.", unclear: [] };
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
    const read = parseNameReply(firstText(data, ""));
    // The test date places the document on the member's timeline: it stands only if
    // that date is printed in the text.
    return read ? { ...read, collectedOn: verifiedDate(read.collectedOn, source) } : read;
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
