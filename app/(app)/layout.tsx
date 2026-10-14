import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BottomNav, SideNav } from "@/components/nav/nav-links";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import { requireUser } from "@/lib/auth";

// Every page in this group shows private data and is rendered per request.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Defence in depth: the proxy already redirects, this verifies the JWT again.
  await requireUser();
  const t = await getTranslations();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-border bg-surface sticky top-0 hidden h-dvh flex-col border-r p-4 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-64.png" alt="" width={32} height={32} className="rounded-lg" />
          <span className="text-lg font-semibold">{t("app.name")}</span>
        </div>
        <SideNav />
        <form action={signOut} className="mt-auto">
          <Button type="submit" variant="ghost" className="text-muted w-full justify-start">
            <LogOut aria-hidden />
            {t("nav.logout")}
          </Button>
        </form>
      </aside>

      {/* bottom padding leaves room for the phone tab bar */}
      <div className="min-w-0 pb-24 lg:pb-0">{children}</div>
      <BottomNav />
    </div>
  );
}
