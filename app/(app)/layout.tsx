import { LogOut } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EnvBadge } from "@/components/env-badge";
import { BottomNav, SideNav } from "@/components/nav/nav-links";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toast";
import { signOut } from "@/lib/actions/auth";
import { requireUser } from "@/lib/auth";

// Every page in this group shows private data and is rendered per request.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Defence in depth: the proxy already redirects, this verifies the JWT again.
  await requireUser();
  const t = await getTranslations();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[5.5rem_1fr] xl:grid-cols-[16rem_1fr]">
      <aside className="border-border bg-sidebar sticky top-0 hidden h-dvh flex-col border-r px-2 py-4 lg:flex xl:px-3">
        <Link
          href="/calendar"
          aria-label={t("app.name")}
          className="hover:bg-surface-muted mb-6 flex min-h-11 flex-col items-center gap-1 rounded-md px-2 transition-colors xl:flex-row xl:gap-2.5"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-64.png" alt="" width={32} height={32} className="rounded-lg" />
          <span className="font-display hidden text-xl font-semibold tracking-tight xl:inline">
            {t("app.name")}
          </span>
          <EnvBadge />
        </Link>
        <SideNav />
        <form action={signOut} className="border-border mt-auto border-t pt-3">
          <Button
            type="submit"
            variant="ghost"
            aria-label={t("nav.logout")}
            className="text-foreground-soft [&_svg]:text-muted w-full justify-center gap-3 px-3 text-[0.9375rem] xl:justify-start"
          >
            <LogOut aria-hidden />
            <span className="hidden xl:inline">{t("nav.logout")}</span>
          </Button>
        </form>
      </aside>

      {/* bottom padding leaves room for the phone tab bar + home indicator */}
      <main className="min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</main>
      <BottomNav />
      {/* Phones have no "Smilo" name on screen: small floating marker instead. */}
      <EnvBadge variant="floating" className="lg:hidden" />
      <Toaster />
    </div>
  );
}
