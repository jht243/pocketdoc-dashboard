import { supabase } from "./supabase";

/**
 * Search Amazon for real products via the PA-API proxy Edge Function.
 *
 * Runs through supabase.functions.invoke so the logged-in user's JWT is attached
 * automatically — only authenticated users can hit the proxy. Returns a normalized
 * array of { asin, title, brand, image, price, url, features }, or an empty array
 * on any failure so callers can fall back gracefully.
 *
 * @param {string} keywords       e.g. "vitamin d3 k2"
 * @param {object} [opts]
 * @param {number} [opts.itemCount=3]
 * @param {string} [opts.searchIndex="HealthPersonalCare"]
 */
export async function searchProducts(keywords, opts = {}) {
  if (!supabase) return { items: [], error: "Supabase not configured" };
  try {
    const { data, error } = await supabase.functions.invoke("ghai-amazon", {
      body: {
        keywords,
        itemCount: opts.itemCount ?? 3,
        searchIndex: opts.searchIndex ?? "HealthPersonalCare",
      },
    });
    if (error) return { items: [], error: error.message };
    if (data?.error) return { items: [], error: data.error };
    return { items: Array.isArray(data?.items) ? data.items : [] };
  } catch (err) {
    return { items: [], error: String(err?.message ?? err) };
  }
}
