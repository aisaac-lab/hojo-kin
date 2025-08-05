/** @type {import('@remix-run/dev').AppConfig} */
export default {
  ignoredRouteFiles: ["**/.*"],
  publicPath: "/build/",
  serverBuildPath: "build/index.js",
  assetsBuildDirectory: "public/build",
  serverModuleFormat: "esm",
  serverPlatform: "node",
  postcss: true,
  tailwind: true,
  future: {
    v3_fetcherPersist: true,
    v3_relativeSplatPath: true,
    v3_throwAbortReason: true,
    v3_singleFetch: false,
    v3_lazyRouteDiscovery: true,
  },
};