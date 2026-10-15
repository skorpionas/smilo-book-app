import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
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
      <PageBody className="max-w-md">
        <Card>
          <CardContent>
            <NewPasswordForm />
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
