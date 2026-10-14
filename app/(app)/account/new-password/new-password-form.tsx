"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { updatePassword } from "@/lib/actions/auth";

export function NewPasswordForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(updatePassword, null);
  const fieldError = state?.fieldErrors?.password;

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="password">{t("newPassword")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? "password-error" : "password-hint"}
        />
        {fieldError ? (
          <FieldError id="password-error" message={fieldError} />
        ) : (
          <p id="password-hint" className="text-muted mt-1 text-sm">
            {t("newPasswordHint")}
          </p>
        )}
      </div>
      {state?.error ? (
        <p role="alert" className="bg-danger-soft text-danger rounded-xl px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {t("newPasswordSubmit")}
      </Button>
    </form>
  );
}
