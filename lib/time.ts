/**
 * All time-zone logic lives here (risk R1). The database stores UTC
 * `timestamptz`; the UI always works in Europe/Vilnius wall-clock time.
 *
 * Conventions:
 *  - `DateStr`  = calendar date in Vilnius, "YYYY-MM-DD"
 *  - `TimeStr`  = wall-clock time in Vilnius, "HH:mm" (24 h)
 *  - `Date`     = an absolute instant
 */
import { tz } from "@date-fns/tz";
import {
  addDays as dfAddDays,
  addMonths as dfAddMonths,
  format,
  getISOWeek,
  isValid,
  parse,
  startOfISOWeek,
} from "date-fns";

import {
  DEFAULT_WINDOW,
  SLOT_MINUTES,
  TIME_ZONE,
  minutesToTime,
  snapMinutes,
  timeToMinutes,
  type DateStr,
  type GridWindow,
  type TimeStr,
} from "./clock";

export {
  DAY_CLOSE,
  DAY_OPEN,
  DEFAULT_WINDOW,
  GRID_ROWS,
  edgeLabel,
  gridWindowFor,
  windowRows,
  windowSlots,
  type GridWindow,
  SLOT_MINUTES,
  TIME_ZONE,
  isTimeStr,
  minutesToTime,
  snapMinutes,
  timeToMinutes,
  vilniusClock,
  type DateStr,
  type TimeStr,
} from "./clock";

const inVilnius = tz(TIME_ZONE);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Parsing / validation
// ---------------------------------------------------------------------------

export function isDateStr(value: unknown): value is DateStr {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const d = parse(value, "yyyy-MM-dd", new Date(2000, 0, 1));
  return isValid(d) && format(d, "yyyy-MM-dd") === value;
}

// ---------------------------------------------------------------------------
// Vilnius <-> UTC
// ---------------------------------------------------------------------------

/**
 * Wall-clock Vilnius date + time -> absolute instant.
 * Non-existent times (spring-forward gap, e.g. 2027-03-28 03:30) are shifted
 * forward by the gap; ambiguous times (fall-back, e.g. 2026-10-25 03:30) resolve
 * to the second occurrence (winter time, EET). The salon is closed at those
 * hours, so this only matters for correctness, not for real bookings.
 */
export function vilniusToUtc(date: DateStr, time: TimeStr): Date {
  if (!isDateStr(date)) throw new Error(`Invalid date: ${date}`);
  const minutes = timeToMinutes(time);
  const [y, mo, d] = date.split("-").map(Number);
  // Wall-clock fields read as if they were UTC.
  const wall = Date.UTC(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60);
  // Offsets on either side of any transition that day (transitions are < 12 h apart from wall).
  const before = wall - vilniusOffsetMs(wall - 12 * 3600_000);
  const after = wall - vilniusOffsetMs(wall + 12 * 3600_000);
  const matches = (t: number) => t + vilniusOffsetMs(t) === wall;
  if (matches(after)) return new Date(after); // normal case, or second occurrence when ambiguous
  if (matches(before)) return new Date(before);
  return new Date(before); // in the spring-forward gap: shift forward by the gap
}

const offsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Vilnius UTC offset in ms at an instant (host time zone independent). */
function vilniusOffsetMs(instant: number): number {
  const parts: Record<string, number> = {};
  for (const p of offsetFormatter.formatToParts(new Date(instant))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Absolute instant -> Vilnius calendar date. */
export function toVilniusDate(instant: Date | string): DateStr {
  return format(toDate(instant), "yyyy-MM-dd", { in: inVilnius });
}

/** Absolute instant -> Vilnius wall-clock time "HH:mm". */
export function toVilniusTime(instant: Date | string): TimeStr {
  return format(toDate(instant), "HH:mm", { in: inVilnius });
}

/** "YYYY-MM-DD HH:mm" in Vilnius. */
export function formatDateTime(instant: Date | string): string {
  return `${toVilniusDate(instant)} ${toVilniusTime(instant)}`;
}

/** Minutes since Vilnius midnight (wall clock) for an instant. */
export function vilniusMinutesOfDay(instant: Date | string): number {
  return timeToMinutes(toVilniusTime(instant));
}

/** Today's date in Vilnius. `now` is injectable for tests. */
export function todayInVilnius(now: Date = new Date()): DateStr {
  return toVilniusDate(now);
}

/**
 * UTC bounds of a Vilnius calendar day: [start, end).
 * 2026-10-25 is 25 h long, 2027-03-28 is 23 h long.
 */
export function dayBoundsUtc(date: DateStr): { start: Date; end: Date } {
  return { start: vilniusToUtc(date, "00:00"), end: vilniusToUtc(addDays(date, 1), "00:00") };
}

// ---------------------------------------------------------------------------
// Calendar arithmetic on DateStr (time-zone free)
// ---------------------------------------------------------------------------

function dateStrToLocal(date: DateStr): Date {
  if (!isDateStr(date)) throw new Error(`Invalid date: ${date}`);
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(y, mo - 1, d, 12); // noon avoids host-DST edge cases
}

export function addDays(date: DateStr, days: number): DateStr {
  return format(dfAddDays(dateStrToLocal(date), days), "yyyy-MM-dd");
}

/** Monday of the ISO week containing `date`. */
export function startOfWeek(date: DateStr): DateStr {
  return format(startOfISOWeek(dateStrToLocal(date)), "yyyy-MM-dd");
}

/** The seven dates Mon..Sun of the week containing `date`. */
export function weekDays(date: DateStr): DateStr[] {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** First day of the month containing `date`. */
export function startOfMonth(date: DateStr): DateStr {
  if (!isDateStr(date)) throw new Error(`Invalid date: ${date}`);
  return `${date.slice(0, 8)}01`;
}

/** Same day `months` later, clamped to the month's length (2026-01-31 + 1 → 2026-02-28). */
export function addMonths(date: DateStr, months: number): DateStr {
  return format(dfAddMonths(dateStrToLocal(date), months), "yyyy-MM-dd");
}

/**
 * Weeks (Mon..Sun) covering the month containing `date`: 4–6 rows of 7 dates,
 * including the leading / trailing days of the neighbouring months.
 */
export function monthWeeks(date: DateStr): DateStr[][] {
  const first = startOfMonth(date);
  const nextFirst = startOfMonth(addMonths(first, 1));
  const weeks: DateStr[][] = [];
  for (let monday = startOfWeek(first); monday < nextFirst; monday = addDays(monday, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(monday, i)));
  }
  return weeks;
}

/** ISO week number (1–53). */
export function isoWeekNumber(date: DateStr): number {
  return getISOWeek(dateStrToLocal(date));
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: DateStr): number {
  const day = dateStrToLocal(date).getDay();
  return day === 0 ? 7 : day;
}

/** Parse a `?date=` search param, falling back to today in Vilnius. */
export function parseDateParam(value: unknown, now: Date = new Date()): DateStr {
  const v = Array.isArray(value) ? value[0] : value;
  return isDateStr(v) ? v : todayInVilnius(now);
}

// ---------------------------------------------------------------------------
// 15-minute grid
// ---------------------------------------------------------------------------

export function snapTime(time: TimeStr, mode: "nearest" | "floor" | "ceil" = "nearest"): TimeStr {
  return minutesToTime(Math.min(snapMinutes(timeToMinutes(time), mode), 24 * 60 - SLOT_MINUTES));
}

/** True when an instant lies on the 15-minute grid (what the DB enforces). */
export function isOnGrid(instant: Date | string): boolean {
  return toDate(instant).getTime() % (SLOT_MINUTES * 60 * 1000) === 0;
}

export function isValidDuration(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= 15 && minutes <= 600 && minutes % SLOT_MINUTES === 0;
}

/**
 * Wall-clock span of a booking on `date`, in minutes since midnight, clipped to
 * that day (a block from yesterday starts at 0). null when it isn't on that day.
 */
export function daySpan(
  start: Date | string,
  end: Date | string,
  date: DateStr,
): { from: number; to: number } | null {
  const { start: dayStart, end: dayEnd } = dayBoundsUtc(date);
  const s = toDate(start);
  const e = toDate(end);
  if (e <= dayStart || s >= dayEnd) return null;
  const from = s < dayStart ? 0 : vilniusMinutesOfDay(s);
  const to = e >= dayEnd ? 24 * 60 : vilniusMinutesOfDay(e) || 24 * 60;
  return to > from ? { from, to } : null;
}

/**
 * Position of a booking in the day grid, in rows from the window's opening hour,
 * clipped to the visible window (default 08:00–19:00). Uses wall-clock minutes so
 * DST days render like any other. Returns null when the booking is entirely
 * outside the window or day.
 */
export function gridPosition(
  start: Date | string,
  end: Date | string,
  date: DateStr,
  window: GridWindow = DEFAULT_WINDOW,
): { row: number; span: number } | null {
  const span = daySpan(start, end, date);
  if (!span) return null;
  const from = Math.max(span.from, window.open);
  const to = Math.min(span.to, window.close);
  if (to <= from) return null;
  return {
    row: Math.floor((from - window.open) / SLOT_MINUTES),
    span: Math.max(1, Math.ceil((to - from) / SLOT_MINUTES)),
  };
}

/** Real elapsed minutes between two instants (DST-aware by construction). */
export function durationMinutes(start: Date | string, end: Date | string): number {
  return Math.round((toDate(end).getTime() - toDate(start).getTime()) / 60000);
}

function toDate(instant: Date | string): Date {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid instant: ${String(instant)}`);
  return d;
}

const weekdayFormatter = new Intl.DateTimeFormat("lt-LT", { weekday: "long", timeZone: "UTC" });

/** "2026-10-20" -> "antradienis" */
export function weekdayName(date: DateStr): string {
  if (!isDateStr(date)) throw new Error(`Invalid date: ${date}`);
  return weekdayFormatter.format(new Date(`${date}T12:00:00Z`));
}

const monthFormatter = new Intl.DateTimeFormat("lt-LT", { year: "numeric", month: "long", timeZone: "UTC" });

/** "2026-10-15" -> "2026 m. spalis" */
export function monthTitle(date: DateStr): string {
  if (!isDateStr(date)) throw new Error(`Invalid date: ${date}`);
  return monthFormatter.format(new Date(`${date}T12:00:00Z`));
}
