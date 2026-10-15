"use client";

import { Plus } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";
import { BookingDetailSheet } from "@/components/calendar/booking-detail";
import type { BookingDefaults } from "@/components/calendar/booking-form";
import { AgendaRow } from "@/components/calendar/week-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CalendarBooking, CalendarGroomer, CalendarService } from "@/lib/calendar-data";
import { DAY_OPEN, type DateStr } from "@/lib/clock";
import { cn } from "@/lib/utils";

const BookingSheet = dynamic(() => import("@/components/calendar/booking-form").then((m) => m.BookingSheet));

export type UpcomingDay = {
  date: DateStr;
  /** "pirmadienis", … */
  weekdayLong: string;
  /** "today" / "tomorrow" badge, if any. */
  relative: "today" | "tomorrow" | null;
  /** Groomer to pre-fill when booking on this day (first one working), if any. */
  firstLaneId: string | null;
  bookings: CalendarBooking[];
};

/**
 * Artimiausi (US-04): today's and upcoming bookings, sorted by start time and
 * grouped by date, with a count per day. Only days that have bookings are listed.
 */
export function UpcomingList({
  days,
  groomers,
  services,
  today,
}: {
  days: UpcomingDay[];
  /** Active groomers (detail sheet, booking form). */
  groomers: CalendarGroomer[];
  services: CalendarService[];
  today: DateStr;
}) {
  const t = useTranslations("calendar");
  const tu = useTranslations("upcoming");
  const [selected, setSelected] = React.useState<CalendarBooking | null>(null);
  const [newBooking, setNewBooking] = React.useState<BookingDefaults | null>(null);
  const byId = React.useMemo(() => new Map(groomers.map((g) => [g.id, g])), [groomers]);
  const multipleGroomers = groomers.length > 1;

  const book = (date: DateStr, groomerId: string | null) => {
    const id = groomerId ?? groomers[0]?.id;
    if (id) setNewBooking({ groomerId: id, date, startTime: DAY_OPEN, client: null });
  };

  return (
    <>
      <ol className="space-y-3 pb-28 lg:pb-8" aria-label={tu("listLabel")}>
        {days.map((day) => {
          const count = day.bookings.length;
          return (
            <li
              key={day.date}
              aria-labelledby={`upcoming-${day.date}`}
              className={cn(
                "border-border bg-surface overflow-hidden rounded-xl border shadow-xs",
                day.date === today && "ring-primary/50 ring-2",
              )}
            >
              <div className="flex items-center gap-2 py-1.5 pr-1.5 pl-4">
                <Link
                  id={`upcoming-${day.date}`}
                  href={`/calendar?date=${day.date}`}
                  className="flex min-h-11 min-w-0 flex-1 flex-col justify-center hover:underline"
                  aria-label={t("openDay", { date: `${day.weekdayLong} ${day.date}` })}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold capitalize">
                    {day.weekdayLong}
                    {day.relative ? (
                      <Badge tone={day.relative === "today" ? "primary" : "neutral"}>
                        {day.relative === "today" ? t("today") : tu("tomorrow")}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-muted text-xs tabular-nums">{day.date}</span>
                </Link>
                <span className="bg-surface-muted text-foreground-soft shrink-0 rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums">
                  <span aria-hidden>{count}</span>
                  <span className="sr-only">{t("bookingsCount", { count })}</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("bookOnDay", { date: day.date })}
                  onClick={() => book(day.date, day.firstLaneId)}
                >
                  <Plus aria-hidden />
                </Button>
              </div>
              <ul className="divide-border border-border divide-y border-t">
                {day.bookings.map((b) => {
                  const g = byId.get(b.groomerId);
                  return (
                    <li key={b.id}>
                      <AgendaRow
                        booking={b}
                        color={g?.color ?? "#64748b"}
                        groomerName={multipleGroomers ? g?.name : undefined}
                        onOpen={setSelected}
                      />
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>

      <BookingSheet
        defaults={newBooking}
        onClose={() => setNewBooking(null)}
        groomers={groomers}
        services={services}
        onSaved={() => setNewBooking(null)}
      />
      <BookingDetailSheet booking={selected} groomers={groomers} onClose={() => setSelected(null)} />
    </>
  );
}
