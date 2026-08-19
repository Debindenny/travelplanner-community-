/**
 * Development environment.
 *
 * `apiBase` is empty so existing relative `/api/v1/...` calls continue to work
 * through the dev proxy (proxy.conf). Set it only if you point the dev build at
 * a remote gateway.
 */
export const environment = {
  production: false,
  apiBase: '',
  /**
   * Optional build-time Maps JS key. Prefer runtime GOOGLE_MAPS_BROWSER_KEY via
   * GET /api/v1/public-config (PublicConfigService) so deploys don't need rebuilds.
   */
  googleMapsBrowserKey: '',
  /** Optional build-time Google OAuth web client id. */
  googleOAuthClientId: '',
  sentry: {
    dsn: '',
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  }
};
