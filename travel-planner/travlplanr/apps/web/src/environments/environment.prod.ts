/**
 * Production environment.
 *
 * Leave `apiBase` empty when the SPA is served behind the same gateway/host as
 * the API (relative paths resolve correctly). Set it to e.g.
 * 'https://api.travlplanr.com' when the API lives on a different origin (also
 * configure CORS on the gateway in that case).
 */
export const environment = {
  production: true,
  apiBase: '',
  /** Set at build time to a Maps JS key restricted to your production referrers. */
  googleMapsBrowserKey: '',
  /** Set at build time to a Google OAuth web client id. */
  googleOAuthClientId: '',
  sentry: {
    dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 0.5,
  }
};
