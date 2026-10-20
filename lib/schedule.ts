/**
 * Which groomer lanes the calendar shows on a given date (client-safe, no date-fns).
 *
 * A groomer gets a lane on the ISO weekdays in her `workDays`. On any other day
 * her lane still appears when something is booked for her — a booking made as an
 * exception must never disappear from the calendar — and is flagged `offDay`.
 */
import type { DateStr } from "./clock";

export type ScheduleGroomer = { id: string; workDays: readonly number[] };

/** ISO weekday of a "YYYY-MM-DD" date: 1 = Monday … 7 = Sunday. */
export function isoWeekdayOf(date: DateStr): number {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function worksOn(groomer: Pick<ScheduleGroomer, "workDays">, date: DateStr): boolean {
  return groomer.workDays.includes(isoWeekdayOf(date));
}

/**
 * Lanes for one date, in the groomers' order.
 * `bookedGroomerIds` = groomers with at least one (non-cancelled) booking or block that day.
 */
export function lanesForDate<G extends ScheduleGroomer>(
  groomers: readonly G[],
  date: DateStr,
  bookedGroomerIds: ReadonlySet<string> | readonly string[],
): (G & { offDay: boolean })[] {
  const booked = bookedGroomerIds instanceof Set ? bookedGroomerIds : new Set(bookedGroomerIds);
  return groomers.flatMap((g): (G & { offDay: boolean })[] => {
    if (worksOn(g, date)) return [{ ...g, offDay: false }];
    if (booked.has(g.id)) return [{ ...g, offDay: true }];
    return [];
  });
}

/** Most days one blocked-time period may cover (vacation, sick leave). */
export const BLOCK_MAX_DAYS = 62;

/** "YYYY-MM-DD" moved by `days` (calendar days; client-safe, no date-fns). */
export function shiftDate(date: DateStr, days: number): DateStr {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Dates from `from` to `to`, both included ("YYYY-MM-DD"); empty when `to` < `from`, capped at 367. */
export function datesBetween(from: DateStr, to: DateStr): DateStr[] {
  const out: DateStr[] = [];
  for (let d = from; d <= to && out.length <= 366; d = shiftDate(d, 1)) out.push(d);
  return out;
}

/**
 * The days a blocked-time period is saved on, one entry per groomer and day.
 * A single date is kept as chosen, even on a groomer's day off (an exception the
 * owner picked on purpose). Over several days, each groomer's days off are skipped,
 * so a vacation does not fill her Sundays with "off day" lanes.
 */
export function blockDays(
  groomers: readonly ScheduleGroomer[],
  from: DateStr,
  to: DateStr,
): { groomerId: string; date: DateStr }[] {
  const dates = datesBetween(from, to);
  if (dates.length === 1) return groomers.map((g) => ({ groomerId: g.id, date: dates[0] }));
  return groomers.flatMap((g) =>
    dates.filter((date) => worksOn(g, date)).map((date) => ({ groomerId: g.id, date })),
  );
}
