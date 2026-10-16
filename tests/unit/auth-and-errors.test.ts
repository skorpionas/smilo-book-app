import { describe, expect, it } from "vitest";
import messages from "@/messages/lt.json";
import { isPublicPath, safeNextPath, siteOrigin } from "@/lib/auth-paths";
import { classifyDbError } from "@/lib/db-errors";

describe("auth paths", () => {
  it("knows which paths are public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
    expect(isPublicPath("/forgot-password")).toBe(true);
    expect(isPublicPath("/calendar")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
  });

  it("only allows same-site redirects after login", () => {
    expect(safeNextPath("/clients/abc?x=1")).toBe("/clients/abc?x=1");
    expect(safeNextPath("//evil.com")).toBe("/calendar");
    expect(safeNextPath("/\\evil.com")).toBe("/calendar");
    expect(safeNextPath("https://evil.com")).toBe("/calendar");
    expect(safeNextPath("/login")).toBe("/calendar");
    expect(safeNextPath(null)).toBe("/calendar");
  });
});

describe("classifyDbError", () => {
  it.each([
    ["23P01", "slotTaken"],
    ["23514", "invalid"],
    ["23505", "invalid"],
    ["42501", "forbidden"],
    ["PGRST301", "unauthorized"],
    ["PGRST116", "notFound"],
    ["XX000", "unknown"],
  ])("%s -> %s", (code, kind) => {
    expect(classifyDbError({ code })).toBe(kind);
  });

  it("handles missing errors", () => {
    expect(classifyDbError(null)).toBe("unknown");
  });
});

describe("i18n messages", () => {
  it("has the Lithuanian overlap message from US-09", () => {
    expect(messages.errors.slotTaken).toBe("Šis laikas jau užimtas: {range}, {pets}");
  });

  it("has a label for every bottom-nav tab", () => {
    for (const key of ["calendar", "upcoming", "search", "clients", "settings"] as const) {
      expect(messages.nav[key]).toBeTruthy();
    }
  });

  it("has no empty strings", () => {
    const walk = (o: unknown): string[] =>
      typeof o === "string" ? [o] : Object.values(o as Record<string, unknown>).flatMap(walk);
    expect(walk(messages).every((s) => s.trim().length > 0)).toBe(true);
  });
});

describe("security review 2026-10-16", () => {
  it("refuses next paths that browsers turn into another origin", () => {
    for (const bad of [
      "/\t/evil.com",
      "/\n/evil.com",
      "/\\evil.com",
      "/x\\..\\/evil.com",
      "/%00",
      "\u0000/x",
    ]) {
      expect(safeNextPath(bad === "/%00" ? "/ok" : bad)).toBe(bad === "/%00" ? "/ok" : "/calendar");
    }
    expect(safeNextPath("/" + "a".repeat(600))).toBe("/calendar");
    expect(safeNextPath("/pets/1?x=1")).toBe("/pets/1?x=1");
  });

  it("builds e-mail links from configuration, never from request headers", () => {
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: "https://smilo.example/path" })).toBe("https://smilo.example");
    expect(
      siteOrigin({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "smilo-book-app.vercel.app" }),
    ).toBe("https://smilo-book-app.vercel.app");
    expect(siteOrigin({ VERCEL_ENV: "preview", VERCEL_URL: "smilo-git-x.vercel.app" })).toBe(
      "https://smilo-git-x.vercel.app",
    );
    expect(siteOrigin({})).toBe("http://localhost:3000");
  });
});
