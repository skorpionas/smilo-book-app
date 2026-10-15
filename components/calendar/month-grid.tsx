import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { lanesFor, type CalendarBooking, type CalendarGroomer } from "@/lib/calendar-data";
import { ISO_WEEKDAYS, type IsoDay } from "@/lib/clock";
import { isoWeekday, monthWeeks, type DateStr } from "@/lib/time";
import { cn } from "@/lib/utils";

const MAX_LINES = 3;

/**
 * Month view: Mon–Sun weeks covering the month. Each day shows how many visits
 * each groomer has (phone) or the first few visits (desktop), coloured by groomer,
 * and opens the day view. Days nobody works are hatched. Server Component, no client JS.
 */
export async function MonthGrid({
  first,
  today,
  groomers,
  bookings,
}: {
  /** First day of the month shown. */
  first: DateStr;
  today: DateStr;
  groomers: CalendarGroomer[];
  /** Bookings for every date in the visible weeks. */
  bookings: CalendarBooking[];
}) {
  const t = await getTranslations("calendar");
  const tw = await getTranslations("weekdays");
  const month = first.slice(0, 7);
  const weeks = monthWeeks(first);
  const byDate = new Map<string, CalendarBooking[]>();
  for (const b of bookings) {
    if (b.kind !== "booking" || b.status === "cancelled") continue;
    byDate.set(b.date, [...(byDate.get(b.date) ?? []), b]);
  }
  for (const list of byDate.values()) list.sort((x, y) => x.startTime.localeCompare(y.startTime));
  const groomerById = new Map(groomers.map((g) => [g.id, g]));

  return (
    <section aria-label={t("monthGrid")} className="px-2 pt-1 pb-28 sm:px-6 lg:pb-8">
      <div className="text-muted grid grid-cols-7 pb-1.5 text-center text-xs font-semibold" aria-hidden>
        {ISO_WEEKDAYS.map((d) => (
          <span key={d}>{tw(`short.${d}`)}</span>
        ))}
      </div>

      <ol className="border-border bg-border grid grid-cols-7 gap-px overflow-hidden rounded-xl border">
        {weeks.flat().map((d) => {
          const inMonth = d.startsWith(month);
          const isToday = d === today;
          const dayBookings = byDate.get(d) ?? [];
          const lanes = lanesFor(groomers, d, bookings);
          const closed = lanes.length === 0;
          const weekdayLong = tw(`long.${isoWeekday(d) as IsoDay}`);

          // Per-groomer counts in lane order (phone).
          const counts = groomers
            .map((g) => ({ g, n: dayBookings.filter((b) => b.groomerId === g.id).length }))
            .filter((c) => c.n > 0);

          return (
            <li key={d} className="contents">
              <Link
                href={`/calendar?date=${d}`}
                aria-label={t("monthCell", { date: `${weekdayLong} ${d}`, count: dayBookings.length })}
                aria-current={isToday ? "date" : undefined}
                className={cn(
                  "group bg-surface hover:bg-surface-muted focus-visible:ring-ring/50 relative flex min-h-[4.5rem] min-w-0 flex-col gap-1 p-1 transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none sm:min-h-24 sm:p-1.5 lg:min-h-28",
                  !inMonth && "bg-surface-muted/70",
                )}
                style={
                  closed && dayBookings.length === 0
                    ? {
                        backgroundImage:
                          "repeating-linear-gradient(135deg, var(--surface-muted) 0 5px, transparent 5px 10px)",
                      }
                    : undefined
                }
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center self-start rounded-full text-sm tabular-nums",
                    isToday ? "bg-primary text-primary-foreground font-semibold" : "font-medium",
                    !inMonth && !isToday && "text-muted",
                  )}
                >
                  {Number(d.slice(8))}
                </span>

                {/* Phone / tablet: one coloured count per groomer */}
                <span className="flex flex-col gap-0.5 lg:hidden" aria-hidden>
                  {counts.map(({ g, n }) => (
                    <span
                      key={g.id}
                      className="flex items-center gap-1 text-[11px] leading-none tabular-nums"
                    >
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                      {n}
                    </span>
                  ))}
                </span>

                {/* Desktop: first visits, then "dar N" */}
                <span className="hidden min-w-0 flex-col gap-0.5 lg:flex" aria-hidden>
                  {dayBookings.slice(0, MAX_LINES).map((b) => (
                    <span
                      key={b.id}
                      className={cn(
                        "flex min-w-0 items-center gap-1 rounded-sm border-l-2 px-1 text-xs leading-5",
                        b.status === "completed" && "opacity-70",
                      )}
                      style={{
                        borderColor: groomerById.get(b.groomerId)?.color,
                        backgroundColor: `color-mix(in oklab, ${groomerById.get(b.groomerId)?.color ?? "#64748b"} 14%, var(--surface))`,
                      }}
                    >
                      <span className="text-foreground-soft tabular-nums">{b.startTime}</span>
                      <span className="truncate font-medium">{b.items.map((i) => i.petName).join(", ")}</span>
                    </span>
                  ))}
                  {dayBookings.length > MAX_LINES ? (
                    <span className="text-muted px-1 text-xs">
                      {t("moreBookings", { count: dayBookings.length - MAX_LINES })}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <ul className="text-muted mt-3 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs">
        {groomers.map((g) => (
          <li key={g.id} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: g.color }} />
            {g.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
