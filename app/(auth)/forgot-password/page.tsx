import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
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
      <h1 className="mb-2 text-xl font-semibold">{t("resetTitle")}</h1>
      <p className="text-muted mb-5 text-sm">{t("resetIntro")}</p>
      {error === "link" ? (
        <p role="alert" className="bg-danger-soft text-danger mb-4 rounded-xl px-3 py-2 text-sm">
          {t("linkInvalid")}
        </p>
      ) : null}
      <ForgotPasswordForm />
    </>
  );
}
