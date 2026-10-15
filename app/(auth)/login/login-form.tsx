"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { signIn } from "@/lib/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(signIn, null);

  return (
    <form action={action} className="space-y-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
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
          autoFocus
        />
      </div>
      <div>
        <Label htmlFor="password">{t("password")}</Label>
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </div>
      {state?.error ? (
        <Alert tone="danger" role="alert">
          {state.error}
        </Alert>
      ) : null}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
      <p className="text-center">
        <Link
          href="/forgot-password"
          className="text-primary inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-medium underline-offset-4 hover:underline"
        >
          {t("forgotPassword")}
        </Link>
      </p>
    </form>
  );
}
