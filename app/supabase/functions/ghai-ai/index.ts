/**
 * OpenAI proxy.
 *
 * Keeps the OpenAI API key server-side so it never ships in the browser bundle.
 * The app builds a standard OpenAI Chat Completions request body and sends it
 * here; this function attaches the secret key and forwards it to OpenAI, then
 * returns a Chat-Completions-shaped response.
 *
 * Two upstream paths, one response shape:
 *   - default            → POST /v1/chat/completions
 *   - `web_search: true` → POST /v1/responses with the hosted `web_search` tool,
 *                          reshaped into the Chat Completions envelope so callers
 *                          keep reading `choices[0].message.{content,annotations}`.
 *
 * The Responses API is how live web research works now: the old
 * `gpt-4o-search-preview` / `gpt-4o-mini-search-preview` chat models were
 * deprecated by OpenAI and return 404 `model_not_found`, which is what silently
 * broke the chat screen.
 *
 * Secrets (set in the Supabase dashboard or CLI):
 *   OPENAI_API_KEY   your OpenAI key (sk-...)
 *   OPENAI_MODEL     optional default/fallback model (defaults to gpt-4o)
 *
 * Called via supabase.functions.invoke("ghai-ai", { body }), so only
 * authenticated app users reach it.
 * Body: { model, messages, max_tokens, web_search }.
 */

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const CHAT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o";
// Used when the requested model is gone (deprecated / no account access) so one
// retired model id can never take the whole chat down again.
const FALLBACK_MODEL = "gpt-4o";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });

type Msg = { role: string; content: unknown };

/* ---------------- chat completions ---------------- */

async function postOpenAI(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

/**
 * Newer models (gpt-5*, o*) reject `max_tokens` and require
 * `max_completion_tokens`. Rather than keep a model list in sync, send the
 * common form and retry once on the specific parameter error OpenAI returns.
 */
async function chatCompletion(model: string, messages: Msg[], maxTokens: number) {
  const base = { model, messages };
  let out = await postOpenAI(CHAT_ENDPOINT, { ...base, max_tokens: maxTokens });

  const message = String(out.data?.error?.message ?? "");
  if (out.status >= 400 && /max_completion_tokens/.test(message)) {
    out = await postOpenAI(CHAT_ENDPOINT, { ...base, max_completion_tokens: maxTokens });
  }
  return out;
}

/* ---------------- responses API (live web search) ---------------- */

/** Chat-Completions content parts → Responses API input parts. */
function toInputContent(role: string, content: unknown) {
  const textType = role === "assistant" ? "output_text" : "input_text";
  if (typeof content === "string") return [{ type: textType, text: content }];

  return (Array.isArray(content) ? content : []).map((part: any) => {
    if (part?.type === "image_url") {
      return { type: "input_image", image_url: part.image_url?.url };
    }
    if (part?.type === "file") {
      return {
        type: "input_file",
        filename: part.file?.filename ?? "document.pdf",
        file_data: part.file?.file_data,
      };
    }
    return { type: textType, text: part?.text ?? "" };
  });
}

/** Responses API result → the Chat Completions envelope every caller parses. */
function toChatShape(data: any) {
  const message = (data?.output || []).find((item: any) => item?.type === "message");
  const parts = (message?.content || []).filter((c: any) => c?.type === "output_text");
  return {
    id: data?.id,
    object: "chat.completion",
    model: data?.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: parts.map((p: any) => p.text).join("\n"),
          // Web-search citations ride along as url_citation annotations.
          annotations: parts.flatMap((p: any) => p.annotations || []),
        },
        finish_reason: data?.status === "incomplete" ? "length" : "stop",
      },
    ],
    usage: data?.usage,
  };
}

async function webSearchCompletion(model: string, messages: Msg[], maxTokens: number) {
  // The Responses API takes the system prompt as top-level `instructions`.
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .join("\n\n");
  const input = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: toInputContent(m.role, m.content) }));

  return await postOpenAI(RESPONSES_ENDPOINT, {
    model,
    instructions: system || undefined,
    input,
    tools: [{ type: "web_search" }],
    max_output_tokens: maxTokens,
  });
}

/* ---------------- handler ---------------- */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!OPENAI_API_KEY) {
    return json({ error: "OPENAI_API_KEY is not configured." }, 500);
  }

  try {
    const {
      model,
      messages,
      max_tokens = 1000,
      web_search = false,
    } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages is required" }, 400);
    }

    const requested = model || DEFAULT_MODEL;
    const run = (m: string) =>
      web_search
        ? webSearchCompletion(m, messages, max_tokens)
        : chatCompletion(m, messages, max_tokens);

    let out = await run(requested);

    // A retired or unavailable model id shouldn't be a dead end — retry once on a
    // model we know the account can reach, so the user still gets an answer.
    if (out.status >= 400 && out.data?.error?.code === "model_not_found" && requested !== FALLBACK_MODEL) {
      out = await run(FALLBACK_MODEL);
    }
    // Same for web search itself: if the hosted tool isn't available to this
    // account/model, answer without live research rather than failing outright.
    if (out.status >= 400 && web_search) {
      const retry = await chatCompletion(
        out.data?.error?.code === "model_not_found" ? FALLBACK_MODEL : requested,
        messages,
        max_tokens,
      );
      if (retry.status < 400) out = retry;
    }

    if (out.status >= 400) return json(out.data, out.status);

    if (web_search && out.data?.output) {
      const shaped = toChatShape(out.data);
      // A search run can come back 200 with no text at all (e.g. a reasoning model
      // that spent the whole output budget thinking). An empty bubble reads as a
      // broken chat, so answer without live research rather than saying nothing.
      if (!shaped.choices[0].message.content.trim()) {
        const retry = await chatCompletion(requested, messages, max_tokens);
        if (retry.status < 400) return json(retry.data, 200);
      }
      return json(shaped, 200);
    }
    return json(out.data, 200);
  } catch (err) {
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});
