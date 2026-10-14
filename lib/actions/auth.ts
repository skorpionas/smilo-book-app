"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth-paths";
import { createClient } from "@/lib/supabase/server";

export type FormState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<string, string>>;
} | null;

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("auth");
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: t("invalidCredentials") };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Never reveal whether the e-mail exists.
    return { error: error.status === 400 ? t("invalidCredentials") : t("genericError") };
  }
  redirect(safeNextPath(formData.get("next")));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("auth");
  const email = z.email().safeParse(formData.get("email"));
  // Same answer whether or not the address exists.
  if (!email.success) return { success: t("resetSent") };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/account/new-password`,
  });
  return { success: t("resetSent") };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("auth");
  const password = z.string().min(12).max(72).safeParse(formData.get("password"));
  if (!password.success) return { fieldErrors: { password: t("passwordTooShort") } };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: error.code === "weak_password" ? t("passwordTooShort") : t("genericError") };
  redirect("/calendar");
}

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
