import { CalendarDays, ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { GroomerChip } from "@/components/ui/groomer-chip";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  DAY_CLOSE,
  DAY_OPEN,
  minutesToTime,
  parseDateParam,
  timeToMinutes,
  todayInVilnius,
  weekdayName,
} from "@/lib/time";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("calendar") };
}

// Full hours shown in the (decorative) grid preview: 08:00 … 18:00.
const HOURS = Array.from({ length: (timeToMinutes(DAY_CLOSE) - timeToMinutes(DAY_OPEN)) / 60 }, (_, i) =>
  minutesToTime(timeToMinutes(DAY_OPEN) + i * 60),
);

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const { date: dateParam } = await searchParams;
  const date = parseDateParam(dateParam);
  const today = todayInVilnius();
  const isToday = date === today;
  const t = await getTranslations("calendar");

  const supabase = await createClient();
  const { data: groomers } = await supabase
    .from("groomers")
    .select("id, name, color")
    .eq("is_active", true)
    .order("sort_order");

  const columns = groomers ?? [];
  const gridTemplate = `3.5rem repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))`;

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col lg:min-h-dvh">
      <PageHeader
        wide
        eyebrow={
          <span className="flex items-center gap-2">
            <span className="capitalize">{weekdayName(date)}</span>
            {isToday ? <Badge tone="primary">{t("today")}</Badge> : null}
          </span>
        }
        title={<span className="tabular-nums">{date}</span>}
        className="border-b-0"
      >
        <div
          role="group"
          aria-label={t("dayNavigation")}
          className="border-border bg-surface flex items-center rounded-full border p-0.5 shadow-xs"
        >
          <Button asChild variant="ghost" size="icon" className="rounded-full" aria-label={t("previousDay")}>
            <Link href={`/calendar?date=${addDays(date, -1)}`}>
              <ChevronLeft aria-hidden />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className={cn("rounded-full px-3", isToday && "text-muted")}
          >
            <Link href="/calendar" aria-current={isToday ? "date" : undefined}>
              {t("today")}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="rounded-full" aria-label={t("nextDay")}>
            <Link href={`/calendar?date=${addDays(date, 1)}`}>
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        </div>
      </PageHeader>

      {columns.length > 0 ? (
        <>
          {/* Groomer column headers: name always visible, colour only as dot + tint + stripe. */}
          <div
            className="border-border bg-background/85 sticky top-[calc(4rem+env(safe-area-inset-top))] z-10 grid border-b backdrop-blur-md"
            style={{ gridTemplateColumns: gridTemplate }}
            aria-label={t("groomers")}
            role="group"
          >
            <span aria-hidden />
            {columns.map((g) => (
              <div key={g.id} className="relative flex min-w-0 justify-center px-1 pt-1.5 pb-2.5">
                <GroomerChip name={g.name} color={g.color} className="max-w-full truncate" />
                <span
                  aria-hidden
                  className="absolute inset-x-1 bottom-0 h-0.5 rounded-full"
                  style={{ backgroundColor: g.color }}
                />
              </div>
            ))}
          </div>

          {/* Week 2 replaces this with the real 15-min grid. The faint rows preview its shape. */}
          <div className="relative flex-1">
            <div
              aria-hidden
              className="grid pt-3"
              style={{ gridTemplateColumns: gridTemplate, gridAutoRows: "4rem" }}
            >
              {HOURS.map((hour) => (
                <div key={hour} className="contents">
                  <div className="text-muted -translate-y-2 pr-2 text-right text-xs tabular-nums">{hour}</div>
                  {columns.map((g) => (
                    <div key={g.id} className="border-border border-t border-l" />
                  ))}
                </div>
              ))}
            </div>
            <div className="from-background/30 via-background/85 to-background absolute inset-0 flex items-start justify-center bg-gradient-to-b px-4 pt-10 sm:pt-16">
              <div className="border-border bg-surface w-full max-w-md rounded-xl border shadow-sm">
                <EmptyState
                  icon={CalendarDays}
                  title={t("comingSoonTitle")}
                  description={t("comingSoonText")}
                  className="py-8 sm:py-10"
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <EmptyState icon={UserRound} title={t("noGroomersTitle")} description={t("noGroomersText")} />
      )}
    </div>
  );
}
