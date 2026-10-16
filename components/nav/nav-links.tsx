"use client";

import { CalendarDays, Clock, PawPrint, Search, Settings, type LucideIcon } from "lucide-react";
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
  { href: "/clients", key: "clients", icon: PawPrint },
  { href: "/settings", key: "settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  // Pet pages live under the pet-first directory tab.
  if (href === "/clients" && (pathname === "/pets" || pathname.startsWith("/pets/"))) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Bottom tab bar, phones and tablets (< 1024 px). Active tab = soft pill behind the icon + bold label. */
export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("mainNavigation")}
      className="pb-safe border-border bg-surface/90 supports-[backdrop-filter]:bg-surface/80 fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5 px-1">
        {NAV_ITEMS.map(({ href, key, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex min-h-16 flex-col items-center justify-center gap-1 rounded-md px-0.5 text-xs transition-colors",
                  active ? "text-foreground font-semibold" : "text-muted hover:text-foreground font-medium",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200",
                    active ? "bg-primary-soft text-primary-soft-foreground" : "group-hover:bg-surface-muted",
                  )}
                >
                  <Icon className="size-[1.375rem]" aria-hidden strokeWidth={active ? 2.25 : 1.75} />
                </span>
                <span className="max-w-full truncate">{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Left navigation from 1024 px. iPad landscape and small laptops (1024–1279 px) get a
 * compact rail (icon + short label) so the week grid keeps its width; the full
 * sidebar with labels beside the icons starts at 1280 px.
 */
export function SideNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("mainNavigation")}>
      <ul className="space-y-1 xl:space-y-0.5">
        {NAV_ITEMS.map(({ href, key, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-0.5 text-[0.6875rem] leading-tight transition-colors",
                  "xl:min-h-11 xl:flex-row xl:justify-start xl:gap-3 xl:px-3 xl:text-[0.9375rem]",
                  active
                    ? "bg-surface text-foreground ring-border font-semibold shadow-xs ring-1"
                    : "text-foreground-soft hover:bg-surface-muted hover:text-foreground font-medium",
                )}
              >
                <Icon
                  className={cn("size-5", active ? "text-primary" : "text-muted")}
                  aria-hidden
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span className="max-w-full truncate">{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
