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
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (isPublicPath(next.split("?")[0])) return fallback;
  return next;
}
