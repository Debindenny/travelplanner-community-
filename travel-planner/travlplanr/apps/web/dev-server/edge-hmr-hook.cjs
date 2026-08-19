/**
 * Patches Angular's Vite dev-server setup when serving behind the TLS edge proxy.
 * Sets HMR to use wss://dev.travlplanr.com:443 so the browser does not fall back
 * to ws://localhost:4200 (unreachable remotely) or build malformed ping URLs.
 */
const Module = require('module');

const hooked = new Set();
const publicHost = process.env.DEV_PUBLIC_HOST || 'dev.travlplanr.com';
const publicPort = Number(process.env.DEV_PUBLIC_PORT || '443');

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  const exports = originalLoad.apply(this, arguments);

  if (
    hooked.has(request) ||
    typeof request !== 'string' ||
    !request.includes('dev-server/vite-server')
  ) {
    return exports;
  }

  hooked.add(request);

  const originalSetup = exports.setupServer;
  if (typeof originalSetup !== 'function') {
    return exports;
  }

  exports.setupServer = async function setupServerWithEdgeHmr(...args) {
    const config = await originalSetup(...args);
    config.server ??= {};
    config.server.hmr = {
      protocol: 'wss',
      host: publicHost,
      clientPort: publicPort,
    };
    return config;
  };

  return exports;
};
