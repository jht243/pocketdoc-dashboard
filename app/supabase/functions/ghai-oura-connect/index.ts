/**
 * Step 1 of the Oura OAuth flow: mint the authorize URL.
 *
 * The browser can't build this itself — it needs the client id, and more importantly
 * the `state` nonce has to be minted server-side and stored, or the callback has no
 * way to prove the returning request belongs to the user who started it.
 *
 * Called via supabase.functions.invoke("ghai-oura-connect"), so the user's JWT is
 * attached and identity comes from the token rather than the request body.
 *
 * Secrets:
 *   OURA_CLIENT_ID, OURA_CLIENT_SECRET
 *   SITE_URL     app origin, used to build the redirect target
 *
 * Body: { returnTo?: string }   optional in-app path to land on after consent
 * Returns: { authorizeUrl }
 */

import { CORS, ghai, adminClient, json, userFromRequest } from "../_shared/admin.ts";
import { OURA_AUTHORIZE_URL, OURA_SCOPES, assertConfigured } from "../_shared/oura.ts";

const CLIENT_ID = Deno.env.get("OURA_CLIENT_ID") ?? "";
const SITE_URL = Deno.env.get("SITE_URL") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

const STATE_TTL_MS = 5 * 60_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    assertConfigured();

    const user = await userFromRequest(req);
    if (!user) return json({ error: "Not authenticated." }, 401);

    const { returnTo = "/" } = await req.json().catch(() => ({}));

    // A random nonce, stored with a short TTL and consumed exactly once by the
    // callback. This is what stops an attacker replaying someone else's consent
    // redirect to attach their Oura account to a different app user.
    const nonce = crypto.randomUUID();
    const admin = adminClient();

    const { error } = await ghai(admin).from("oura_oauth_states").insert({
      nonce,
      user_id: user.id,
      return_to: typeof returnTo === "string" ? returnTo.slice(0, 200) : "/",
      expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
    });
    if (error) return json({ error: "Could not start the Oura connection." }, 500);

    // Opportunistic cleanup — expired nonces are dead weight and there's no cron
    // worth spending on a table this small.
    await ghai(admin)
      .from("oura_oauth_states")
      .delete()
      .lt("expires_at", new Date().toISOString());

    const url = new URL(OURA_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", CLIENT_ID);
    url.searchParams.set("redirect_uri", `${SUPABASE_URL}/functions/v1/ghai-oura-callback`);
    url.searchParams.set("scope", OURA_SCOPES.join(" "));
    url.searchParams.set("state", nonce);

    return json({ authorizeUrl: url.toString(), siteUrl: SITE_URL });
  } catch (err) {
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});
