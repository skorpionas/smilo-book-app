/** Paths reachable without a session. Everything else requires login. */
const PUBLIC_PATHS = ["/login"];

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
