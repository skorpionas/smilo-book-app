import { Plus, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarHeader } from "@/components/calendar/calendar-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MonthGrid } from "@/components/calendar/month-grid";
import { loadRange } from "@/lib/calendar-data";
import {
  addDays,
  addMonths,
  monthTitle,
  monthWeeks,
  parseDateParam,
  startOfMonth,
  todayInVilnius,
} from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("calendar");
  return { title: t("month") };
}

/** Month view (server-rendered only; see MonthGrid). */
export default async function MonthPage({ searchParams }: PageProps<"/calendar/month">) {
  const { date: dateParam } = await searchParams;
  const date = parseDateParam(dateParam);
  const today = todayInVilnius();
  const first = startOfMonth(date);
  const month = first.slice(0, 7);
  const weeks = monthWeeks(first);
  const t = await getTranslations("calendar");
  const ts = await getTranslations("settings");

  const { groomers, bookings, failed } = await loadRange(weeks[0][0], addDays(weeks.at(-1)![6], 1));

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col lg:min-h-dvh">
      <CalendarHeader
        view="month"
        date={date}
        eyebrow={t("month")}
        title={monthTitle(first)}
        isCurrent={today.startsWith(month)}
        prevDate={addMonths(first, -1)}
        nextDate={addMonths(first, 1)}
        newBookingHref={
          groomers.length > 0 ? `/calendar?date=${today.startsWith(month) ? today : first}&new=1` : undefined
        }
      />

      {failed ? (
        <div className="px-4 pb-2 sm:px-6">
          <Alert tone="danger" role="alert">
            {(await getTranslations("errors"))("unknown")}
          </Alert>
        </div>
      ) : null}

      {groomers.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title={t("noGroomersTitle")}
          description={t("noGroomersText")}
          action={
            <Button asChild>
              <Link href="/settings">
                <Plus aria-hidden />
                {ts("addGroomer")}
              </Link>
            </Button>
          }
        />
      ) : (
        <MonthGrid first={first} today={today} groomers={groomers} bookings={bookings} />
      )}
    </div>
  );
}
