/**
 * OpenAI proxy.
 *
 * Keeps the OpenAI API key server-side so it never ships in the browser bundle.
 * The app builds a standard OpenAI Chat Completions request body and sends it
 * here; this function attaches the secret key and forwards it to OpenAI, then
 * returns OpenAI's response unchanged.
 *
 * Secret (set in the Supabase dashboard or CLI):
 *   OPENAI_API_KEY   your OpenAI key (sk-...)
 *
 * Called via supabase.functions.invoke("ghai-ai", { body }), so only
 * authenticated app users reach it. Body: { model, messages, max_tokens }.
 */

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!OPENAI_API_KEY) {
    return json({ error: "OPENAI_API_KEY is not configured." }, 500);
  }

  try {
    const { model, messages, max_tokens = 1000 } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages is required" }, 400);
    }

    const res = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: model || DEFAULT_MODEL, messages, max_tokens }),
    });

    const data = await res.json();
    // Pass OpenAI's status and body straight through so the client can read
    // either the completion or the error detail.
    return json(data, res.status);
  } catch (err) {
    return json({ error: String(err?.message ?? err) }, 500);
  }
});
