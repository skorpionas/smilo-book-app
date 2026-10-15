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
 * Sticky calendar header shared by the day, week and month views. Fixed height
 * (phone 7 rem in two rows, desktop 4 rem in one) so the lane headers can stick
 * right under it — see CALENDAR_STICKY_TOP in ./sticky.
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

  const navButton = "rounded-full focus-visible:outline-offset-[-2px] [&_svg]:size-5";

  return (
    <header className="pt-safe bg-background/85 supports-[backdrop-filter]:bg-background/75 sticky top-0 z-20 backdrop-blur-md">
      {/* Phone: title + navigation (3.5 rem), then the view switcher (3.5 rem).
          Desktop: everything in one 4 rem row. Lane headers stick right under it. */}
      <div className="flex h-14 w-full items-center gap-2 px-4 sm:px-6 lg:h-16 lg:gap-4">
        <div className="min-w-0 flex-1 lg:flex-none">
          <div className="text-muted text-sm leading-tight font-medium">{eyebrow}</div>
          <h1 className="font-display truncate text-[1.375rem] leading-tight font-semibold tracking-tight">
            {title}
          </h1>
        </div>

        <ViewSwitch
          view={view}
          date={date}
          label={t("viewSwitch")}
          labels={labelsOf(t)}
          className="hidden lg:grid"
        />
        <div className="hidden flex-1 lg:block" />

        {/* Only when away from the current period: arrows never move. */}
        {!isCurrent ? (
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="shrink-0 rounded-full px-3.5 focus-visible:outline-offset-[-2px]"
          >
            <Link href={calendarHref(view)}>{t("today")}</Link>
          </Button>
        ) : null}
        <div
          role="group"
          aria-label={nav.group}
          className="border-border bg-surface flex shrink-0 items-center rounded-full border p-0.5 shadow-xs"
        >
          <Button asChild variant="ghost" size="icon" className={navButton} aria-label={nav.prev}>
            <Link href={calendarHref(view, prevDate)}>
              <ChevronLeft aria-hidden />
            </Link>
          </Button>
          <span aria-hidden className="bg-border h-5 w-px" />
          <Button asChild variant="ghost" size="icon" className={navButton} aria-label={nav.next}>
            <Link href={calendarHref(view, nextDate)}>
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        </div>
        {newBookingHref ? (
          <Button asChild className="hidden shrink-0 lg:inline-flex">
            <Link href={newBookingHref} scroll={false}>
              <Plus aria-hidden />
              {t("newBooking")}
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="flex h-14 items-center px-4 sm:px-6 lg:hidden">
        <ViewSwitch
          view={view}
          date={date}
          label={t("viewSwitch")}
          labels={labelsOf(t)}
          className="grid w-full sm:w-auto"
        />
      </div>
    </header>
  );
}

function labelsOf(t: (key: CalendarViewKind) => string): Record<CalendarViewKind, string> {
  return { day: t("day"), week: t("week"), month: t("month") };
}

/** Diena · Savaitė · Mėnuo — keeps the date when switching. */
function ViewSwitch({
  view,
  date,
  label,
  labels,
  className,
}: {
  view: CalendarViewKind;
  date: string;
  label: string;
  labels: Record<CalendarViewKind, string>;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn("bg-surface-muted ring-border grid-cols-3 rounded-lg p-0.5 ring-1 ring-inset", className)}
    >
      {(["day", "week", "month"] as const).map((v) => (
        <Link
          key={v}
          href={calendarHref(v, date)}
          aria-current={v === view ? "page" : undefined}
          className={cn(
            "flex h-11 items-center justify-center rounded-md px-5 text-sm transition-colors focus-visible:outline-offset-[-2px]",
            v === view
              ? "bg-surface text-foreground ring-border-strong font-semibold shadow-sm ring-1"
              : "text-muted hover:text-foreground font-medium",
          )}
        >
          {labels[v]}
        </Link>
      ))}
    </nav>
  );
}
