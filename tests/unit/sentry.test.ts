import { afterEach, describe, expect, it, vi } from "vitest";
import { scrubEvent, sentryOptions, stripQuery } from "@/lib/sentry";

describe("Sentry scrubbing (§16: no personal data)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("drops query strings and fragments", () => {
    expect(stripQuery("https://x.app/clients/1?q=Rasa#top")).toBe("https://x.app/clients/1");
    expect(stripQuery("/calendar")).toBe("/calendar");
  });

  it("removes user, cookies, headers, bodies and console breadcrumbs", () => {
    const event = scrubEvent({
      user: { ip_address: "1.2.3.4" },
      request: {
        url: "https://x.app/search?q=Petrauskiene",
        cookies: { sb: "token" },
        headers: { cookie: "sb=token" },
        data: { fullName: "Rasa" },
        query_string: "q=Petrauskiene",
      },
      breadcrumbs: [
        { category: "console", message: "Rasa +37061234567" },
        { category: "ui.input", message: "input[name=phone]" },
        { category: "fetch", data: { url: "/api/export?clientId=1", body: "x" } },
        { category: "navigation", data: { from: "/a?x=1", to: "/b?y=2" } },
      ],
    });
    expect(event.user).toBeUndefined();
    expect(event.request).toEqual({ url: "https://x.app/search" });
    expect(event.breadcrumbs).toEqual([
      { category: "fetch", data: { url: "/api/export" } },
      { category: "navigation", data: { from: "/a", to: "/b" } },
    ]);
  });

  it("is off without a DSN and never sends default PII", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    expect(sentryOptions()).toMatchObject({ enabled: false, sendDefaultPii: false });
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://k@o1.ingest.de.sentry.io/1");
    expect(sentryOptions().enabled).toBe(true);
  });
});
