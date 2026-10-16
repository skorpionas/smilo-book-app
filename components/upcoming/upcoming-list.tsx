"use client";

import { Ban, Cat, CircleCheck, Dog, Phone, Plus, TriangleAlert, UserX } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";
import { BookingDetailSheet } from "@/components/calendar/booking-detail";
import type { BookingDefaults } from "@/components/calendar/booking-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CalendarBooking, CalendarGroomer, CalendarService } from "@/lib/calendar-data";
import { DAY_OPEN, type DateStr } from "@/lib/clock";
import { formatDuration } from "@/lib/format";
import { formatEur } from "@/lib/money";
import { phoneDigits } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { nowOrNext } from "@/lib/upcoming";
import { formatVisitDate } from "@/lib/visits";

const BookingSheet = dynamic(() => import("@/components/calendar/booking-form").then((m) => m.BookingSheet));

export type UpcomingDay = {
  date: DateStr;
  /** "pirmadienis", … */
  weekdayLong: string;
  /** "today" / "tomorrow", if any. */
  relative: "today" | "tomorrow" | null;
  /** Groomer to pre-fill when booking on this day (first one working), if any. */
  firstLaneId: string | null;
  /** Empty for a free day (shown as one short line). */
  bookings: CalendarBooking[];
};

/** Columns of a booking row on tablet / desktop: time · pets and services · client · groomer · price. */
const COLUMNS =
  "md:grid md:grid-cols-[6.5rem_minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,0.8fr)_6rem] md:items-center md:gap-4";

/** Sits right under the sticky page header (min-h-16 + 1px border). */
const STICKY_TOP = "top-[calc(4rem+1px+env(safe-area-inset-top))]";

/**
 * Artimiausi (US-04): the next 14 days as one agenda. Each day has a sticky heading
 * (Šiandien / Rytoj, date, count, hours, planned total) and one list of bookings;
 * free days are a single short line. Filter by groomer when there are several.
 * Today marks the booking in progress ("Dabar") or the next one ("Kitas").
 */
export function UpcomingList({
  days,
  groomers,
  services,
  today,
  nowTime,
}: {
  days: UpcomingDay[];
  /** Active groomers (filter, detail sheet, booking form). */
  groomers: CalendarGroomer[];
  services: CalendarService[];
  today: DateStr;
  /** Vilnius "HH:mm" when the page was rendered, for Dabar / Kitas. */
  nowTime: string;
}) {
  const tu = useTranslations("upcoming");
  const [selected, setSelected] = React.useState<CalendarBooking | null>(null);
  const [newBooking, setNewBooking] = React.useState<BookingDefaults | null>(null);
  const [groomerFilter, setGroomerFilter] = React.useState<string | null>(null);
  const byId = React.useMemo(() => new Map(groomers.map((g) => [g.id, g])), [groomers]);
  const multipleGroomers = groomers.length > 1;

  const counts = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const d of days) for (const b of d.bookings) m.set(b.groomerId, (m.get(b.groomerId) ?? 0) + 1);
    return m;
  }, [days]);
  const total = days.reduce((n, d) => n + d.bookings.length, 0);

  const visibleDays = React.useMemo(
    () =>
      days.map((d) => ({
        ...d,
        bookings: groomerFilter ? d.bookings.filter((b) => b.groomerId === groomerFilter) : d.bookings,
      })),
    [days, groomerFilter],
  );

  const book = (date: DateStr, groomerId: string | null) => {
    const id = groomerFilter ?? groomerId ?? groomers[0]?.id;
    if (id) setNewBooking({ groomerId: id, date, startTime: DAY_OPEN, client: null });
  };

  return (
    <>
      {multipleGroomers ? (
        <div
          role="group"
          aria-label={tu("filterLabel")}
          className="-mx-4 mb-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {[
            { id: null, name: tu("allGroomers"), color: null, count: total },
            ...groomers.map((g) => ({
              id: g.id,
              name: g.name,
              color: g.color,
              count: counts.get(g.id) ?? 0,
            })),
          ].map((f) => (
            <button
              key={f.id ?? "all"}
              type="button"
              aria-pressed={groomerFilter === f.id}
              onClick={() => setGroomerFilter(f.id)}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
                groomerFilter === f.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-foreground-soft hover:bg-surface-muted",
              )}
            >
              {f.color ? (
                <span
                  aria-hidden
                  className="ring-surface size-2.5 rounded-full ring-2"
                  style={{ backgroundColor: f.color }}
                />
              ) : null}
              {f.name}
              <span className={cn("tabular-nums", groomerFilter === f.id ? "opacity-80" : "text-muted")}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <ol className="space-y-5 pb-28 lg:pb-8" aria-label={tu("listLabel")}>
        {visibleDays.map((day) =>
          day.bookings.length === 0 ? (
            <FreeDay key={day.date} day={day} today={today} onBook={() => book(day.date, day.firstLaneId)} />
          ) : (
            <BusyDay
              key={day.date}
              day={day}
              today={today}
              nowTime={nowTime}
              byId={byId}
              showGroomer={multipleGroomers}
              onOpen={setSelected}
              onBook={() => book(day.date, day.firstLaneId)}
            />
          ),
        )}
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

function bookingPrice(b: CalendarBooking): number {
  return b.items.reduce(
    (s, i) => s + (b.status === "completed" ? (i.actualPrice ?? i.plannedPrice) : i.plannedPrice),
    0,
  );
}

function DayTitle({ day, today }: { day: UpcomingDay; today: DateStr }) {
  const t = useTranslations("calendar");
  const tu = useTranslations("upcoming");
  const date = formatVisitDate(day.date, today);
  return day.relative ? (
    <>
      <span className={cn("text-lg font-semibold", day.relative === "today" && "text-primary")}>
        {day.relative === "today" ? t("today") : tu("tomorrow")}
      </span>
      <span className="text-muted text-sm">
        {day.weekdayLong}, {date}
      </span>
    </>
  ) : (
    <>
      <span className="text-lg font-semibold capitalize">{day.weekdayLong}</span>
      <span className="text-muted text-sm">{date}</span>
    </>
  );
}

function BusyDay({
  day,
  today,
  nowTime,
  byId,
  showGroomer,
  onOpen,
  onBook,
}: {
  day: UpcomingDay;
  today: DateStr;
  nowTime: string;
  byId: Map<string, CalendarGroomer>;
  showGroomer: boolean;
  onOpen: (b: CalendarBooking) => void;
  onBook: () => void;
}) {
  const t = useTranslations("calendar");
  const tu = useTranslations("upcoming");
  const tun = useTranslations("units");
  const bookings = day.bookings.filter((b) => b.kind === "booking");
  const count = bookings.length;
  const minutes = bookings.reduce((s, b) => s + b.durationMin, 0);
  const sum = bookings.reduce((s, b) => s + bookingPrice(b), 0);

  const highlight = day.date === today ? nowOrNext(day.bookings, nowTime) : null;

  return (
    <li aria-labelledby={`upcoming-${day.date}`} className="space-y-2">
      <div
        className={cn(
          "bg-background/90 supports-[backdrop-filter]:bg-background/75 sticky z-10 -mx-1 flex items-center gap-2 px-1 py-1.5 backdrop-blur-md",
          STICKY_TOP,
        )}
      >
        <Link
          id={`upcoming-${day.date}`}
          href={`/calendar?date=${day.date}`}
          aria-label={t("openDay", { date: `${day.weekdayLong} ${day.date}` })}
          className="flex min-h-11 min-w-0 flex-1 flex-wrap items-baseline gap-x-2 rounded-md hover:underline"
        >
          <DayTitle day={day} today={today} />
        </Link>
        <span className="text-muted hidden text-sm tabular-nums sm:inline">
          {tu("daySummary", { count, hours: formatDuration(tun, minutes) })}
          {sum > 0 ? ` · ${formatEur(sum)}` : ""}
        </span>
        <span className="text-muted text-sm tabular-nums sm:hidden" aria-hidden>
          {count}
        </span>
        <span className="sr-only">{t("bookingsCount", { count })}</span>
        <Button variant="soft" size="icon" aria-label={t("bookOnDay", { date: day.date })} onClick={onBook}>
          <Plus aria-hidden />
        </Button>
      </div>
      <Card className={cn("overflow-hidden", day.date === today && "ring-primary/40 ring-2")}>
        <ul className="divide-border divide-y">
          {day.bookings.map((b) => {
            const g = byId.get(b.groomerId);
            return (
              <li key={b.id}>
                <BookingRow
                  booking={b}
                  color={g?.color ?? "#64748b"}
                  groomerName={showGroomer ? g?.name : undefined}
                  highlight={highlight?.id === b.id ? highlight.label : null}
                  onOpen={onOpen}
                />
              </li>
            );
          })}
        </ul>
      </Card>
    </li>
  );
}

function FreeDay({ day, today, onBook }: { day: UpcomingDay; today: DateStr; onBook: () => void }) {
  const t = useTranslations("calendar");
  const tu = useTranslations("upcoming");
  return (
    <li data-free className="flex min-h-11 items-center gap-2 px-1">
      <Link
        href={`/calendar?date=${day.date}`}
        aria-label={t("openDay", { date: `${day.weekdayLong} ${day.date}` })}
        className="text-muted flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 text-sm hover:underline"
      >
        <span className="text-foreground-soft font-medium">
          {day.relative === "today" ? (
            t("today")
          ) : day.relative === "tomorrow" ? (
            tu("tomorrow")
          ) : (
            <span className="capitalize">{day.weekdayLong}</span>
          )}
        </span>
        <span>{formatVisitDate(day.date, today)}</span>
        <span>· {tu("free")}</span>
      </Link>
      <Button variant="ghost" size="icon" aria-label={t("bookOnDay", { date: day.date })} onClick={onBook}>
        <Plus aria-hidden />
      </Button>
    </li>
  );
}

function BookingRow({
  booking: b,
  color,
  groomerName,
  highlight,
  onOpen,
}: {
  booking: CalendarBooking;
  color: string;
  groomerName?: string;
  highlight: "now" | "next" | null;
  onOpen: (b: CalendarBooking) => void;
}) {
  const t = useTranslations("calendar");
  const tu = useTranslations("upcoming");
  const range = `${b.startTime}–${b.endTime}`;

  if (b.kind === "block") {
    return (
      <button
        type="button"
        onClick={() => onOpen(b)}
        className="hover:bg-surface-muted text-muted flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-sm"
      >
        <span className="w-12 shrink-0 tabular-nums md:w-[6.5rem]">
          {b.startTime}
          <span className="hidden md:inline">–{b.endTime}</span>
        </span>
        <span
          aria-hidden
          className="w-1 self-stretch rounded-full opacity-50"
          style={{ backgroundColor: color }}
        />
        <Ban aria-hidden className="size-4 shrink-0" />
        <span className="truncate">
          {t("blockLabel")}
          {b.blockReason ? ` · ${b.blockReason}` : ""}
          {groomerName ? ` · ${groomerName}` : ""}
        </span>
      </button>
    );
  }

  const pets = b.items.map((i) => i.petName).join(", ");
  const species = [...new Set(b.items.map((i) => i.species))];
  const servicesText = [...new Set(b.items.map((i) => i.serviceName))].join(", ");
  const hasNotes = b.items.some((i) => i.petNotes);
  const client = b.client?.hasContact ? b.client : null;
  const price = bookingPrice(b);

  return (
    <div className={cn("flex items-stretch", highlight && "bg-primary-soft/40")}>
      <button
        type="button"
        onClick={() => onOpen(b)}
        aria-label={[
          client
            ? t("openBooking", { time: range, pets, client: client.fullName })
            : t("openBookingNoClient", { time: range, pets }),
          groomerName,
          highlight ? tu(highlight) : null,
          b.status === "completed" ? tu("completed") : b.status === "no_show" ? tu("noShow") : null,
        ]
          .filter(Boolean)
          .join(", ")}
        className={cn(
          "hover:bg-surface-muted flex min-h-16 min-w-0 flex-1 items-stretch gap-3 py-2.5 pl-4 text-left transition-colors md:items-center",
          b.status === "completed" && "opacity-70",
        )}
      >
        {/* phone: start over end; tablet / desktop: one line */}
        <span className="flex w-12 shrink-0 flex-col tabular-nums md:hidden">
          <span className="font-semibold">{b.startTime}</span>
          <span className="text-muted text-sm">{b.endTime}</span>
        </span>
        <span
          aria-hidden
          className="w-1 shrink-0 self-stretch rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className={cn("min-w-0 flex-1", COLUMNS)}>
          <span className="hidden font-semibold tabular-nums md:block">{range}</span>
          <span className="block min-w-0">
            <span className="flex items-center gap-1.5">
              {species.map((s) =>
                s === "cat" ? (
                  <Cat key={s} aria-hidden className="text-muted size-4 shrink-0" />
                ) : (
                  <Dog key={s} aria-hidden className="text-muted size-4 shrink-0" />
                ),
              )}
              <span className="truncate font-semibold">{pets}</span>
              {hasNotes ? (
                <TriangleAlert aria-hidden className="text-warning-foreground size-4 shrink-0" />
              ) : null}
              {highlight ? (
                <span className="bg-primary text-primary-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold">
                  {tu(highlight)}
                </span>
              ) : null}
            </span>
            <span className="text-foreground-soft block truncate text-sm">{servicesText}</span>
            {/* phone: client and groomer on a third line */}
            <span className="text-muted flex min-w-0 items-center gap-1.5 text-sm md:hidden">
              {groomerName ? (
                <>
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="shrink-0">{groomerName}</span>
                </>
              ) : null}
              {client ? (
                <span className="truncate">{groomerName ? `· ${client.fullName}` : client.fullName}</span>
              ) : null}
            </span>
          </span>
          <span className="hidden min-w-0 md:block">
            {client ? (
              <>
                <span className="block truncate text-sm">{client.fullName}</span>
                {client.phoneDisplay ? (
                  <span className="text-muted block truncate text-sm tabular-nums">
                    {client.phoneDisplay}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-muted text-sm">–</span>
            )}
          </span>
          <span className="text-foreground-soft hidden min-w-0 items-center gap-1.5 text-sm md:flex">
            {groomerName ? (
              <>
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate">{groomerName}</span>
              </>
            ) : null}
          </span>
          <span className="hidden text-right md:block">
            <PriceAndStatus booking={b} price={price} />
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end justify-center pr-1 md:hidden">
          <PriceAndStatus booking={b} price={price} />
        </span>
      </button>
      {client?.phone ? (
        <a
          href={`tel:+${phoneDigits(client.phone)}`}
          aria-label={tu("callNamed", { phone: client.phoneDisplay })}
          className="text-primary hover:bg-primary-soft hidden w-14 shrink-0 items-center justify-center transition-colors sm:flex"
        >
          <Phone aria-hidden className="size-5" />
        </a>
      ) : (
        <span className="hidden w-14 shrink-0 sm:block" />
      )}
    </div>
  );
}

function PriceAndStatus({ booking: b, price }: { booking: CalendarBooking; price: number }) {
  const tu = useTranslations("upcoming");
  return (
    <>
      <span className="block text-sm font-medium tabular-nums">{formatEur(price)}</span>
      {b.status === "completed" ? (
        <span className="text-success-foreground inline-flex items-center gap-1 text-xs">
          <CircleCheck aria-hidden className="size-3.5" />
          {tu("completed")}
        </span>
      ) : b.status === "no_show" ? (
        <span className="text-warning-foreground inline-flex items-center gap-1 text-xs">
          <UserX aria-hidden className="size-3.5" />
          {tu("noShow")}
        </span>
      ) : null}
    </>
  );
}
