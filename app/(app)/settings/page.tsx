import { ChevronRight, KeyRound, LogOut, Palette, Scissors } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { signOut } from "@/lib/actions/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: t("settings") };
}

const rowClass =
  "flex min-h-14 w-full items-center gap-3 px-4 text-left text-base transition-colors hover:bg-surface-muted";

export default async function Page() {
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t("pages.settings")} />
      <PageBody className="max-w-2xl space-y-8">
        <Card>
          <EmptyState
            icon={Scissors}
            title={t("pages.settingsServicesTitle")}
            description={t("pages.settingsServicesText")}
            className="py-10 sm:py-12"
          />
        </Card>

        <section aria-labelledby="account-heading">
          <h2
            id="account-heading"
            className="text-muted mb-2 px-1 text-xs font-semibold tracking-wider uppercase"
          >
            {t("pages.settingsAccount")}
          </h2>
          <Card className="divide-border divide-y overflow-hidden">
            <Link href="/account/new-password" className={rowClass}>
              <KeyRound aria-hidden className="text-muted size-5" />
              <span className="flex-1">{t("pages.changePassword")}</span>
              <ChevronRight aria-hidden className="text-muted size-5" />
            </Link>
            <Link href="/styleguide" className={rowClass}>
              <Palette aria-hidden className="text-muted size-5" />
              <span className="flex-1">
                <span className="block">{t("pages.styleguide")}</span>
                <span className="text-muted block text-sm">{t("pages.styleguideHint")}</span>
              </span>
              <ChevronRight aria-hidden className="text-muted size-5" />
            </Link>
            {/* Phones have no sidebar, so log-out lives here too. */}
            <form action={signOut} className="lg:hidden">
              <button type="submit" className={`${rowClass} text-danger`}>
                <LogOut aria-hidden className="size-5" />
                <span className="flex-1">{t("nav.logout")}</span>
              </button>
            </form>
          </Card>
        </section>
      </PageBody>
    </>
  );
}
