/** @type {import('next').NextConfig} */

// The Express API (server.js, one level up) keeps owning auth, sessions and
// all persistence. This app only renders pages and proxies /api/* to it so
// the browser sees everything as same-origin (cookies just work, no CORS).
const API_URL = process.env.API_URL || "http://localhost:3001";

const nextConfig = {
  reactStrictMode: true,

  // Two lockfiles exist (root package-lock.json for the Express API,
  // frontend/package-lock.json for this app) since they're separate
  // deployments sharing one repo. Pin the trace root here so Next.js
  // doesn't guess wrong and warn about it.
  outputFileTracingRoot: __dirname,

  // Explicit Webpack bundler (as opposed to Turbopack) for compatibility
  // with tooling / plugins that expect a classic Webpack build pipeline.
  // Customize the config here if a legacy dependency ever needs a shim.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Legacy browser-only libs sometimes probe for Node core modules;
      // keep the client bundle from trying to polyfill/bundle them.
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false };
    }
    return config;
  },

  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
    ];
  },
};

module.exports = nextConfig;
