/**
 * Read API headers: callable from any site with a key, so CORS is open and allows the key header.
 * Never cached by shared caches: a CDN would otherwise hand keyed responses to keyless callers.
 */
export const KEYED = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, content-type",
  "Cache-Control": "private, max-age=3600",
};

/** CORS preflight: sending x-api-key from a browser triggers one. */
export const preflight = () =>
  new Response(null, { status: 204, headers: { ...KEYED, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Max-Age": "86400" } });

export const notFound = () =>
  Response.json({ code: 404, name: "TrackNotFound", message: "Failed to find specified track" }, { status: 404, headers: KEYED });
