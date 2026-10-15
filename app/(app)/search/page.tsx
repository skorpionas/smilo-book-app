import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageBody, PageHeader } from "@/components/page-header";
import { SearchPanel } from "@/components/search/search-panel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: t("search") };
}

export default async function Page() {
  const t = await getTranslations("pages");
  return (
    <>
      <PageHeader title={t("search")} />
      <PageBody className="max-w-2xl">
        <SearchPanel />
      </PageBody>
    </>
  );
}
