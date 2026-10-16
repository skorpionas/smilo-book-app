"use client";

import { ChevronRight, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { phoneDigits } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { formatVisitDate, type VisitSummary } from "@/lib/visits";

/**
 * Shared pieces of the two directory lists (pets / clients): alphabetical sections
 * with sticky letters (iOS Contacts pattern — fast to scan hundreds of names), a
 * visit cell, and the trailing call-or-open affordance.
 */

const OTHER = "#";

/** First letter, Lithuanian alphabet (Č, Š, Ž are letters of their own). */
export function letterOf(name: string): string {
  const ch = name.trim().charAt(0).toLocaleUpperCase("lt");
  return /\p{L}/u.test(ch) ? ch : OTHER;
}

/** Keeps the incoming order inside a letter; letters in Lithuanian order, "#" last. */
export function groupByLetter<T>(items: T[], name: (item: T) => string): { letter: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const l = letterOf(name(item));
    const list = map.get(l);
    if (list) list.push(item);
    else map.set(l, [item]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === OTHER ? 1 : b === OTHER ? -1 : a.localeCompare(b, "lt")))
    .map(([letter, list]) => ({ letter, items: list }));
}

/** Sits right under the sticky page header (min-h-16 + 1px border). */
const LETTER_TOP = "top-[calc(4rem+1px+env(safe-area-inset-top))]";

export function LetterSection({
  id,
  letter,
  label,
  children,
}: {
  id: string;
  letter: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-1.5">
      <h2
        id={id}
        aria-label={label}
        className={cn(
          "bg-background/90 supports-[backdrop-filter]:bg-background/75 text-foreground-soft sticky z-10 -mx-1 px-2 py-1 text-[0.9375rem] font-semibold backdrop-blur-md",
          LETTER_TOP,
        )}
      >
        {letter}
      </h2>
      {children}
    </section>
  );
}

/** Column grid shared by the header row and the rows (tablet and up). */
export const PET_COLUMNS =
  "md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_10rem] md:gap-4";
export const CLIENT_COLUMNS =
  "md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.3fr)_10rem] md:gap-4";

/** Visual column titles above the list (rows carry their own text, so aria-hidden). */
export function ColumnHeader({ columns, labels }: { columns: string; labels: string[] }) {
  return (
    <div aria-hidden className="text-muted hidden pr-14 pl-[4.25rem] text-sm md:block">
      <div className={cn(columns, "items-end")}>
        {labels.map((l) => (
          <span key={l} className="truncate">
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Next visit (highlighted) or the last one, or a dash. */
export function VisitCell({ visits, today }: { visits: VisitSummary; today: string }) {
  const t = useTranslations("directory");
  if (visits.next) {
    return (
      <span className="text-primary truncate text-sm font-medium tabular-nums">
        {t("nextVisit", { date: formatVisitDate(visits.next, today) })}
      </span>
    );
  }
  if (visits.last) {
    return (
      <span className="text-muted truncate text-sm tabular-nums">
        {t("lastVisit", { date: formatVisitDate(visits.last, today) })}
      </span>
    );
  }
  return <span className="text-muted/70 text-sm">{t("noVisits")}</span>;
}

/** Call when there is a phone (the most common action from a list), else a chevron. */
export function CallOrOpen({ phone, label }: { phone: string | null; label: string }) {
  return phone ? (
    <a
      href={`tel:+${phoneDigits(phone)}`}
      aria-label={label}
      className="text-primary hover:bg-primary-soft focus-visible:bg-primary-soft flex w-14 shrink-0 items-center justify-center transition-colors"
    >
      <Phone aria-hidden className="size-5" />
    </a>
  ) : (
    <span className="flex w-14 shrink-0 items-center justify-center">
      <ChevronRight aria-hidden className="text-muted size-5" />
    </span>
  );
}
