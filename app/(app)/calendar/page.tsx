import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ComingSoon, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { addDays, parseDateParam, todayInVilnius, weekdayName } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("calendar") };
}

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const { date: dateParam } = await searchParams;
  const date = parseDateParam(dateParam);
  const today = todayInVilnius();
  const t = await getTranslations("calendar");

  const supabase = await createClient();
  const { data: groomers } = await supabase
    .from("groomers")
    .select("id, name, color")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-col leading-tight">
            <span className="text-muted text-xs font-medium capitalize">{weekdayName(date)}</span>
            <span className="tabular-nums">{date}</span>
          </span>
        }
      >
        <Button asChild variant="ghost" size="icon" aria-label={t("previousDay")}>
          <Link href={`/calendar?date=${addDays(date, -1)}`}>
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        {date !== today ? (
          <Button asChild variant="secondary">
            <Link href="/calendar">{t("today")}</Link>
          </Button>
        ) : null}
        <Button asChild variant="ghost" size="icon" aria-label={t("nextDay")}>
          <Link href={`/calendar?date=${addDays(date, 1)}`}>
            <ChevronRight aria-hidden />
          </Link>
        </Button>
      </PageHeader>

      {groomers && groomers.length > 0 ? (
        <div
          className="border-border bg-surface grid border-b"
          style={{ gridTemplateColumns: `repeat(${groomers.length}, minmax(0, 1fr))` }}
        >
          {groomers.map((g) => (
            <div
              key={g.id}
              className="border-border flex items-center justify-center gap-2 border-r px-2 py-3 text-sm font-medium last:border-r-0"
            >
              <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: g.color }} />
              {g.name}
            </div>
          ))}
        </div>
      ) : null}

      <ComingSoon text={t("comingSoon")} />
    </>
  );
}
