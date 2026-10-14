import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { NewPasswordForm } from "./new-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("newPasswordTitle") };
}

export default async function NewPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <>
      <PageHeader title={t("newPasswordTitle")} />
      <div className="mx-auto max-w-sm p-4">
        <NewPasswordForm />
      </div>
    </>
  );
}
