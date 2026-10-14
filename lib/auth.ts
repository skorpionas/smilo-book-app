import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string | null };

/**
 * Verified current user for Server Components and Server Actions.
 * Uses getClaims() (verifies the JWT) — never trusts getSession() alone.
 * Redirects to /login when there is no valid session.
 */
export const requireUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) redirect("/login");
  return { id: sub, email: typeof data.claims.email === "string" ? data.claims.email : null };
});
