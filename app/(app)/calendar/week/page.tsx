import { Plus, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarHeader } from "@/components/calendar/calendar-header";
import { WeekView, type WeekDay } from "@/components/calendar/week-view";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { lanesFor, loadRange } from "@/lib/calendar-data";
import type { IsoDay } from "@/lib/clock";
import { addDays, isoWeekNumber, isoWeekday, parseDateParam, todayInVilnius, weekDays } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("calendar");
  return { title: t("week") };
}

export default async function WeekPage({ searchParams }: PageProps<"/calendar/week">) {
  const { date: dateParam } = await searchParams;
  const date = parseDateParam(dateParam);
  const today = todayInVilnius();
  const dates = weekDays(date);
  const monday = dates[0];
  const sunday = dates[6];
  const isCurrent = dates.includes(today);
  const t = await getTranslations("calendar");
  const tw = await getTranslations("weekdays");
  const ts = await getTranslations("settings");

  const { groomers, services, bookings, failed } = await loadRange(monday, addDays(sunday, 1));

  const days: WeekDay[] = dates.map((d) => {
    const n = isoWeekday(d) as IsoDay;
    return {
      date: d,
      weekdayShort: tw(`short.${n}`),
      weekdayLong: tw(`long.${n}`),
      lanes: lanesFor(groomers, d, bookings),
      bookings: bookings.filter((b) => b.date === d),
    };
  });

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col lg:min-h-dvh">
      <CalendarHeader
        view="week"
        date={date}
        eyebrow={`${monday.slice(0, 4)} · ${t("weekNumber", { week: isoWeekNumber(monday) })}`}
        title={
          <span className="tabular-nums">
            {monday.slice(5)} – {sunday.slice(5)}
          </span>
        }
        isCurrent={isCurrent}
        prevDate={addDays(monday, -7)}
        nextDate={addDays(monday, 7)}
        newBookingHref={
          groomers.length > 0 ? `/calendar?date=${isCurrent ? today : monday}&new=1` : undefined
        }
      />

      {failed ? (
        <div className="px-4 pb-2 sm:px-6">
          <Alert tone="danger" role="alert">
            {(await getTranslations("errors"))("unknown")}
          </Alert>
        </div>
      ) : null}

      {groomers.length > 0 ? (
        <WeekView days={days} today={today} groomers={groomers} services={services} />
      ) : failed ? null : (
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
      )}
    </div>
  );
}
