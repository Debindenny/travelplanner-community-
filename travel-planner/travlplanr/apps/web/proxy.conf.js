/**
 * Dev-server proxy: forwards /api/* to the local gateway (default :8080).
 *
 * Env overrides (optional):
 *   API_PROXY_TARGET   — upstream URL (default http://127.0.0.1:8080)
 *   API_PROXY_INSECURE — set to "1" to skip TLS verification on https targets
 *                        (self-signed staging only; never in production)
 *   PROXY_LOG_LEVEL    — "warn" (default), "error", or "debug"
 */
const target = process.env.API_PROXY_TARGET || 'http://127.0.0.1:8080';

module.exports = {
  '/api': {
    target,
    // Plain-HTTP local gateway: no TLS to validate. For https targets, verify
    // certs unless API_PROXY_INSECURE=1 (self-signed staging).
    secure: target.startsWith('https://')
      ? process.env.API_PROXY_INSECURE !== '1'
      : false,
    changeOrigin: true,
    logLevel: process.env.PROXY_LOG_LEVEL || 'warn',
  },
};
