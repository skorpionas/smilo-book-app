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

/** Whole years (or months for pets under a year) between a birth date and today, both "YYYY-MM-DD". */
export function ageParts(birthDate: string, today: string): { years: number; months: number } | null {
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  const n = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!b || !n) return null;
  let months = (Number(n[1]) - Number(b[1])) * 12 + (Number(n[2]) - Number(b[2]));
  if (Number(n[3]) < Number(b[3])) months -= 1;
  if (months < 0) return null;
  return { years: Math.floor(months / 12), months };
}

export function formatAge(t: Translate, birthDate: string, today: string): string {
  const age = ageParts(birthDate, today);
  if (!age) return "";
  return age.years >= 1 ? t("years", { y: age.years }) : t("months", { mo: age.months });
}
