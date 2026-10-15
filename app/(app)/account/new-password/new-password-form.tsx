"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Label } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { updatePassword } from "@/lib/actions/auth";

export function NewPasswordForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(updatePassword, null);
  const fieldError = state?.fieldErrors?.password;

  return (
    <form action={action} className="space-y-5">
      <div>
        <Label htmlFor="password">{t("newPassword")}</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          minLength={12}
          required
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? "password-error" : "password-hint"}
        />
        {fieldError ? (
          <FieldError id="password-error" message={fieldError} />
        ) : (
          <FieldHint id="password-hint">{t("newPasswordHint")}</FieldHint>
        )}
      </div>
      {state?.error ? (
        <Alert tone="danger" role="alert">
          {state.error}
        </Alert>
      ) : null}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {t("newPasswordSubmit")}
      </Button>
    </form>
  );
}
