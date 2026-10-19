// Shared Sentry settings for the browser, Node and edge runtimes (issue #20).
// GDPR (§16): EU data region (the DSN host is *.ingest.de.sentry.io), no PII —
// no IP, cookies, headers, request bodies or query strings, no user, no replay.
// Without a DSN (local, CI) Sentry stays off.
//
// No path aliases, no "server-only": imported from instrumentation files.

type ScrubbableEvent = {
  user?: unknown;
  request?: { url?: string; cookies?: unknown; headers?: unknown; data?: unknown; query_string?: unknown };
  breadcrumbs?: { category?: string; message?: string; data?: Record<string, unknown> }[];
};

/** Drop the query string (it could carry a search term or a token) from a URL. */
export function stripQuery(url: string): string {
  const i = url.search(/[?#]/);
  return i === -1 ? url : url.slice(0, i);
}

/** Remove anything that could identify a client from an event before it leaves the device. */
export function scrubEvent<E extends ScrubbableEvent>(event: E): E {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.url) event.request.url = stripQuery(event.request.url);
  }
  if (event.breadcrumbs) {
    // Console messages and form / input contents can hold names or phone numbers.
    event.breadcrumbs = event.breadcrumbs
      .filter((b) => b.category !== "console" && b.category !== "ui.input")
      .map((b) => {
        if (!b.data) return b;
        const data = { ...b.data };
        for (const key of ["url", "to", "from"]) {
          if (typeof data[key] === "string") data[key] = stripQuery(data[key] as string);
        }
        delete data.body;
        return { ...b, data };
      });
  }
  return event;
}

export function sentryOptions() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? "local",
    sendDefaultPii: false,
    // Errors only: performance tracing is not needed for a one-user app (free tier).
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
  };
}
