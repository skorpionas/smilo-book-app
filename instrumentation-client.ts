import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/sentry";

/** Browser error tracking (issue #20). Off when NEXT_PUBLIC_SENTRY_DSN is unset. */
Sentry.init(sentryOptions());

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
