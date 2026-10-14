import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ComingSoon, PageHeader } from "@/components/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: t("upcoming") };
}

export default async function Page() {
  const t = await getTranslations("pages");
  return (
    <>
      <PageHeader title={t("upcoming")} />
      <ComingSoon text={t("comingSoon")} />
    </>
  );
}
