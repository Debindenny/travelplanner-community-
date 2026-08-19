import { environment } from '../../../environments/environment';

/**
 * Build an absolute API URL for a given endpoint path.
 *
 * Joins `environment.apiBase` (empty in dev so calls stay relative and flow
 * through the dev proxy) with the `/api/v1` prefix and the supplied path.
 *
 * Usage:
 *   apiUrl('/trips')          -> `${apiBase}/api/v1/trips`
 *   apiUrl('trips/123')       -> `${apiBase}/api/v1/trips/123`
 *   apiUrl(`/me/profile`)     -> `${apiBase}/api/v1/me/profile`
 *
 * Only pass the part that comes AFTER `/api/v1`; the prefix is added here so
 * callers never hardcode the version literal.
 */
export function apiUrl(path: string): string {
  const base = environment.apiBase || '';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}/api/v1${normalizedPath}`;
}
