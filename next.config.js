const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

/** @type {import('next').NextConfig} */
module.exports = (phase) => ({
  output: 'standalone',
  reactStrictMode: true,
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? 'node_modules/.cache/next-dev' : '.next',
});
