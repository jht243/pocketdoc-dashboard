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
 * @param {boolean} [opts.pdf]       accepted for call-site compatibility; unused (PDFs are auto-handled)
 * @returns {Promise<object>} raw OpenAI response body
 */
export async function callAI({ system, messages, maxTokens = 1000 }) {
  if (!supabase) throw new Error("AI is not configured (Supabase client missing).");

  const openAIMessages = [];
  if (system) openAIMessages.push({ role: "system", content: system });
  for (const m of messages) openAIMessages.push(toOpenAIMessage(m));

  const { data, error } = await supabase.functions.invoke("ghai-ai", {
    body: { model: AI_MODEL, messages: openAIMessages, max_tokens: maxTokens },
  });

  if (error) throw new Error(`AI request failed: ${error.message}`);
  if (data?.error) throw new Error(`AI request failed: ${data.error.message || data.error}`);
  return data;
}

/** Pull the assistant text out of an OpenAI response, with a fallback. */
export function firstText(data, fallback = "") {
  return data?.choices?.[0]?.message?.content || fallback;
}
