"use client";

import { Ban, CircleCheck, Plus, TriangleAlert, UserX } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CalendarBooking, CalendarGroomer, CalendarLane, CalendarService } from "@/lib/calendar-data";
import { DAY_CLOSE, DAY_OPEN, GRID_ROWS, SLOT_MINUTES, minutesToTime, type DateStr } from "@/lib/clock";
import { cn } from "@/lib/utils";
import { CALENDAR_STICKY_TOP } from "./sticky";
import { BookingDetailSheet } from "./booking-detail";
import type { BookingDefaults } from "./booking-form";
import { CLOSE, GroomerColumn, OPEN, ROW_REM, SLOTS, useNowMinutes } from "./day-view";
import { useBookingDrag } from "./drag-move";

const BookingSheet = dynamic(() => import("./booking-form").then((m) => m.BookingSheet));

export type WeekDay = {
  date: DateStr;
  /** "Pr", "An", … */
  weekdayShort: string;
  /** "pirmadienis", … */
  weekdayLong: string;
  lanes: CalendarLane[];
  bookings: CalendarBooking[];
};

/**
 * Week view (US-03): Mon–Sun for every groomer, colour-coded.
 * Phone / tablet: agenda list grouped by day. Desktop (≥ 1024 px): 7 day columns,
 * each split into the lanes of the groomers working that day.
 */
export function WeekView({
  days,
  today,
  groomers,
  services,
}: {
  days: WeekDay[];
  today: DateStr;
  groomers: CalendarGroomer[];
  services: CalendarService[];
}) {
  const router = useRouter();
  const [newBooking, setNewBooking] = React.useState<BookingDefaults | null>(null);
  const [selected, setSelected] = React.useState<CalendarBooking | null>(null);
  const showsToday = days.some((d) => d.date === today);
  const nowMinutes = useNowMinutes(showsToday);
  const colorOf = React.useMemo(() => new Map(groomers.map((g) => [g.id, g.color])), [groomers]);
  const drag = useBookingDrag(groomers);

  const book = (date: DateStr, groomerId?: string, startTime: string = DAY_OPEN) =>
    setNewBooking({ groomerId: groomerId ?? groomers[0].id, date, startTime, client: null });

  return (
    <>
      <WeekAgenda days={days} today={today} colorOf={colorOf} onOpen={setSelected} onBook={book} />
      <WeekGrid
        days={days}
        today={today}
        nowMinutes={nowMinutes}
        onOpen={drag.guardClick(setSelected)}
        onSlot={drag.guardClick((date: DateStr, groomerId: string, time: string) =>
          book(date, groomerId, time),
        )}
        drag={drag}
      />
      {drag.dialog}

      <BookingSheet
        defaults={newBooking}
        onClose={() => setNewBooking(null)}
        groomers={groomers}
        services={services}
        onSaved={(savedDate) => {
          setNewBooking(null);
          if (!days.some((d) => d.date === savedDate)) router.push(`/calendar/week?date=${savedDate}`);
        }}
      />
      <BookingDetailSheet booking={selected} groomers={groomers} onClose={() => setSelected(null)} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Phone / tablet: agenda list
// ---------------------------------------------------------------------------

function WeekAgenda({
  days,
  today,
  colorOf,
  onOpen,
  onBook,
}: {
  days: WeekDay[];
  today: DateStr;
  colorOf: Map<string, string>;
  onOpen: (b: CalendarBooking) => void;
  onBook: (date: DateStr, groomerId?: string) => void;
}) {
  const t = useTranslations("calendar");

  return (
    <ol
      className="space-y-3 px-4 pt-1 pb-28 sm:px-6 md:grid md:grid-cols-2 md:items-start md:gap-3 md:space-y-0 lg:hidden"
      aria-label={t("weekGrid")}
    >
      {days.map((day) => {
        const visible = day.bookings
          .filter((b) => b.status !== "cancelled")
          .sort((a, b) => a.startTime.localeCompare(b.startTime));
        const count = visible.filter((b) => b.kind === "booking").length;
        const isToday = day.date === today;
        const closed = day.lanes.length === 0;
        return (
          <li
            key={day.date}
            aria-labelledby={`agenda-${day.date}`}
            className={cn(
              "border-border bg-surface overflow-hidden rounded-xl border shadow-xs",
              isToday && "ring-primary/50 ring-2",
              closed && visible.length === 0 && "bg-surface-muted/60 shadow-none",
            )}
          >
            <div className="flex items-center gap-2 py-1.5 pr-1.5 pl-4">
              <Link
                id={`agenda-${day.date}`}
                href={`/calendar?date=${day.date}`}
                className="flex min-h-11 min-w-0 flex-1 flex-col justify-center hover:underline"
                aria-label={t("openDay", { date: `${day.weekdayLong} ${day.date}` })}
              >
                <span className="flex items-center gap-2 text-sm font-semibold capitalize">
                  {day.weekdayLong}
                  {isToday ? <Badge tone="primary">{t("today")}</Badge> : null}
                </span>
                <span className="text-muted text-xs tabular-nums">
                  {day.date}
                  {!closed ? ` · ${t("bookingsCount", { count })}` : null}
                </span>
              </Link>
              <span className="flex shrink-0 items-center -space-x-1" aria-hidden>
                {day.lanes.map((g) => (
                  <span
                    key={g.id}
                    title={g.name}
                    className="ring-surface size-3 rounded-full ring-2"
                    style={{ backgroundColor: g.color }}
                  />
                ))}
              </span>
              {!closed && day.date >= today ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("bookOnDay", { date: day.date })}
                  onClick={() => onBook(day.date, day.lanes[0]?.id)}
                >
                  <Plus aria-hidden />
                </Button>
              ) : null}
            </div>

            {visible.length > 0 ? (
              <ul className="divide-border border-border divide-y border-t">
                {visible.map((b) => (
                  <li key={b.id}>
                    <AgendaRow booking={b} color={colorOf.get(b.groomerId) ?? "#64748b"} onOpen={onOpen} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted border-border border-t px-4 py-2.5 text-sm">
                {closed ? t("closed") : t("free")}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** One booking row of an agenda list (week agenda, Artimiausi). */
export function AgendaRow({
  booking,
  color,
  groomerName,
  onOpen,
}: {
  booking: CalendarBooking;
  color: string;
  /** Shown in the text when the list mixes groomers (colour alone isn't enough). */
  groomerName?: string;
  onOpen: (b: CalendarBooking) => void;
}) {
  const t = useTranslations("calendar");
  const range = `${booking.startTime}–${booking.endTime}`;

  if (booking.kind === "block") {
    return (
      <button
        type="button"
        onClick={() => onOpen(booking)}
        className="hover:bg-surface-muted flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left"
      >
        <span aria-hidden className="w-1 self-stretch rounded-full" style={{ backgroundColor: color }} />
        <span className="text-foreground-soft w-[5.5rem] shrink-0 text-sm tabular-nums">{range}</span>
        <span className="text-muted flex min-w-0 items-center gap-1 text-sm">
          <Ban aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">
            {t("blockLabel")}
            {booking.blockReason ? ` · ${booking.blockReason}` : ""}
          </span>
        </span>
      </button>
    );
  }

  const pets = booking.items.map((i) => i.petName).join(", ");
  const servicesText = [...new Set(booking.items.map((i) => i.serviceName))].join(", ");
  const hasNotes = booking.items.some((i) => i.petNotes);

  return (
    <button
      type="button"
      onClick={() => onOpen(booking)}
      aria-label={[
        booking.client?.hasContact
          ? t("openBooking", { time: range, pets, client: booking.client.fullName })
          : t("openBookingNoClient", { time: range, pets }),
        groomerName,
      ]
        .filter(Boolean)
        .join(", ")}
      className={cn(
        "hover:bg-surface-muted flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left",
        booking.status === "completed" && "opacity-75",
      )}
    >
      <span aria-hidden className="w-1 self-stretch rounded-full" style={{ backgroundColor: color }} />
      <span className="text-foreground-soft w-[5.5rem] shrink-0 text-sm tabular-nums">{range}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{pets}</span>
        <span className="text-muted truncate text-sm">
          {servicesText}
          {booking.client?.hasContact ? ` · ${booking.client.fullName}` : ""}
        </span>
        {groomerName ? (
          <span className="text-muted flex items-center gap-1.5 text-xs">
            <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: color }} />
            {groomerName}
          </span>
        ) : null}
      </span>
      <StatusIcons booking={booking} hasNotes={hasNotes} />
    </button>
  );
}

function StatusIcons({ booking, hasNotes }: { booking: CalendarBooking; hasNotes: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-1" aria-hidden>
      {hasNotes ? <TriangleAlert className="text-warning-foreground size-4" /> : null}
      {booking.status === "completed" ? <CircleCheck className="text-success-foreground size-4" /> : null}
      {booking.status === "no_show" ? <UserX className="text-warning-foreground size-4" /> : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Desktop: 7 day columns × groomer lanes
// ---------------------------------------------------------------------------

function WeekGrid({
  days,
  today,
  nowMinutes,
  onOpen,
  onSlot,
  drag,
}: {
  days: WeekDay[];
  today: DateStr;
  nowMinutes: number | null;
  onOpen: (b: CalendarBooking) => void;
  onSlot: (date: DateStr, groomerId: string, time: string) => void;
  drag: ReturnType<typeof useBookingDrag>;
}) {
  const t = useTranslations("calendar");
  const template = "3.5rem repeat(7, minmax(0, 1fr))";
  const nowTop =
    nowMinutes !== null && nowMinutes >= OPEN && nowMinutes <= CLOSE
      ? ((nowMinutes - OPEN) / SLOT_MINUTES) * ROW_REM
      : null;

  return (
    <div className="hidden pb-8 lg:block">
      {/* Day + lane headers */}
      <div
        className={cn(
          "border-border bg-background/85 sticky z-10 grid border-y backdrop-blur-md",
          CALENDAR_STICKY_TOP,
        )}
        style={{ gridTemplateColumns: template }}
      >
        <span aria-hidden />
        {days.map((day) => {
          const isToday = day.date === today;
          return (
            <div key={day.date} className="border-border min-w-0 border-l px-1 pt-1.5 pb-2">
              <Link
                href={`/calendar?date=${day.date}`}
                aria-label={t("openDay", { date: `${day.weekdayLong} ${day.date}` })}
                className={cn(
                  "mx-auto flex w-fit items-baseline gap-1.5 rounded-md px-2 py-0.5 hover:underline",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                <span className="text-sm font-semibold">{day.weekdayShort}</span>
                <span className={cn("text-xs tabular-nums", !isToday && "text-muted")}>
                  {day.date.slice(5)}
                </span>
              </Link>
              <div className="mt-1.5 flex gap-0.5">
                {day.lanes.length === 0 ? (
                  <span className="text-muted w-full text-center text-xs">{t("closed")}</span>
                ) : (
                  day.lanes.map((g) => (
                    <span
                      key={g.id}
                      title={g.offDay ? `${g.name} · ${t("offDay")}` : g.name}
                      className={cn(
                        "min-w-0 flex-1 truncate border-b-2 px-0.5 text-center text-[11px] leading-4 font-medium",
                        g.offDay && "border-dashed",
                      )}
                      style={{ borderColor: g.color }}
                    >
                      {g.name}
                    </span>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="relative grid pt-3"
        style={{ gridTemplateColumns: template }}
        role="region"
        aria-label={t("weekGrid")}
      >
        {/* Hour labels */}
        <div className="relative" aria-hidden style={{ height: `${GRID_ROWS * ROW_REM}rem` }}>
          {SLOTS.filter((_, i) => i % 4 === 0).map((time, i) => (
            <span
              key={time}
              className="text-muted absolute right-2 -translate-y-2 text-xs tabular-nums"
              style={{ top: `${i * 4 * ROW_REM}rem` }}
            >
              {time}
            </span>
          ))}
          <span
            className="text-muted absolute right-2 -translate-y-2 text-xs tabular-nums"
            style={{ top: `${GRID_ROWS * ROW_REM}rem` }}
          >
            {DAY_CLOSE}
          </span>
        </div>

        {days.map((day) => (
          <div
            key={day.date}
            className={cn("relative grid min-w-0", day.date === today && "bg-primary-soft/25")}
            style={{ gridTemplateColumns: `repeat(${Math.max(day.lanes.length, 1)}, minmax(0, 1fr))` }}
          >
            {day.lanes.length === 0 ? (
              <div
                className="border-border border-l"
                aria-hidden
                style={{
                  height: `${GRID_ROWS * ROW_REM}rem`,
                  backgroundImage:
                    "repeating-linear-gradient(135deg, var(--surface-muted) 0 6px, transparent 6px 12px)",
                }}
              />
            ) : (
              day.lanes.map((g, i) => (
                <GroomerColumn
                  key={g.id}
                  groomer={g}
                  date={day.date}
                  preview={drag.previewFor(g.id, day.date)}
                  draggingId={drag.draggingId}
                  onDragStart={drag.startDrag}
                  bookings={day.bookings.filter((b) => b.groomerId === g.id)}
                  onSlot={(time) => onSlot(day.date, g.id, time)}
                  onOpen={onOpen}
                  dateLabel={`${day.weekdayLong} ${day.date}`}
                  readOnly={day.date < today}
                  compact
                  className={cn(i > 0 && "border-dashed")}
                />
              ))
            )}
            {day.date === today && nowTop !== null ? (
              <div
                className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                style={{ top: `${nowTop}rem` }}
                role="img"
                aria-label={t("nowLine", { time: minutesToTime(nowMinutes!) })}
              >
                <span className="bg-danger -ml-1 size-2 rounded-full" />
                <span className="bg-danger h-0.5 flex-1" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
