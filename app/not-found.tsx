import { PawPrint } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <EmptyState
        icon={PawPrint}
        headingLevel={1}
        title={t("notFoundTitle")}
        description={t("notFoundText")}
        action={
          <Button asChild>
            <Link href="/calendar">{t("backHome")}</Link>
          </Button>
        }
      />
    </main>
  );
}
