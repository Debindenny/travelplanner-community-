/**
 * Admin app — development environment.
 * Path constants mirror the canonical service topology.
 * Components never hardcode a URL; services read from environment.
 */
export const environment = {
  production: false,
  apiBaseUrl: '/api/v1',

  // Service path prefixes (proxied to localhost:8080 in dev, APIM in prod)
  identityPath: '/api/v1',
  plannerPath: '/api/v1',
  reportingPath: '/api/v1',
  affiliatePath: '/api/v1',

  // Dashboard charts use mock data (reporting service requires seeded metrics).
  // All other endpoints (planner, identity, CMS) hit the real backend.
  useMockData: false,
};
