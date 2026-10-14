"use client";

import { CalendarDays, Clock, Search, Settings, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  key: "calendar" | "upcoming" | "search" | "clients" | "settings";
  icon: LucideIcon;
};

export const NAV_ITEMS: Item[] = [
  { href: "/calendar", key: "calendar", icon: CalendarDays },
  { href: "/upcoming", key: "upcoming", icon: Clock },
  { href: "/search", key: "search", icon: Search },
  { href: "/clients", key: "clients", icon: Users },
  { href: "/settings", key: "settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Bottom tab bar, phones and tablets (< 1024 px). */
export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("mainNavigation")}
      className="pb-safe border-border bg-surface/95 fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {NAV_ITEMS.map(({ href, key, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted hover:text-foreground",
                )}
              >
                <Icon className="size-6" aria-hidden strokeWidth={active ? 2.4 : 1.8} />
                <span>{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Left sidebar, laptops (≥ 1024 px). */
export function SideNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("mainNavigation")}>
      <ul className="space-y-1">
        {NAV_ITEMS.map(({ href, key, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium",
                  active ? "bg-primary-soft text-primary" : "text-foreground hover:bg-stone-100",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
