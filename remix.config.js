/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  ignoredRouteFiles: ["**/.*"],
  publicPath: "/build/",
  serverBuildPath: "build/index.js",
  assetsBuildDirectory: "public/build",
  serverModuleFormat: "cjs",
  serverPlatform: "node",
  postcss: true,
  tailwind: true,
  future: {
    v3_fetcherPersist: true,
    v3_relativeSplatPath: true,
    v3_throwAbortReason: true,
    v3_singleFetch: false,
    v3_lazyRouteDiscovery: false,
  },
};