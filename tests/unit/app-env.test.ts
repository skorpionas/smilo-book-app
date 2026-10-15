import { describe, expect, it } from "vitest";
import {
  SUPABASE_REFS,
  appEnvFromVercel,
  assertEnv,
  checkEnv,
  resolveAppEnv,
  supabaseRefFromUrl,
} from "@/lib/app-env";

const DEV_URL = `https://${SUPABASE_REFS.dev}.supabase.co`;
const PROD_URL = `https://${SUPABASE_REFS.prod}.supabase.co`;
const LOCAL_URL = "http://127.0.0.1:54321";

describe("resolveAppEnv", () => {
  it("prefers the explicit value", () => {
    expect(resolveAppEnv("preview", "production")).toBe("preview");
  });
  it("derives from VERCEL_ENV when unset", () => {
    expect(resolveAppEnv(undefined, "production")).toBe("production");
    expect(resolveAppEnv(undefined, "preview")).toBe("preview");
    expect(resolveAppEnv(undefined, "development")).toBe("local");
    expect(resolveAppEnv(undefined, undefined)).toBe("local");
    expect(resolveAppEnv("", undefined)).toBe("local");
  });
  it("rejects unknown values", () => {
    expect(() => resolveAppEnv("prod", undefined)).toThrow(/must be one of/);
  });
  it("maps unknown VERCEL_ENV to undefined", () => {
    expect(appEnvFromVercel("staging")).toBeUndefined();
  });
});

describe("supabaseRefFromUrl", () => {
  it("extracts the project ref from hosted URLs", () => {
    expect(supabaseRefFromUrl(DEV_URL)).toBe(SUPABASE_REFS.dev);
    expect(supabaseRefFromUrl(`${PROD_URL}/`)).toBe(SUPABASE_REFS.prod);
  });
  it("ignores local, non-https, look-alike and invalid URLs", () => {
    expect(supabaseRefFromUrl(LOCAL_URL)).toBeUndefined();
    expect(supabaseRefFromUrl(`http://${SUPABASE_REFS.prod}.supabase.co`)).toBeUndefined();
    expect(supabaseRefFromUrl(`https://${SUPABASE_REFS.prod}.supabase.co.evil.example`)).toBeUndefined();
    expect(supabaseRefFromUrl("not a url")).toBeUndefined();
    expect(supabaseRefFromUrl(undefined)).toBeUndefined();
  });
});

describe("checkEnv", () => {
  it("accepts the three intended stacks", () => {
    expect(checkEnv({ appEnv: "production", vercelEnv: "production", supabaseUrl: PROD_URL })).toEqual([]);
    expect(checkEnv({ appEnv: "preview", vercelEnv: "preview", supabaseUrl: DEV_URL })).toEqual([]);
    expect(checkEnv({ supabaseUrl: LOCAL_URL })).toEqual([]);
    expect(checkEnv({ appEnv: "local", supabaseUrl: DEV_URL })).toEqual([]);
  });

  it("fails a production build against the dev project", () => {
    const problems = checkEnv({ appEnv: "production", vercelEnv: "production", supabaseUrl: DEV_URL });
    expect(problems.join()).toMatch(/must use the PROD Supabase project/);
  });

  it("fails a production build against the local stack or with no URL", () => {
    expect(checkEnv({ vercelEnv: "production", supabaseUrl: LOCAL_URL })).toHaveLength(1);
    expect(checkEnv({ vercelEnv: "production" })).toHaveLength(1);
  });

  it("fails preview and local builds against the prod project", () => {
    expect(checkEnv({ vercelEnv: "preview", supabaseUrl: PROD_URL }).join()).toMatch(/must not use the PROD/);
    expect(checkEnv({ supabaseUrl: PROD_URL })).toHaveLength(1);
  });

  it("fails when NEXT_PUBLIC_APP_ENV disagrees with VERCEL_ENV", () => {
    const problems = checkEnv({ appEnv: "preview", vercelEnv: "production", supabaseUrl: DEV_URL });
    expect(problems.join()).toMatch(/Vercel builds this as "production"/);
  });

  it("reports an invalid NEXT_PUBLIC_APP_ENV", () => {
    expect(checkEnv({ appEnv: "staging" })[0]).toMatch(/must be one of/);
  });
});

describe("assertEnv", () => {
  it("returns the resolved env when safe", () => {
    expect(assertEnv({ vercelEnv: "production", supabaseUrl: PROD_URL })).toBe("production");
  });
  it("throws with every problem listed", () => {
    expect(() => assertEnv({ appEnv: "preview", vercelEnv: "production", supabaseUrl: PROD_URL })).toThrow(
      /Environment check failed/,
    );
  });
});
