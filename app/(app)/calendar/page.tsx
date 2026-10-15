import { ChevronLeft, ChevronRight, Plus, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DayView } from "@/components/calendar/day-view";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getClientForBooking } from "@/lib/actions/bookings";
import { loadDay } from "@/lib/calendar-data";
import { addDays, parseDateParam, todayInVilnius, weekdayName } from "@/lib/time";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("calendar") };
}

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const { date: dateParam, client: clientParam, new: newParam } = await searchParams;
  const date = parseDateParam(dateParam);
  const today = todayInVilnius();
  const isToday = date === today;
  const t = await getTranslations("calendar");
  const ts = await getTranslations("settings");

  const [{ groomers, services, bookings, failed }, preselectedClient] = await Promise.all([
    loadDay(date),
    typeof clientParam === "string" ? getClientForBooking(clientParam) : Promise.resolve(null),
  ]);
  const openOnLoad = preselectedClient !== null || newParam === "1";

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
        {groomers.length > 0 ? (
          <Button asChild className="ml-2 hidden lg:inline-flex">
            <Link href={`/calendar?date=${date}&new=1`} scroll={false}>
              <Plus aria-hidden />
              {t("newBooking")}
            </Link>
          </Button>
        ) : null}
      </PageHeader>

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
          groomers={groomers}
          services={services}
          bookings={bookings}
          openOnLoad={openOnLoad}
          preselectedClient={preselectedClient}
        />
      ) : (
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
