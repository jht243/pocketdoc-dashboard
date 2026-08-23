/**
 * Central AI gateway (OpenAI, via server-side proxy).
 *
 * Every screen calls the app's AI through here. Callers pass an Anthropic-shaped
 * payload ({ system, messages }) because that is what the screens were written
 * against; this module translates it to the OpenAI Chat Completions format and
 * sends it to the `ghai-ai` Edge Function, which holds the OpenAI key server-side
 * and forwards the request to OpenAI.
 *
 * The key never ships in the browser bundle — it lives only in the Supabase
 * function's secrets (OPENAI_API_KEY). Requests go through
 * supabase.functions.invoke, so the logged-in user's JWT is attached and only
 * authenticated users can reach the proxy.
 */

import { supabase } from "./supabase";

const AI_MODEL = import.meta.env.VITE_AI_MODEL || "gpt-4o";

/**
 * One AI request at a time, app-wide.
 *
 * An import used to fire the transcription and the marker extraction concurrently —
 * each carrying the same multi-megabyte PDF — while the Records screen backfilled
 * every previously-unread document in the background. Three or four whole documents
 * in flight at once blows straight through the account's tokens-per-minute ceiling,
 * and OpenAI answers 429 for all of them. The user sees "Extraction failed" on a
 * file that is perfectly readable.
 *
 * Serializing costs a little wall-clock on the rare parallel case and buys back the
 * entire class of self-inflicted rate limits: the per-minute budget is now spent one
 * document at a time instead of all at once.
 */
let queueTail = Promise.resolve();
function enqueue(task) {
  const run = queueTail.then(task, task);
  // Keep the chain alive after a rejection, or one failed call would poison every
  // request that follows it.
  queueTail = run.catch(() => {});
  return run;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * How long to wait before retrying a rate-limited request.
 *
 * OpenAI states the exact wait in the error message ("Please try again in 1.862s"),
 * which is far better than guessing; the exponential backoff is the fallback when it
 * doesn't. The small padding matters — retrying at the very instant the window
 * reopens tends to land just before it.
 */
function retryDelay(message, attempt) {
  const match = /try again in ([\d.]+)(ms|s)\b/i.exec(String(message || ""));
  if (match) {
    const value = parseFloat(match[1]);
    const ms = match[2].toLowerCase() === "ms" ? value : value * 1000;
    if (Number.isFinite(ms)) return Math.min(ms + 400, 20000);
  }
  return Math.min(1500 * 2 ** attempt, 20000);
}

function isRateLimit(message) {
  return /rate limit|429|tokens per min|requests per min|TPM|RPM/i.test(String(message || ""));
}

const RATE_LIMIT_MESSAGE =
  "The AI service is busy right now (too many requests in a short window). Wait about a minute and try again — your file is already saved.";

const MAX_RETRIES = 4;

/**
 * Translate one Anthropic-style message into an OpenAI chat message.
 * Content may be a plain string, or an array of typed blocks
 * (text / image / document) that we map to OpenAI content parts.
 */
function toOpenAIMessage(message) {
  const { role, content } = message;
  if (typeof content === "string") return { role, content };

  const parts = (content || []).map((block) => {
    if (block.type === "text") {
      return { type: "text", text: block.text };
    }
    if (block.type === "image") {
      const { media_type, data } = block.source || {};
      return { type: "image_url", image_url: { url: `data:${media_type};base64,${data}` } };
    }
    if (block.type === "document") {
      // OpenAI reads PDFs via a base64 data URL in a `file` content part.
      const { data } = block.source || {};
      return {
        type: "file",
        file: { filename: "document.pdf", file_data: `data:application/pdf;base64,${data}` },
      };
    }
    return { type: "text", text: "" };
  });

  return { role, content: parts };
}

/**
 * @param {object}   opts
 * @param {string}   opts.system     system prompt
 * @param {Array}    opts.messages   Anthropic-shaped message array
 * @param {number}  [opts.maxTokens]
 * @param {boolean} [opts.webSearch] run the request with live web research + citations
 * @param {boolean} [opts.pdf]       accepted for call-site compatibility; unused (PDFs are auto-handled)
 * @returns {Promise<object>} raw OpenAI response body
 */
export async function callAI({ system, messages, maxTokens = 1000, model, webSearch = false }) {
  if (!supabase) throw new Error("AI is not configured (Supabase client missing).");

  const openAIMessages = [];
  if (system) openAIMessages.push({ role: "system", content: system });
  for (const m of messages) openAIMessages.push(toOpenAIMessage(m));

  const body = {
    model: model || AI_MODEL,
    messages: openAIMessages,
    max_tokens: maxTokens,
    web_search: webSearch,
  };

  // Queued rather than fired immediately — see `enqueue` above. The retry lives
  // inside the queued task so a request that is waiting out a rate limit holds the
  // lane, instead of letting the next document pile straight into the same ceiling.
  return enqueue(async () => {
    let lastMessage = "";
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const { data, error } = await supabase.functions.invoke("ghai-ai", { body });

      // functions.invoke reports any non-2xx as a generic FunctionsHttpError whose
      // message is just "Edge Function returned a non-2xx status code" — the useful
      // detail (a deprecated model, a bad key, a rate limit) is in the JSON body.
      // Read it so the real reason reaches the caller instead of being swallowed.
      let detail = null;
      if (error) {
        detail = error.message;
        try {
          const parsed = await error.context?.json?.();
          detail = parsed?.error?.message || parsed?.error || detail;
        } catch { /* non-JSON body; keep the generic message */ }
      } else if (data?.error) {
        detail = data.error.message || data.error;
      }

      if (!detail) return data;

      lastMessage = String(detail);
      // Anything that isn't a rate limit won't fix itself by waiting.
      if (!isRateLimit(lastMessage) || attempt === MAX_RETRIES) break;
      await sleep(retryDelay(lastMessage, attempt));
    }

    // Rate limits get a plain-language message. The raw OpenAI text names the org id
    // and the TPM ceiling, which tells a member nothing they can act on and reads
    // like the app is broken.
    throw new Error(
      isRateLimit(lastMessage) ? RATE_LIMIT_MESSAGE : `AI request failed: ${lastMessage}`
    );
  });
}

/** Pull the assistant text out of an OpenAI response, with a fallback. */
export function firstText(data, fallback = "") {
  return data?.choices?.[0]?.message?.content || fallback;
}

/**
 * Web-search models (e.g. gpt-4o-search-preview) attach source citations as
 * `annotations` on the message. Returns a de-duplicated [{title, url}] list.
 */
export function firstCitations(data) {
  const annotations = data?.choices?.[0]?.message?.annotations || [];
  const seen = new Set();
  const out = [];
  for (const a of annotations) {
    const c = a?.url_citation || a;
    const url = c?.url;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    let host = url;
    try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* keep raw */ }
    out.push({ title: c.title || host, url });
  }
  return out;
}
