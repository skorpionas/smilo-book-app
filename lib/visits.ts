import { toVilniusDate, type DateStr } from "@/lib/time";

export type VisitRow = { pet_id: string; bookings: { start_at: string; status: string } | null };
export type VisitSummary = { last: DateStr | null; next: DateStr | null };

/**
 * Per pet: the last completed visit and the next scheduled one (directory rows show
 * them so the groomer sees "when was Bim here?" without opening the card).
 */
export function summarizeVisits(rows: VisitRow[], now: Date = new Date()): Map<string, VisitSummary> {
  const nowMs = now.getTime();
  const last = new Map<string, number>();
  const next = new Map<string, number>();
  for (const r of rows) {
    if (!r.bookings) continue;
    const t = new Date(r.bookings.start_at).getTime();
    if (r.bookings.status === "completed" && t <= nowMs) {
      if (t > (last.get(r.pet_id) ?? -Infinity)) last.set(r.pet_id, t);
    } else if (r.bookings.status === "scheduled" && t >= nowMs) {
      if (t < (next.get(r.pet_id) ?? Infinity)) next.set(r.pet_id, t);
    }
  }
  const out = new Map<string, VisitSummary>();
  for (const id of new Set([...last.keys(), ...next.keys()])) {
    const l = last.get(id);
    const n = next.get(id);
    out.set(id, {
      last: l === undefined ? null : toVilniusDate(new Date(l)),
      next: n === undefined ? null : toVilniusDate(new Date(n)),
    });
  }
  return out;
}

/** Combine several pets (a client): latest "last", earliest "next". */
export function mergeVisits(list: (VisitSummary | undefined)[]): VisitSummary {
  let last: DateStr | null = null;
  let next: DateStr | null = null;
  for (const v of list) {
    if (!v) continue;
    if (v.last && (!last || v.last > last)) last = v.last;
    if (v.next && (!next || v.next < next)) next = v.next;
  }
  return { last, next };
}

const sameYear = new Intl.DateTimeFormat("lt", { month: "long", day: "numeric", timeZone: "UTC" });

/** "spalio 21 d." this year, "2025-03-14" otherwise. */
export function formatVisitDate(date: DateStr, today: DateStr): string {
  if (date.slice(0, 4) !== today.slice(0, 4)) return date;
  return sameYear.format(new Date(`${date}T12:00:00Z`));
}
