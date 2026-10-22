/**
 * A PDF, opened in the browser (pdf.js): its own text layer, and its pages as sharp
 * images for a scan that has none.
 *
 * Sending the PDF file to the model let it see a scanned page only at low resolution:
 * it copied a report's large header exactly and guessed the small digits (Oct 21
 * 2026). A text layer is the document's own characters, so it is read, not guessed; a
 * scan is rendered at ~2000px wide so the model reads every digit at full detail.
 *
 * Loaded on demand: pdf.js is large, and only an upload needs it.
 */
import { linesFromItems } from "./readCheck";

// Lab reports run one to six pages; a longer document keeps its first pages here and
// says so in the transcription rather than silently stopping.
export const MAX_PAGES = 10;
const TARGET_WIDTH = 2000;

let lib = null;
async function pdfjs() {
  if (lib) return lib;
  const [mod, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  mod.GlobalWorkerOptions.workerSrc = worker.default;
  lib = mod;
  return lib;
}

const bytesOf = (base64) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

/**
 * @param {string} base64  the PDF (no data-URL prefix)
 * @returns {Promise<{ text: string, pageCount: number, read: number, doc: object }>}
 */
export async function openPdf(base64) {
  const { getDocument } = await pdfjs();
  const doc = await getDocument({ data: bytesOf(base64) }).promise;
  const read = Math.min(doc.numPages, MAX_PAGES);
  const pages = [];
  for (let i = 1; i <= read; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(linesFromItems(content.items));
  }
  return { text: pages.join("\n\n").trim(), pageCount: doc.numPages, read, doc };
}

/** The opened PDF's pages as JPEG data URLs, about 2000px wide. */
export async function renderPages(opened) {
  const out = [];
  for (let i = 1; i <= opened.read; i++) {
    const page = await opened.doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(4, Math.max(1, TARGET_WIDTH / base.width)) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    out.push(canvas.toDataURL("image/jpeg", 0.92));
    canvas.width = 0;
    canvas.height = 0;
  }
  return out;
}
