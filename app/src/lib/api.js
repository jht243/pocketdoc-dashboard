/**
 * Central AI gateway.
 *
 * Every screen calls the app's AI through here rather than hitting a provider
 * directly. That matters for two reasons:
 *
 *  1. The mockup posted straight to api.anthropic.com from the browser with no
 *     API key. That only works inside a sandboxed preview that injects
 *     credentials — standalone it fails, and shipping a key to the browser
 *     would leak it.
 *  2. In Phase D we stand up our own backend. Point VITE_AI_ENDPOINT at it and
 *     every caller switches over with no screen changes.
 */

const AI_ENDPOINT =
  import.meta.env.VITE_AI_ENDPOINT || "https://api.anthropic.com/v1/messages";
const AI_MODEL = import.meta.env.VITE_AI_MODEL || "claude-sonnet-4-6";

// Sending a PDF as a document block requires this beta header; without it the
// block is silently dropped and the model receives no content.
const PDF_BETA = "pdfs-2024-09-25";

/**
 * @param {object}   opts
 * @param {string}   opts.system     system prompt
 * @param {Array}    opts.messages   Anthropic-shaped message array
 * @param {number}  [opts.maxTokens]
 * @param {boolean} [opts.pdf]       set when any message carries a PDF document block
 * @returns {Promise<object>} raw response body
 */
export async function callAI({ system, messages, maxTokens = 1000, pdf = false }) {
  const headers = { "Content-Type": "application/json" };
  if (pdf) headers["anthropic-beta"] = PDF_BETA;

  const response = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }
  return response.json();
}

/** Pull the first text block out of a response, with a fallback. */
export function firstText(data, fallback = "") {
  return data?.content?.find((b) => b.type === "text")?.text || fallback;
}
