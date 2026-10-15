"use client";

import { Ban, CalendarOff, CircleCheck, Plus, TriangleAlert, UserX } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { GroomerChip } from "@/components/ui/groomer-chip";
import type { BookingClientOption } from "@/lib/actions/bookings";
import type { CalendarBooking, CalendarGroomer, CalendarLane, CalendarService } from "@/lib/calendar-data";
import {
  DAY_CLOSE,
  DAY_OPEN,
  GRID_ROWS,
  SLOT_MINUTES,
  minutesToTime,
  snapMinutes,
  timeToMinutes,
  vilniusClock,
  type DateStr,
} from "@/lib/clock";
import { cn } from "@/lib/utils";
import { BookingDetailSheet } from "./booking-detail";
import type { BookingDefaults } from "./booking-form";
import { useBookingDrag, type DropPreview } from "./drag-move";

// The booking form is only needed after a tap: load it on demand to keep the calendar page light.
const BookingSheet = dynamic(() => import("./booking-form").then((m) => m.BookingSheet));

export const OPEN = timeToMinutes(DAY_OPEN);
export const CLOSE = timeToMinutes(DAY_CLOSE);
export const ROW_REM = 1; // 15 min = 1 rem (16 px) → 4 rem per hour
export const SLOTS = Array.from({ length: GRID_ROWS }, (_, i) => minutesToTime(OPEN + i * SLOT_MINUTES));

/**
 * Day view (US-02, issue #17): one column per groomer working that day, 15-min rows
 * 08:00–19:00, booking blocks positioned by wall-clock time, "now" line, tap a free
 * slot to book. Groomers off that day get no lane unless something is booked for them.
 */
export function DayView({
  date,
  today,
  lanes,
  groomers,
  services,
  bookings,
  openOnLoad,
  preselectedClient,
}: {
  date: DateStr;
  today: DateStr;
  /** Columns shown on this date. */
  lanes: CalendarLane[];
  /** All active groomers (booking form). */
  groomers: CalendarGroomer[];
  services: CalendarService[];
  bookings: CalendarBooking[];
  openOnLoad: boolean;
  preselectedClient: BookingClientOption | null;
}) {
  const t = useTranslations("calendar");
  const router = useRouter();
  const pathname = usePathname();
  const [newBooking, setNewBooking] = React.useState<BookingDefaults | null>(null);
  const [selected, setSelected] = React.useState<CalendarBooking | null>(null);
  const drag = useBookingDrag(groomers);
  const nowMinutes = useNowMinutes(date === today);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const defaultTime = React.useCallback(() => {
    if (date === today && nowMinutes !== null) {
      const next = snapMinutes(nowMinutes, "ceil");
      if (next >= OPEN && next < CLOSE) return minutesToTime(next);
    }
    return DAY_OPEN;
  }, [date, today, nowMinutes]);
  const firstGroomerId = (lanes[0] ?? groomers[0]).id;
  // No bookings on past days: the grid is read-only and "+" books for today.
  const past = date < today;
  const bookingDate = past ? today : date;

  // Opened from a client page (?client=) or the desktop "Nauja registracija" button (?new=1).
  const openedOnLoad = React.useRef(false);
  React.useEffect(() => {
    if (!openOnLoad || openedOnLoad.current) return;
    openedOnLoad.current = true;
    setNewBooking({
      groomerId: firstGroomerId,
      date: bookingDate,
      startTime: past ? DAY_OPEN : defaultTime(),
      client: preselectedClient,
    });
    router.replace(`${pathname}?date=${date}`, { scroll: false });
  }, [openOnLoad, firstGroomerId, date, bookingDate, past, defaultTime, preselectedClient, router, pathname]);

  // Today: start scrolled near the current time (F2).
  React.useEffect(() => {
    if (date !== today || nowMinutes === null) return;
    const el = document.getElementById("now-line");
    if (el && nowMinutes > OPEN + 120) el.scrollIntoView({ block: "center" });
    // run once per day shown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const byGroomer = React.useMemo(() => {
    const map = new Map<string, CalendarBooking[]>();
    for (const g of lanes) map.set(g.id, []);
    for (const b of bookings) map.get(b.groomerId)?.push(b);
    return map;
  }, [lanes, bookings]);

  const gridTemplate = `3.5rem repeat(${lanes.length}, minmax(0, 1fr))`;
  const nowTop =
    nowMinutes !== null && nowMinutes >= OPEN && nowMinutes <= CLOSE
      ? (nowMinutes - OPEN) / SLOT_MINUTES
      : null;

  const sheets = (
    <>
      {/* Phone FAB, above the tab bar */}
      <Button
        size="icon"
        className="fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-lg lg:hidden [&_svg]:size-6"
        aria-label={t("newBooking")}
        onClick={() =>
          setNewBooking({
            groomerId: firstGroomerId,
            date: bookingDate,
            startTime: past ? DAY_OPEN : defaultTime(),
            client: null,
          })
        }
      >
        <Plus aria-hidden />
      </Button>

      <BookingSheet
        defaults={newBooking}
        onClose={() => setNewBooking(null)}
        groomers={groomers}
        services={services}
        onSaved={(savedDate) => {
          setNewBooking(null);
          if (savedDate !== date) router.push(`/calendar?date=${savedDate}`);
        }}
      />
      {drag.dialog}
      <BookingDetailSheet booking={selected} groomers={groomers} onClose={() => setSelected(null)} />
    </>
  );

  if (lanes.length === 0) {
    return (
      <>
        <EmptyState
          icon={CalendarOff}
          title={t("nobodyWorksTitle")}
          description={t("nobodyWorksText")}
          action={
            <Button asChild variant="soft">
              <Link href="/settings">{t("workDaysSettings")}</Link>
            </Button>
          }
        />
        {sheets}
      </>
    );
  }

  return (
    <>
      {/* Groomer column headers */}
      <div
        className="border-border bg-background/85 sticky top-[calc(7.5rem+env(safe-area-inset-top))] z-10 grid border-y backdrop-blur-md"
        style={{ gridTemplateColumns: gridTemplate }}
        role="group"
        aria-label={t("groomers")}
      >
        <span aria-hidden />
        {lanes.map((g) => {
          const count = (byGroomer.get(g.id) ?? []).filter((b) => b.kind === "booking").length;
          return (
            <div key={g.id} className="relative flex min-w-0 flex-col items-center px-1 pt-1.5 pb-2.5">
              <GroomerChip name={g.name} color={g.color} className="max-w-full truncate" />
              <span className="text-muted mt-0.5 text-xs whitespace-nowrap tabular-nums">
                {t("bookingsCount", { count })}
              </span>
              {g.offDay ? (
                <Badge tone="warning" className="mt-1">
                  {t("offDay")}
                </Badge>
              ) : null}
              <span
                aria-hidden
                className="absolute inset-x-1 bottom-0 h-0.5 rounded-full"
                style={{ backgroundColor: g.color }}
              />
            </div>
          );
        })}
      </div>

      <div
        ref={scrollRef}
        className="relative flex-1 pt-3 pb-24 lg:pb-8"
        aria-label={t("dayGrid")}
        role="region"
      >
        <div className="relative grid" style={{ gridTemplateColumns: gridTemplate }}>
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

          {lanes.map((g) => (
            <GroomerColumn
              key={g.id}
              groomer={g}
              date={date}
              bookings={byGroomer.get(g.id) ?? []}
              onSlot={drag.guardClick((time: string) =>
                setNewBooking({ groomerId: g.id, date, startTime: time, client: null }),
              )}
              readOnly={past}
              onOpen={drag.guardClick(setSelected)}
              preview={drag.previewFor(g.id, date)}
              draggingId={drag.draggingId}
              onDragStart={drag.startDrag}
            />
          ))}

          {nowTop !== null ? (
            <div
              id="now-line"
              className="pointer-events-none absolute right-0 left-[3.25rem] z-20 flex items-center"
              style={{ top: `${nowTop * ROW_REM}rem` }}
              role="img"
              aria-label={t("nowLine", { time: minutesToTime(nowMinutes!) })}
            >
              <span className="bg-danger -ml-1 size-2.5 rounded-full" />
              <span className="bg-danger h-0.5 flex-1" />
            </div>
          ) : null}
        </div>
      </div>

      {sheets}
    </>
  );
}

export function GroomerColumn({
  groomer,
  date,
  bookings,
  onSlot,
  onOpen,
  dateLabel,
  compact = false,
  readOnly = false,
  preview = null,
  draggingId = null,
  onDragStart,
  className,
}: {
  groomer: CalendarGroomer;
  /** The lane's date; with the groomer it makes the lane a drop target. */
  date: DateStr;
  bookings: CalendarBooking[];
  onSlot: (time: string) => void;
  onOpen: (booking: CalendarBooking) => void;
  /** Included in slot labels when several days are on screen (week view). */
  dateLabel?: string;
  /** Narrow lanes (week view): smaller booking cards. */
  compact?: boolean;
  /** Past days: no tap-to-book slots, not a drop target. */
  readOnly?: boolean;
  /** Ghost of a booking being dragged over this lane. */
  preview?: DropPreview | null;
  draggingId?: string | null;
  onDragStart?: (e: React.PointerEvent<HTMLElement>, booking: CalendarBooking) => void;
  className?: string;
}) {
  const t = useTranslations("calendar");
  const placed = bookings
    .map((b) => ({ booking: b, pos: b.grid }))
    .filter((p): p is { booking: CalendarBooking; pos: { row: number; span: number } } => p.pos !== null);

  const busy = new Set<number>();
  for (const { pos } of placed) for (let r = pos.row; r < pos.row + pos.span; r++) busy.add(r);

  return (
    <div
      className={cn("border-border relative grid border-l", className)}
      style={{ gridTemplateRows: `repeat(${GRID_ROWS}, ${ROW_REM}rem)` }}
      data-lane-groomer={groomer.id}
      data-lane-date={date}
      data-lane-readonly={readOnly ? "true" : undefined}
    >
      {SLOTS.map((time, i) => (
        <div
          key={time}
          className={cn(
            "col-start-1",
            i % 4 === 0
              ? "border-border border-t"
              : i % 2 === 0
                ? "border-t border-dashed border-[color-mix(in_oklab,var(--border)_60%,transparent)]"
                : "",
          )}
          style={{ gridRow: i + 1 }}
        >
          {busy.has(i) || readOnly ? null : (
            <button
              type="button"
              className="hover:bg-primary-soft/60 focus-visible:bg-primary-soft focus-visible:ring-ring/40 block size-full transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
              aria-label={
                dateLabel
                  ? t("slotLabelDate", { date: dateLabel, groomer: groomer.name, time })
                  : t("slotLabel", { groomer: groomer.name, time })
              }
              onClick={() => onSlot(time)}
            />
          )}
        </div>
      ))}

      {placed.map(({ booking, pos }) => (
        <BookingBlock
          key={booking.id}
          booking={booking}
          color={groomer.color}
          row={pos.row}
          span={pos.span}
          narrow={compact}
          onOpen={onOpen}
          dragging={draggingId === booking.id}
          onDragStart={onDragStart}
        />
      ))}

      {preview ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none relative z-20 col-start-1 mx-0.5 my-px rounded-md border-2 border-dashed px-1.5 py-0.5 text-xs font-semibold tabular-nums shadow-md",
            preview.busy && "border-danger bg-danger-soft text-danger-soft-foreground",
          )}
          style={{
            gridRow: `${preview.row + 1} / span ${preview.span}`,
            ...(preview.busy
              ? {}
              : {
                  borderColor: groomer.color,
                  backgroundColor: `color-mix(in oklab, ${groomer.color} 24%, var(--surface))`,
                }),
          }}
        >
          {preview.label}
        </div>
      ) : null}
    </div>
  );
}

function BookingBlock({
  booking,
  color,
  row,
  span,
  narrow = false,
  onOpen,
  dragging = false,
  onDragStart,
}: {
  booking: CalendarBooking;
  color: string;
  row: number;
  span: number;
  narrow?: boolean;
  onOpen: (b: CalendarBooking) => void;
  dragging?: boolean;
  onDragStart?: (e: React.PointerEvent<HTMLElement>, booking: CalendarBooking) => void;
}) {
  const t = useTranslations("calendar");
  const range = `${booking.startTime}–${booking.endTime}`;
  const compact = span <= 3;
  const movable = Boolean(onDragStart) && booking.status === "scheduled";
  const dragProps = movable
    ? {
        onPointerDown: (e: React.PointerEvent<HTMLElement>) => onDragStart!(e, booking),
        // No long-press callout / text selection while holding a card to drag it.
        style: { WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" } as const,
      }
    : {};

  if (booking.kind === "block") {
    return (
      <button
        type="button"
        onClick={() => onOpen(booking)}
        aria-label={`${t("blockLabel")} ${range}${booking.blockReason ? `, ${booking.blockReason}` : ""}`}
        onPointerDown={dragProps.onPointerDown}
        data-booking-id={booking.id}
        data-row={row}
        data-span={span}
        className={cn(
          "border-border text-muted relative z-10 col-start-1 mx-0.5 my-px flex min-w-0 flex-col overflow-hidden rounded-md border py-1 text-left text-xs select-none",
          narrow ? "px-1" : "px-2",
          movable && "cursor-grab",
          dragging && "opacity-40",
        )}
        style={{
          ...dragProps.style,
          gridRow: `${row + 1} / span ${span}`,
          backgroundImage:
            "repeating-linear-gradient(135deg, var(--surface-muted) 0 6px, transparent 6px 12px)",
        }}
      >
        <span className="flex min-w-0 items-center gap-1 font-medium" aria-hidden>
          <Ban className="size-3.5 shrink-0" />
          {/* Narrow week lanes: the hatching and icon say "blocked"; show the reason instead. */}
          <span className="truncate">{narrow ? booking.blockReason : t("blockLabel")}</span>
        </span>
        {!compact && !narrow ? (
          <span className="truncate" aria-hidden>
            {booking.blockReason}
          </span>
        ) : null}
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
      aria-label={t("openBooking", { time: range, pets, client: booking.client?.fullName ?? "" })}
      className={cn(
        "border-border bg-surface hover:border-border-strong relative z-10 col-start-1 mx-0.5 my-px flex min-w-0 flex-col overflow-hidden rounded-md border border-l-[3px] py-1 text-left text-xs leading-tight shadow-xs transition-colors",
        narrow ? "px-1" : "px-2",
        booking.status === "completed" && "opacity-75",
        movable && "cursor-grab select-none",
        dragging && "opacity-40",
      )}
      onPointerDown={dragProps.onPointerDown}
      data-booking-id={booking.id}
      data-row={row}
      data-span={span}
      style={{
        ...dragProps.style,
        gridRow: `${row + 1} / span ${span}`,
        borderLeftColor: color,
        backgroundColor: `color-mix(in oklab, ${color} 16%, var(--surface))`,
      }}
    >
      <span className="flex items-center gap-1">
        <span className="text-foreground-soft tabular-nums">
          {compact || narrow ? booking.startTime : range}
        </span>
        {compact && !narrow ? <span className="truncate font-semibold">{pets}</span> : null}
        <span className="ml-auto flex shrink-0 items-center gap-0.5">
          {hasNotes ? <TriangleAlert aria-hidden className="text-warning-foreground size-3.5" /> : null}
          {booking.status === "completed" ? (
            <CircleCheck aria-hidden className="text-success-foreground size-3.5" />
          ) : null}
          {booking.status === "no_show" ? (
            <UserX aria-hidden className="text-warning-foreground size-3.5" />
          ) : null}
        </span>
      </span>
      {narrow ? (
        // Week view lanes are ~60 px wide: stack the pet names under the time.
        span >= 3 ? (
          <span
            className={cn(
              "text-foreground font-semibold break-words",
              span >= 6 ? "line-clamp-3" : "line-clamp-1",
            )}
          >
            {pets}
          </span>
        ) : null
      ) : !compact ? (
        <>
          <span className="text-foreground mt-0.5 truncate text-sm font-semibold">{pets}</span>
          <span className="text-foreground-soft truncate">{servicesText}</span>
          {span >= 6 ? <span className="text-muted truncate">{booking.client?.fullName}</span> : null}
        </>
      ) : null}
    </button>
  );
}

/** Minutes since Vilnius midnight, updated every 30 s; null when not showing today (or before mount). */
export function useNowMinutes(enabled: boolean): number | null {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(vilniusClock().minutes);
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [enabled]);
  return enabled ? now : null;
}
