import { Plus, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarHeader } from "@/components/calendar/calendar-header";
import { DayView } from "@/components/calendar/day-view";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getClientForBooking, getPetForBooking } from "@/lib/actions/bookings";
import { lanesFor, loadDay } from "@/lib/calendar-data";
import { addDays, parseDateParam, todayInVilnius, weekdayName } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("calendar") };
}

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const { date: dateParam, client: clientParam, pet: petParam, new: newParam } = await searchParams;
  const date = parseDateParam(dateParam);
  const today = todayInVilnius();
  const isToday = date === today;
  const t = await getTranslations("calendar");
  const ts = await getTranslations("settings");

  const [{ groomers, services, bookings, failed }, preselectedClient] = await Promise.all([
    loadDay(date),
    typeof clientParam === "string"
      ? getClientForBooking(clientParam)
      : // pet first: ?pet=<id> alone opens the sheet with that pet (and its owner, if any)
        typeof petParam === "string" && petParam !== "all"
        ? getPetForBooking(petParam)
        : Promise.resolve(null),
  ]);
  const lanes = lanesFor(groomers, date, bookings);
  const openOnLoad = preselectedClient !== null || newParam === "1";

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col lg:min-h-dvh">
      <CalendarHeader
        view="day"
        date={date}
        eyebrow={
          <span className="flex items-center gap-2">
            <span className="capitalize">{weekdayName(date)}</span>
            {isToday ? <Badge tone="primary">{t("today")}</Badge> : null}
          </span>
        }
        title={<span className="tabular-nums">{date}</span>}
        isCurrent={isToday}
        prevDate={addDays(date, -1)}
        nextDate={addDays(date, 1)}
        newBookingHref={
          groomers.length > 0 ? `/calendar?date=${date < today ? today : date}&new=1` : undefined
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
        <DayView
          key={date}
          date={date}
          today={today}
          lanes={lanes}
          groomers={groomers}
          services={services}
          bookings={bookings}
          openOnLoad={openOnLoad}
          preselectedClient={preselectedClient}
          preselectedPetId={typeof petParam === "string" ? petParam : null}
        />
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
