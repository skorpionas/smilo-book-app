import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/alert";
import { ForgotPasswordForm } from "./forgot-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("resetTitle") };
}

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  const { error } = await searchParams;
  const t = await getTranslations("auth");
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">{t("resetTitle")}</h1>
      <p className="text-muted mt-1.5 mb-6 text-base leading-relaxed">{t("resetIntro")}</p>
      {error === "link" ? (
        <Alert tone="danger" role="alert" className="mb-5">
          {t("linkInvalid")}
        </Alert>
      ) : null}
      <ForgotPasswordForm />
    </>
  );
}
