import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { assertEnv } from "./lib/app-env";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const isDev = process.env.NODE_ENV !== "production";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// Fail fast: a production build against the dev database (or a preview build
// against prod) stops here, before anything is deployed. See docs/environments.md.
const appEnv = assertEnv({
  appEnv: process.env.NEXT_PUBLIC_APP_ENV,
  vercelEnv: process.env.VERCEL_ENV,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
});

// Strict-ish CSP. 'unsafe-inline' for styles is needed by Next/Tailwind runtime
// style tags; scripts stay without 'unsafe-eval' outside dev.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseUrl} https://*.ingest.de.sentry.io https://vitals.vercel-insights.com`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // All data in this app is private and per-request (single owner, GDPR data).
  // We deliberately keep the previous (request-time) rendering model and do not
  // cache personal data on the server. See README → "Decisions".
  cacheComponents: false,
  // Inline the resolved value so the "DEV" badge works even if the variable is unset on Vercel.
  env: { NEXT_PUBLIC_APP_ENV: appEnv },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
