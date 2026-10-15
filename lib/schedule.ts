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
