"use client";

import { SpeedInsights as VercelSpeedInsights } from "@vercel/speed-insights/next";

/** Core Web Vitals (§16 LCP target). Route paths only: no query strings or personal data. */
export function SpeedInsights() {
  return <VercelSpeedInsights beforeSend={(e) => ({ ...e, url: e.url.split(/[?#]/)[0] })} />;
}
