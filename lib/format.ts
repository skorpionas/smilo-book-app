/**
 * Display helpers that need translated units. They take a translator for the
 * `units` namespace so they work in Server and Client Components alike.
 */
// next-intl's typed `t` is generic; this loose shape accepts it for the `units` namespace.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Translate = (key: any, values?: any) => string;

/** 90 -> "1 val. 30 min.", 120 -> "2 val.", 45 -> "45 min." */
export function formatDuration(t: Translate, minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return t("minutes", { m });
  if (m === 0) return t("hours", { h });
  return t("hoursMinutes", { h, m });
}

/** Durations offered in pickers: 15 min … 10 h in 15-min steps. */
export const DURATION_OPTIONS = Array.from({ length: 40 }, (_, i) => (i + 1) * 15);

/**
 * Age from a birth year (+ optional month) and today "YYYY-MM-DD".
 * With a month: whole months (the birth month counts as day 1). Without: years only
 * (calendar-year difference), months = null. Null when the birth is in the future.
 */
export function ageParts(
  birthYear: number,
  birthMonth: number | null,
  today: string,
): { years: number; months: number | null } | null {
  const n = /^(\d{4})-(\d{2})-\d{2}$/.exec(today);
  if (!n || !Number.isInteger(birthYear)) return null;
  const ty = Number(n[1]);
  const tm = Number(n[2]);
  if (birthMonth == null) {
    const years = ty - birthYear;
    return years < 0 ? null : { years, months: null };
  }
  const months = (ty - birthYear) * 12 + (tm - birthMonth);
  if (months < 0) return null;
  return { years: Math.floor(months / 12), months };
}

/** "6 m.", "4 mėn.", or "iki 1 m." when only the (current) year is known. */
export function formatAge(t: Translate, birthYear: number, birthMonth: number | null, today: string): string {
  const age = ageParts(birthYear, birthMonth, today);
  if (!age) return "";
  if (age.years >= 1) return t("years", { y: age.years });
  return age.months == null ? t("underYear") : t("months", { mo: age.months });
}
