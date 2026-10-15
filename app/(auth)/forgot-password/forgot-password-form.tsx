"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { requestPasswordReset } from "@/lib/actions/auth";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(requestPasswordReset, null);

  return (
    <form action={action} className="space-y-5">
      <div>
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
      </div>
      {state?.success ? (
        <Alert tone="success" role="status">
          {state.success}
        </Alert>
      ) : null}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {t("resetSubmit")}
      </Button>
      <p className="text-center">
        <Link
          href="/login"
          className="text-primary inline-flex min-h-11 items-center gap-1.5 rounded-sm px-2 text-sm font-medium underline-offset-4 hover:underline"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t("backToLogin")}
        </Link>
      </p>
    </form>
  );
}
