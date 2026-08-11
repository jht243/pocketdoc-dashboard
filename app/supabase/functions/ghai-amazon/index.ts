/**
 * Amazon Creators API proxy (PA-API 5.0 successor).
 *
 * Mirrors the working client in the layer3 project (scripts/gear_radar/pull.py):
 * authenticate with Login-with-Amazon client_credentials to get a bearer token,
 * then call the Creators catalog API. The browser can't do this (CORS + secret
 * credentials), so this function holds the credentials server-side and returns a
 * normalized product list the app renders.
 *
 * Secrets (same names layer3 uses — set with the Supabase dashboard or CLI):
 *   AMZ_CLIENT_ID      Credential ID   (amzn1.application-oa2-client...)
 *   AMZ_CLIENT_SECRET  Secret          (amzn1.oa2-cs.v1...)
 *   AMZ_PARTNER_TAG    Associate tag   (e.g. soulcircle01-20)
 *   AMZ_MARKETPLACE    optional, default www.amazon.com
 *
 * Called via supabase.functions.invoke("ghai-amazon", { body }), so only
 * authenticated users reach it. Body: { keywords, itemCount?, searchIndex? }.
 */

const CLIENT_ID = Deno.env.get("AMZ_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("AMZ_CLIENT_SECRET") ?? "";
const PARTNER_TAG = Deno.env.get("AMZ_PARTNER_TAG") ?? "";
const MARKETPLACE = Deno.env.get("AMZ_MARKETPLACE") ?? "www.amazon.com";

const TOKEN_URL = "https://api.amazon.com/auth/o2/token";
const SEARCH_URL = "https://creatorsapi.amazon/catalog/v1/searchItems";

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

// Cache the bearer token in memory until shortly before it expires, so we don't
// hit the token endpoint on every product search.
let cachedToken = { value: "", exp: 0 };

async function getToken(): Promise<string> {
  if (cachedToken.value && Date.now() < cachedToken.exp) return cachedToken.value;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: "creatorsapi::default",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Token request failed (HTTP ${res.status}): ${JSON.stringify(data).slice(0, 300)}`);
  }
  const ttl = (data.expires_in ?? 3600) * 1000;
  cachedToken = { value: data.access_token, exp: Date.now() + ttl - 60_000 };
  return cachedToken.value;
}

// Flatten the Creators API item shape into what the cards need.
function normalizeItem(item: any) {
  const asin = item?.asin ?? null;
  const listing = item?.offersV2?.listings?.[0];
  return {
    asin,
    title: item?.itemInfo?.title?.displayValue ?? null,
    brand: item?.itemInfo?.byLineInfo?.brand?.displayValue ??
      item?.itemInfo?.byLineInfo?.manufacturer?.displayValue ?? null,
    image: item?.images?.primary?.large?.url ?? null,
    price: listing?.price?.money?.displayAmount ?? null,
    url: item?.detailPageURL ??
      (asin ? `https://www.amazon.com/dp/${asin}?tag=${PARTNER_TAG}&linkCode=ll1` : null),
    features: item?.itemInfo?.features?.displayValues ?? [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!CLIENT_ID || !CLIENT_SECRET || !PARTNER_TAG) {
    return json({ error: "Amazon Creators API credentials are not configured." }, 500);
  }

  try {
    const { keywords, itemCount = 3, searchIndex = "HealthPersonalCare" } =
      await req.json();
    if (!keywords) return json({ error: "keywords is required" }, 400);

    const token = await getToken();

    const res = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-marketplace": MARKETPLACE,
      },
      body: JSON.stringify({
        keywords,
        searchIndex,
        itemCount: Math.min(Math.max(itemCount, 1), 10),
        itemPage: 1,
        marketplace: MARKETPLACE,
        partnerTag: PARTNER_TAG,
        resources: [
          "itemInfo.title",
          "itemInfo.features",
          "itemInfo.byLineInfo",
          "images.primary.large",
          "offersV2.listings.price",
          "offersV2.listings.availability",
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return json({ error: "Amazon request failed", detail: data }, res.status);
    }

    const rawItems = data?.searchResult?.items ?? data?.itemsResult?.items ?? [];
    return json({ items: rawItems.map(normalizeItem) });
  } catch (err) {
    return json({ error: String(err?.message ?? err) }, 500);
  }
});
