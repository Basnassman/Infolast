/**
 * =============================================================
 * CENTRAL BACKEND API CONFIGURATION
 * =============================================================
 *
 * Every page must build backend URLs through `apiUrl()`.
 *
 * Why: pages previously did
 *   const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ||
 *     'https://infolast-l5j6.onrender.com/api/v1';
 *   fetch(`${API_BASE_URL}/api/v1/vesting/status/0x…`)
 * which produced `…/api/v1/api/v1/vesting/status/0x…` → 404 on Render.
 *
 * `resolveApiBaseUrl` accepts both forms of NEXT_PUBLIC_API_URL:
 *   https://infolast-l5j6.onrender.com
 *   https://infolast-l5j6.onrender.com/api/v1
 * and always returns a base that ends with exactly one `/api/v1`.
 * `apiUrl()` additionally collapses any accidental duplicate prefix.
 */

export const API_PREFIX = '/api/v1';

/** Current backend host (Render). Override with NEXT_PUBLIC_API_URL. */
export const DEFAULT_API_ORIGIN = 'https://infolast-l5j6.onrender.com';

const stripTrailingSlashes = (value: string): string =>
  value.replace(/\/+$/, '');

/**
 * Normalize the configured API origin into `<origin>/api/v1`.
 */
export function resolveApiBaseUrl(raw: string | undefined): string {
  const value = (raw ?? '').trim();

  if (!value) {
    return `${stripTrailingSlashes(DEFAULT_API_ORIGIN)}${API_PREFIX}`;
  }

  const origin = stripTrailingSlashes(value);

  if (!origin) {
    return `${stripTrailingSlashes(DEFAULT_API_ORIGIN)}${API_PREFIX}`;
  }

  // Already ends with /api/v1 (or /API/V1) → keep it as-is.
  if (/\/api\/v1$/i.test(origin)) {
    return origin;
  }

  return `${origin}${API_PREFIX}`;
}

export const API_BASE_URL = resolveApiBaseUrl(
  process.env.NEXT_PUBLIC_API_URL
);

/**
 * Build an absolute backend URL for a route such as
 * `/vesting/status/0x…` or `vesting/claim`. Absolute URLs pass through.
 *
 * The final replace() is a hard safety net: it collapses
 * `/api/v1/api/v1/...` into `/api/v1/...` even if a caller passes the
 * versioned path twice.
 */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;

  const suffix = path.startsWith('/') ? path : `/${path}`;
  const joined = `${API_BASE_URL}${suffix}`;

  return joined.replace(/(\/api\/v1)(?:\/api\/v1)+/gi, '$1');
}
