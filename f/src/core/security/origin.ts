/**
 * =====================================================
 * CORS ORIGIN HELPERS (pure, dependency-free)
 * =====================================================
 *
 * Browsers send the `Origin` header WITHOUT a trailing slash:
 *   Origin: https://frontendco.netlify.app
 *
 * If CORS_ORIGIN is configured as `https://frontendco.netlify.app/`
 * (a trailing slash is very easy to add in a hosting dashboard), the
 * `cors` package compares strings and never matches, so no
 * `Access-Control-Allow-Origin` header is emitted and the browser
 * blocks every cross-origin request.
 *
 * Normalizing both sides (trim + strip trailing slashes + lowercase)
 * makes the allowlist immune to that configuration mistake.
 */

/**
 * Normalize a single origin for comparison.
 * Returns "" for empty input.
 */
export const normalizeOrigin = (value: string): string =>
  value
    .trim()
    .replace(/\/+$/, "")
    .toLowerCase();

/**
 * Parse the CORS_ORIGIN env value.
 *
 * - undefined / "" / "*" → null (means: no explicit allowlist)
 * - "https://a.com,https://b.com" → ["https://a.com", "https://b.com"]
 *
 * Duplicates and empty entries are removed.
 */
export const parseOriginList = (
  raw: string | undefined
): string[] | null => {
  const value = raw?.trim();
  if (!value || value === "*") return null;

  const list = value
    .split(",")
    .map(normalizeOrigin)
    .filter((origin) => origin.length > 0);

  return list.length > 0 ? [...new Set(list)] : null;
};

/**
 * Check whether an incoming Origin header is allowed.
 *
 * - `null` allowlist means "reflect any origin" (only safe together with
 *   credentials when intentionally configured with CORS_ORIGIN=*).
 * - Requests without an Origin header (server-to-server, curl) are allowed;
 *   CORS is a browser-side protection, not server authentication.
 */
export const isOriginAllowed = (
  origin: string | undefined,
  allowlist: string[] | null
): boolean => {
  if (!origin) return true;
  if (allowlist === null) return true;
  return allowlist.includes(normalizeOrigin(origin));
};
