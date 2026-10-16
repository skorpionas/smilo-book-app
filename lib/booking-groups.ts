import type { CalendarBooking } from "@/lib/calendar-data";

type Item = CalendarBooking["items"][number];

/** Rows entered as one shared service (same sharedGroup, next to each other) are shown as one line. */
export function groupItems<T extends Pick<Item, "sharedGroup">>(items: T[]): T[][] {
  const groups: T[][] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (item.sharedGroup !== null && last && last[0].sharedGroup === item.sharedGroup) last.push(item);
    else groups.push([item]);
  }
  return groups;
}
