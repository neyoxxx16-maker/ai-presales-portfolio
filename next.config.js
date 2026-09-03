/** @type {import("next").NextConfig} */
const tenderPdfRuntimeAssets = [
  // pdf-parse resolves its fake worker relative to its CJS entry at runtime;
  // that dynamic import is not discoverable by Next output tracing.
  "./node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs",
  // PDF.js loads this native Node canvas adapter dynamically. Include the
  // platform package as well so Vercel's traced function has the Linux
  // binary needed to provide the real DOMMatrix implementation.
  "./node_modules/@napi-rs/canvas*/**/*",
];

const nextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/tea-assistant": ["./data/generated/tea-vector-index-production-512.json"],
    "/api/tender-agent": tenderPdfRuntimeAssets,
    "/api/tender-company-documents": tenderPdfRuntimeAssets,
  },
};

module.exports = nextConfig;
