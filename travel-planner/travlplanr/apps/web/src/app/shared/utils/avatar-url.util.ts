/**
 * Uploaded media (avatars, event cover images, etc.) is stored as a relative
 * path (e.g. `/static/uploads/x.jpg`, served by the planner API) rather than
 * an absolute URL. Since the Angular app runs on a different origin/port than
 * that API, a relative path needs the API origin prefixed before a browser
 * can load it — otherwise it silently 404s against the frontend's own origin
 * instead.
 *
 * Returns `undefined` when there's no URL at all, so callers rendering an
 * optional image (e.g. `*ngIf="hostAvatarUrl"`) fall back to their own
 * placeholder (initials, gradient, icon, etc.) instead of a forced default.
 */
export function resolveAvatarUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `http://localhost:8080${url}`;
}
