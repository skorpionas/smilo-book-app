import "server-only";
import { createClient } from "@/lib/supabase/server";
import { formatPhone } from "@/lib/phone";
import { lanesForDate } from "@/lib/schedule";
import {
  addDays,
  dayBoundsUtc,
  durationMinutes,
  gridPosition,
  toVilniusDate,
  toVilniusTime,
  type DateStr,
} from "@/lib/time";

export type CalendarGroomer = { id: string; name: string; color: string; workDays: number[] };
/** A groomer column on a specific date; `offDay` = shown only because she has bookings that day. */
export type CalendarLane = CalendarGroomer & { offDay: boolean };
export type CalendarService = { id: string; name: string; defaultDurationMin: number; defaultPrice: number };

export type CalendarBooking = {
  id: string;
  kind: "booking" | "block";
  groomerId: string;
  /** Display values computed on the server (keeps date-fns out of the browser). */
  date: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  /** Rows from 08:00 in the day grid, or null when outside the visible window. */
  grid: { row: number; span: number } | null;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  notes: string;
  blockReason: string;
  client: { id: string; fullName: string; phone: string | null; phoneDisplay: string } | null;
  items: {
    id: string;
    petId: string;
    petName: string;
    species: "dog" | "cat";
    petNotes: string;
    serviceName: string;
    durationMin: number;
    plannedPrice: number;
    actualPrice: number | null;
  }[];
};

/** Everything the day view needs, in one round of parallel queries (visible day only). */
export async function loadDay(date: DateStr) {
  return loadRange(date, addDays(date, 1), date);
}

/**
 * Groomers, services and non-cancelled bookings for the Vilnius dates [from, to).
 * Grid positions are relative to `gridDate` when given (day view), otherwise to
 * each booking's own start date (week view).
 */
export async function loadRange(from: DateStr, to: DateStr, gridDate?: DateStr) {
  const supabase = await createClient();
  const start = dayBoundsUtc(from).start;
  const end = dayBoundsUtc(addDays(to, -1)).end;

  const [groomers, services, bookings] = await Promise.all([
    supabase.from("groomers").select("id, name, color, work_days").eq("is_active", true).order("sort_order"),
    supabase
      .from("services")
      .select("id, name, default_duration_min, default_price")
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("bookings")
      .select(
        "id, kind, groomer_id, start_at, end_at, status, notes, block_reason, clients(id, full_name, phone_e164), booking_items(id, position, duration_min, planned_price, actual_price, pets(id, name, species, notes), services(name))",
      )
      .neq("status", "cancelled")
      .lt("start_at", end.toISOString())
      .gt("end_at", start.toISOString())
      .order("start_at"),
  ]);

  for (const r of [groomers, services, bookings]) {
    if (r.error) console.error("[calendar] load failed", { code: r.error.code });
  }

  return {
    groomers: (groomers.data ?? []).map((g): CalendarGroomer => ({
      id: g.id,
      name: g.name,
      color: g.color,
      workDays: g.work_days,
    })),
    services: (services.data ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      defaultDurationMin: s.default_duration_min,
      defaultPrice: Number(s.default_price),
    })) satisfies CalendarService[],
    bookings: (bookings.data ?? []).map((b): CalendarBooking => {
      const date = toVilniusDate(b.start_at);
      return {
        id: b.id,
        kind: b.kind,
        groomerId: b.groomer_id,
        date,
        startTime: toVilniusTime(b.start_at),
        endTime: toVilniusTime(b.end_at),
        durationMin: durationMinutes(b.start_at, b.end_at),
        grid: gridPosition(b.start_at, b.end_at, gridDate ?? date),
        status: b.status,
        notes: b.notes,
        blockReason: b.block_reason,
        client: b.clients
          ? {
              id: b.clients.id,
              fullName: b.clients.full_name,
              phone: b.clients.phone_e164,
              phoneDisplay: formatPhone(b.clients.phone_e164),
            }
          : null,
        items: [...b.booking_items]
          .sort((x, y) => x.position - y.position)
          .map((i) => ({
            id: i.id,
            petId: i.pets?.id ?? "",
            petName: i.pets?.name ?? "",
            species: i.pets?.species ?? "dog",
            petNotes: i.pets?.notes ?? "",
            serviceName: i.services?.name ?? "",
            durationMin: i.duration_min,
            plannedPrice: Number(i.planned_price),
            actualPrice: i.actual_price === null ? null : Number(i.actual_price),
          })),
      };
    }),
    failed: Boolean(groomers.error || bookings.error),
  };
}

/** Lanes for one date: working groomers, plus off-day groomers who have bookings that day. */
export function lanesFor(
  groomers: CalendarGroomer[],
  date: DateStr,
  bookings: CalendarBooking[],
): CalendarLane[] {
  return lanesForDate(
    groomers,
    date,
    new Set(bookings.filter((b) => b.date === date).map((b) => b.groomerId)),
  );
}
