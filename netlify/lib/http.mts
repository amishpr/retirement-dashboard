/**
 * Response helpers shared by the Netlify functions. This file sits outside `netlify/functions/`,
 * so Netlify bundles it into each function that imports it instead of deploying it as a function
 * of its own.
 */

/**
 * Origins allowed to call the functions cross-origin. The Netlify deploy calls them same-origin and
 * sends no Origin header, so it never needs an entry here. This exists for the GitHub Pages mirror,
 * which is static-only and has no way to run a copy of the functions itself.
 */
const ALLOWED_ORIGINS = new Set(["https://amishpr.github.io"]);

/** The caller's origin when it's allowed to read the response cross-origin, otherwise undefined. */
export function allowedOrigin(req: Request): string | undefined {
  const origin = req.headers.get("origin");
  return origin && ALLOWED_ORIGINS.has(origin) ? origin : undefined;
}

export interface JsonResponseOptions {
  status?: number;
  allowOrigin?: string;
  /** How long browsers and Netlify's CDN may reuse a successful response, in seconds. */
  maxAge?: number;
  /** How long past `maxAge` the CDN may keep serving the last good response while it fetches a
   *  fresh one. This is what rides out a short upstream outage. */
  staleWhileRevalidate?: number;
}

export function jsonResponse(
  body: unknown,
  { status = 200, allowOrigin, maxAge = 300, staleWhileRevalidate = 0 }: JsonResponseOptions = {},
): Response {
  // Only successful lookups are worth caching; a cached error would keep failing after the fix.
  const cacheable = status === 200;
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": cacheable ? `public, max-age=${maxAge}` : "no-store",
      // Netlify's CDN reads its own header ahead of cache-control. `durable` shares the cached copy
      // across every edge node, so one upstream call serves everyone.
      ...(cacheable
        ? {
            "netlify-cdn-cache-control": `public, durable, s-maxage=${maxAge}${
              staleWhileRevalidate ? `, stale-while-revalidate=${staleWhileRevalidate}` : ""
            }`,
          }
        : {}),
      // The allow-origin header echoes the caller, so caches have to key on it or one origin's
      // response could be replayed to another.
      vary: "origin",
      ...(allowOrigin ? { "access-control-allow-origin": allowOrigin } : {}),
    },
  });
}
