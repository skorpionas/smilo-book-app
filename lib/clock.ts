/**
 * Dependency-free time constants and helpers that Client Components need.
 * lib/time.ts re-exports these and adds the date-fns based conversions, which
 * stay on the server so the calendar page ships less JavaScript.
 */
export const TIME_ZONE = "Europe/Vilnius";
export const SLOT_MINUTES = 15;
export const DAY_OPEN = "08:00";
export const DAY_CLOSE = "19:00";

export type DateStr = string;
export type TimeStr = string;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isTimeStr(value: unknown): value is TimeStr {
  return typeof value === "string" && TIME_RE.test(value);
}

/** Minutes since local midnight for an "HH:mm" string. */
export function timeToMinutes(time: TimeStr): number {
  const m = TIME_RE.exec(time);
  if (!m) throw new Error(`Invalid time: ${time}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

export function minutesToTime(minutes: number): TimeStr {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 24 * 60) {
    throw new Error(`Minutes out of range: ${minutes}`);
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Round minutes to the nearest slot (default), down or up. */
export function snapMinutes(minutes: number, mode: "nearest" | "floor" | "ceil" = "nearest"): number {
  const f = mode === "floor" ? Math.floor : mode === "ceil" ? Math.ceil : Math.round;
  return f(minutes / SLOT_MINUTES) * SLOT_MINUTES;
}

/** Number of grid rows between opening and closing (08:00–19:00 → 44). */
export const GRID_ROWS = (timeToMinutes(DAY_CLOSE) - timeToMinutes(DAY_OPEN)) / SLOT_MINUTES;

const clockFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Vilnius wall-clock date and minutes since midnight for an instant (Intl only, no date-fns). */
export function vilniusClock(instant: Date = new Date()): { date: DateStr; minutes: number } {
  const p: Record<string, string> = {};
  for (const part of clockFormatter.formatToParts(instant)) p[part.type] = part.value;
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}
