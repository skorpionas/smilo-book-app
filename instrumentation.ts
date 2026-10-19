import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/sentry";

/** Server and edge error tracking (issue #20). Off when NEXT_PUBLIC_SENTRY_DSN is unset. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(sentryOptions());
  }
}

/** Errors thrown while rendering, in Server Actions or Route Handlers. */
export const onRequestError = Sentry.captureRequestError;
