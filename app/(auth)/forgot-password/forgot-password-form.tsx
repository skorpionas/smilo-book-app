"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { requestPasswordReset } from "@/lib/actions/auth";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(requestPasswordReset, null);

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="username" inputMode="email" required />
      </div>
      {state?.success ? (
        <p role="status" className="bg-primary-soft text-primary rounded-xl px-3 py-2 text-sm">
          {state.success}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {t("resetSubmit")}
      </Button>
      <p className="text-center">
        <Link
          href="/login"
          className="text-primary inline-block py-2 text-sm underline-offset-4 hover:underline"
        >
          {t("backToLogin")}
        </Link>
      </p>
    </form>
  );
}
