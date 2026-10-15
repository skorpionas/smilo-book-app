// Which stack this build belongs to, and a guard that stops a production build
// from ever talking to the dev database (or a preview build to the prod one).
//
// Imported by next.config.ts, so: no path aliases, no "server-only", no Node APIs.
// All values here are public (project refs appear in every Supabase URL).

export type AppEnv = "local" | "preview" | "production";

/** Supabase project refs (eu-central-1). See docs/environments.md. */
export const SUPABASE_REFS = {
  dev: "gfnrlbpiqdmlkuyhbwde", // smilo-book-app-dev  → Vercel Preview + Development
  prod: "qxfovtpskynncfkygpzg", // smilo-book-app-prod → Vercel Production
} as const;

const APP_ENVS: readonly AppEnv[] = ["local", "preview", "production"];

function isAppEnv(value: string | undefined): value is AppEnv {
  return APP_ENVS.includes(value as AppEnv);
}

/** Vercel's VERCEL_ENV ("production" | "preview" | "development") → our AppEnv. */
export function appEnvFromVercel(vercelEnv: string | undefined): AppEnv | undefined {
  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "preview";
  if (vercelEnv === "development") return "local";
  return undefined;
}

/** Explicit NEXT_PUBLIC_APP_ENV wins; otherwise derived from VERCEL_ENV; otherwise local. */
export function resolveAppEnv(explicit: string | undefined, vercelEnv: string | undefined): AppEnv {
  if (explicit) {
    if (!isAppEnv(explicit)) {
      throw new Error(`NEXT_PUBLIC_APP_ENV must be one of ${APP_ENVS.join(", ")} (got "${explicit}").`);
    }
    return explicit;
  }
  return appEnvFromVercel(vercelEnv) ?? "local";
}

/** "https://<ref>.supabase.co" → "<ref>"; anything else (local stack, custom domain) → undefined. */
export function supabaseRefFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const { protocol, hostname } = new URL(url);
    const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(hostname);
    return protocol === "https:" && match ? match[1] : undefined;
  } catch {
    return undefined;
  }
}

export interface EnvInput {
  appEnv?: string; // NEXT_PUBLIC_APP_ENV
  vercelEnv?: string; // VERCEL_ENV (set by Vercel at build and run time)
  supabaseUrl?: string; // NEXT_PUBLIC_SUPABASE_URL
}

/**
 * Returns a list of problems; empty means the combination is safe to build.
 * Rules:
 *  - NEXT_PUBLIC_APP_ENV, if set, must agree with VERCEL_ENV.
 *  - production must use the PROD Supabase project.
 *  - preview / local must never use the PROD Supabase project.
 */
export function checkEnv(input: EnvInput): string[] {
  const problems: string[] = [];
  let appEnv: AppEnv;
  try {
    appEnv = resolveAppEnv(input.appEnv, input.vercelEnv);
  } catch (error) {
    return [(error as Error).message];
  }

  const fromVercel = appEnvFromVercel(input.vercelEnv);
  if (input.appEnv && fromVercel && fromVercel !== appEnv) {
    problems.push(
      `NEXT_PUBLIC_APP_ENV="${input.appEnv}" but Vercel builds this as "${input.vercelEnv}". ` +
        `Scope the variable to the right Vercel environment.`,
    );
  }

  const ref = supabaseRefFromUrl(input.supabaseUrl);
  if (appEnv === "production" && ref !== SUPABASE_REFS.prod) {
    problems.push(
      `Production must use the PROD Supabase project (${SUPABASE_REFS.prod}), ` +
        `but NEXT_PUBLIC_SUPABASE_URL is "${input.supabaseUrl ?? ""}".`,
    );
  }
  if (appEnv !== "production" && ref === SUPABASE_REFS.prod) {
    problems.push(
      `A ${appEnv} build must not use the PROD Supabase project. ` +
        `Use the dev project (${SUPABASE_REFS.dev}) or the local stack.`,
    );
  }
  return problems;
}

/** Throws with every problem listed. Called from next.config.ts so a bad build fails fast. */
export function assertEnv(input: EnvInput): AppEnv {
  const problems = checkEnv(input);
  if (problems.length) {
    throw new Error(`Environment check failed:\n- ${problems.join("\n- ")}\nSee docs/environments.md.`);
  }
  return resolveAppEnv(input.appEnv, input.vercelEnv);
}
