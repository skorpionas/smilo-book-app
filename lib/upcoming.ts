import { addDays, type DateStr } from "@/lib/time";

/** Artimiausi covers today + the next 13 days (US-04). */
export const UPCOMING_DAYS = 14;

type Groupable = { kind: "booking" | "block"; status: string; date: DateStr; startTime: string };

/**
 * Bookings (not blocked time, not cancelled) in [from, from + days), grouped by
 * date in ascending order and sorted by start time. Days without bookings are left out.
 */
export function groupUpcoming<T extends Groupable>(
  bookings: T[],
  from: DateStr,
  days: number = UPCOMING_DAYS,
): { date: DateStr; bookings: T[] }[] {
  const to = addDays(from, days);
  const byDate = new Map<DateStr, T[]>();
  for (const b of bookings) {
    if (b.kind !== "booking" || b.status === "cancelled" || b.date < from || b.date >= to) continue;
    const list = byDate.get(b.date);
    if (list) list.push(b);
    else byDate.set(b.date, [b]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({
      date,
      bookings: list.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }));
}

type Timed = { id: string; kind: "booking" | "block"; status: string; startTime: string; endTime: string };

/** Today's booking in progress ("now"), else the next one to start ("next"); times are "HH:mm". */
export function nowOrNext(bookings: Timed[], nowTime: string): { id: string; label: "now" | "next" } | null {
  const open = bookings.filter((b) => b.kind === "booking" && b.status === "scheduled");
  const now = open.find(
    (b) => b.startTime.localeCompare(nowTime) <= 0 && nowTime.localeCompare(b.endTime) < 0,
  );
  if (now) return { id: now.id, label: "now" };
  const next = open
    .filter((b) => b.startTime.localeCompare(nowTime) > 0)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
  return next ? { id: next.id, label: "next" } : null;
}
