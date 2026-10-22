// The tools a specialist reads a document with, in code.
//
//   text layer   a PDF's own characters (pdf.js). Read, never guessed.
//   page images  a scan rendered at ~2000px wide (pdf.js + @napi-rs/canvas), sent to
//                the model at high detail. Sending the PDF file instead let the model
//                see a scan at low resolution, and it guessed the small digits.
//   the photo    as uploaded, at high detail.
//
// pdf.js is loaded on first use, so the chat never waits on it and a deploy missing
// it reports `tools: false` on /health instead of failing to start.
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hasUsableText, linesFromItems } from '../../src/lib/readCheck.js';

export const MAX_PAGES = 10;
const TARGET_WIDTH = 2000;

let lib = null;
let installing = null;

/**
 * Install the reading tools into this service when its build didn't (a Render
 * service whose build command predates them). Once per process, in the background
 * from startup, so a deploy never leaves uploads without a reader.
 */
function installTools() {
  installing ||= new Promise((resolve) => {
    const dir = fileURLToPath(new URL('..', import.meta.url));
    console.log('[docTools] reading tools missing; installing them');
    execFile('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: dir, timeout: 300000 }, (err, stdout, stderr) => {
      if (err) console.error('[docTools] install failed', err.message, stderr?.slice(-500));
      else console.log('[docTools] reading tools installed');
      resolve(!err);
    });
  });
  return installing;
}

async function pdfjs() {
  if (lib) return lib;
  try {
    lib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    return lib;
  } catch (first) {
    if (await installTools()) {
      try { lib = await import('pdfjs-dist/legacy/build/pdf.mjs'); return lib; } catch { /* fall through */ }
    }
    throw new Error(`The document reader isn't installed on this service (${first.message}).`);
  }
}

/** The tools' state right now, without waiting: what /health reports as `tools`. */
export const toolsStatus = () => (lib ? true : installing ? 'installing' : false);

/** Whether pdf.js loads here (installing it first if the build skipped it). */
export async function toolsAvailable() {
  try { await pdfjs(); return true; } catch { return false; }
}

const bytes = (base64) => new Uint8Array(Buffer.from(base64, 'base64'));
const isPdfBytes = (b) => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; // %PDF

/**
 * What a document gives the specialist to read.
 *
 * @param {object} o
 * @param {string} o.file        base64, no data-URL prefix
 * @param {string} [o.mediaType] as the browser reported it (often wrong on phones)
 * @returns {Promise<{ kind: 'text'|'pdf-text'|'scan'|'image', text: string, pages: string[], pageCount: number, read: number }>}
 */
export async function readEvidence({ file, mediaType = '' }) {
  const type = String(mediaType || '').toLowerCase();
  const raw = bytes(file);
  if (type.startsWith('text/') || type.includes('plain')) {
    return { kind: 'text', text: Buffer.from(raw).toString('utf8'), pages: [], pageCount: 1, read: 1 };
  }
  // Trust the bytes over the label: a PDF starts with "%PDF".
  if (!isPdfBytes(raw) && type.startsWith('image/')) {
    return { kind: 'image', text: '', pages: [`data:${type};base64,${file}`], pageCount: 1, read: 1 };
  }
  const { getDocument } = await pdfjs();
  const doc = await getDocument({ data: raw, disableFontFace: true, useSystemFonts: true, isEvalSupported: false }).promise;
  const read = Math.min(doc.numPages, MAX_PAGES);
  const layers = [];
  for (let i = 1; i <= read; i++) {
    const page = await doc.getPage(i);
    layers.push(linesFromItems((await page.getTextContent()).items));
  }
  const text = layers.join('\n\n').trim();
  if (hasUsableText(text)) return { kind: 'pdf-text', text, pages: [], pageCount: doc.numPages, read };

  const pages = [];
  for (let i = 1; i <= read; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(4, Math.max(1, TARGET_WIDTH / base.width)) });
    const { canvas, context } = doc.canvasFactory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
    pages.push(`data:image/jpeg;base64,${canvas.toBuffer('image/jpeg', 90).toString('base64')}`);
  }
  return { kind: 'scan', text, pages, pageCount: doc.numPages, read };
}

/** Page images as the content parts a model call takes, at high detail. */
export const imageParts = (pages) => pages.map((url) => ({ type: 'image_url', image_url: { url, detail: 'high' } }));
