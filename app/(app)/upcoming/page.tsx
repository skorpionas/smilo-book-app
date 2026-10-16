import { CalendarDays, Clock, Plus, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageBody, PageHeader } from "@/components/page-header";
import { UpcomingList, type UpcomingDay } from "@/components/upcoming/upcoming-list";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { lanesFor, loadRange } from "@/lib/calendar-data";
import type { IsoDay } from "@/lib/clock";
import { addDays, isoWeekday, todayInVilnius, toVilniusTime } from "@/lib/time";
import { UPCOMING_DAYS, groupUpcoming } from "@/lib/upcoming";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: t("upcoming") };
}

export default async function UpcomingPage() {
  const today = todayInVilnius();
  const tomorrow = addDays(today, 1);
  const last = addDays(today, UPCOMING_DAYS - 1);
  const t = await getTranslations("upcoming");
  const tp = await getTranslations("pages");
  const tc = await getTranslations("calendar");
  const tw = await getTranslations("weekdays");

  const { groomers, services, bookings, failed } = await loadRange(today, addDays(today, UPCOMING_DAYS));
  const groups = groupUpcoming(bookings, today);
  const total = groups.reduce((n, g) => n + g.bookings.length, 0);

  // Every day of the window: busy days with their bookings, free days as one short line
  const byDate = new Map(groups.map((g) => [g.date, g.bookings]));
  const days: UpcomingDay[] = Array.from({ length: UPCOMING_DAYS }, (_, i) => addDays(today, i)).map(
    (date) => ({
      date,
      weekdayLong: tw(`long.${isoWeekday(date) as IsoDay}`),
      relative: date === today ? "today" : date === tomorrow ? "tomorrow" : null,
      firstLaneId: lanesFor(groomers, date, bookings)[0]?.id ?? null,
      bookings: byDate.get(date) ?? [],
    }),
  );

  return (
    <>
      <PageHeader
        title={tp("upcoming")}
        eyebrow={
          <span className="tabular-nums">
            {today.slice(5)} – {last.slice(5)} · {t("total", { count: total })}
          </span>
        }
      >
        <Button asChild variant="ghost" size="icon">
          <Link href="/calendar/week" aria-label={tc("week")}>
            <CalendarDays aria-hidden />
          </Link>
        </Button>
      </PageHeader>
      <PageBody>
        {failed ? (
          <Alert tone="danger" role="alert" className="mb-4">
            {(await getTranslations("errors"))("unknown")}
          </Alert>
        ) : null}

        {groomers.length === 0 && !failed ? (
          <EmptyState
            icon={UserRound}
            title={tc("noGroomersTitle")}
            description={tc("noGroomersText")}
            action={
              <Button asChild>
                <Link href="/settings">
                  <Plus aria-hidden />
                  {(await getTranslations("settings"))("addGroomer")}
                </Link>
              </Button>
            }
          />
        ) : total === 0 ? (
          failed ? null : (
            <EmptyState
              icon={Clock}
              title={t("emptyTitle")}
              description={t("emptyText", { days: UPCOMING_DAYS })}
              action={
                <Button asChild>
                  <Link href={`/calendar?date=${today}&new=1`}>
                    <Plus aria-hidden />
                    {tc("newBooking")}
                  </Link>
                </Button>
              }
            />
          )
        ) : (
          <UpcomingList
            days={days}
            groomers={groomers}
            services={services}
            today={today}
            nowTime={toVilniusTime(new Date())}
          />
        )}
      </PageBody>
    </>
  );
}
