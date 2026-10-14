import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_NEXT = new Set(["/account/new-password", "/calendar"]);

/**
 * Password-reset (and invite) e-mail links land here. Two link styles work:
 *  - default Supabase template (PKCE): Supabase verifies the token, then
 *    redirects here with ?code=… — exchanged for a session below. Works in the
 *    same browser that requested the reset (the PKCE verifier is a cookie).
 *  - custom template (needs custom SMTP):
 *    {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/account/new-password
 *    — works from any browser.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/calendar";
  const next = ALLOWED_NEXT.has(nextParam) ? nextParam : "/calendar";

  if (code || (tokenHash && type)) {
    const supabase = await createClient();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ type: type!, token_hash: tokenHash! });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/forgot-password?error=link", request.url));
}
