import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CalendarViewKind = "day" | "week" | "month";

const ROUTES: Record<CalendarViewKind, string> = {
  day: "/calendar",
  week: "/calendar/week",
  month: "/calendar/month",
};

export function calendarHref(view: CalendarViewKind, date?: string) {
  return date ? `${ROUTES[view]}?date=${date}` : ROUTES[view];
}

/**
 * Sticky calendar header shared by the day, week and month views.
 * Row 1: eyebrow + title, ◀ Šiandien ▶ (and the desktop "new booking" button).
 * Row 2: Diena · Savaitė · Mėnuo switcher. Total height is fixed (7.5 rem) so the
 * day view's sticky groomer row can sit right under it.
 */
export async function CalendarHeader({
  view,
  date,
  eyebrow,
  title,
  isCurrent,
  prevDate,
  nextDate,
  newBookingHref,
}: {
  view: CalendarViewKind;
  /** Anchor date carried over when switching views. */
  date: string;
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  /** The period shown contains today. */
  isCurrent: boolean;
  prevDate: string;
  nextDate: string;
  newBookingHref?: string;
}) {
  const t = await getTranslations("calendar");
  const nav = {
    day: { group: t("dayNavigation"), prev: t("previousDay"), next: t("nextDay") },
    week: { group: t("weekNavigation"), prev: t("previousWeek"), next: t("nextWeek") },
    month: { group: t("monthNavigation"), prev: t("previousMonth"), next: t("nextMonth") },
  }[view];

  return (
    <header className="pt-safe border-border bg-background/85 supports-[backdrop-filter]:bg-background/75 sticky top-0 z-20 backdrop-blur-md">
      <div className="flex h-16 w-full items-center gap-2 px-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="text-muted text-sm leading-tight font-medium">{eyebrow}</div>
          <h1 className="font-display truncate text-[1.375rem] leading-tight font-semibold tracking-tight">
            {title}
          </h1>
        </div>
        <div
          role="group"
          aria-label={nav.group}
          className="border-border bg-surface flex shrink-0 items-center rounded-full border p-0.5 shadow-xs"
        >
          <Button asChild variant="ghost" size="icon" className="rounded-full" aria-label={nav.prev}>
            <Link href={calendarHref(view, prevDate)}>
              <ChevronLeft aria-hidden />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className={cn("rounded-full px-3", isCurrent && "text-muted")}
          >
            <Link href={calendarHref(view)} aria-current={isCurrent ? "date" : undefined}>
              {t("today")}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="rounded-full" aria-label={nav.next}>
            <Link href={calendarHref(view, nextDate)}>
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        </div>
        {newBookingHref ? (
          <Button asChild className="ml-2 hidden shrink-0 lg:inline-flex">
            <Link href={newBookingHref} scroll={false}>
              <Plus aria-hidden />
              {t("newBooking")}
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="flex h-14 items-center px-4 sm:px-6">
        <nav
          aria-label={t("viewSwitch")}
          className="bg-surface-muted grid w-full grid-cols-3 rounded-lg p-0.5 sm:w-auto"
        >
          {(["day", "week", "month"] as const).map((v) => (
            <Link
              key={v}
              href={calendarHref(v, date)}
              aria-current={v === view ? "page" : undefined}
              className={cn(
                "focus-visible:ring-ring/40 flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                v === view ? "bg-surface text-foreground shadow-xs" : "text-muted hover:text-foreground",
              )}
            >
              {t(v)}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
