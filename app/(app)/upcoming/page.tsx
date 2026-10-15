import { Clock } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageBody, PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: t("upcoming") };
}

export default async function Page() {
  const t = await getTranslations("pages");
  return (
    <>
      <PageHeader title={t("upcoming")} />
      <PageBody>
        <EmptyState icon={Clock} title={t("upcomingEmptyTitle")} description={t("upcomingEmptyText")} />
      </PageBody>
    </>
  );
}
