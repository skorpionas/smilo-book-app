/** Paths reachable without a session. Everything else requires login. */
const PUBLIC_PATHS = ["/login", "/forgot-password", "/auth/confirm"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Only allow same-site relative redirects after login ("/clients/1"),
 * never "//evil.com" or absolute URLs.
 */
export function safeNextPath(next: unknown, fallback = "/calendar"): string {
  if (typeof next !== "string" || next.length > 512) return fallback;
  // Browsers drop tabs / newlines and treat a backslash like "/" in URLs, so a tab or
  // backslash after the first "/" can turn the path into "//evil.com". Refuse them anywhere.

  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (isPublicPath(next.split("?")[0])) return fallback;
  return next;
}

/**
 * The app's own origin for links in e-mails (password reset). Never taken from the
 * request's Host / X-Forwarded-Host headers, which a client can set: a forged host
 * would put an attacker's domain into the reset link. Order: NEXT_PUBLIC_SITE_URL,
 * then Vercel's production / deployment URL, then localhost for development.
 */
export function siteOrigin(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return new URL(explicit).origin;
  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return `http://localhost:${env.PORT ?? 3000}`;
}
