import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg">{t("notFound")}</p>
      <Button asChild variant="secondary">
        <Link href="/calendar">{t("backHome")}</Link>
      </Button>
    </main>
  );
}
