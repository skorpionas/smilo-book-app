import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/** Calendar skeleton: header (same heights as CalendarHeader), two groomer columns, hour rows. */
export default async function Loading() {
  const t = await getTranslations("app");
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{t("loading")}</span>
      <div className="flex h-14 items-center gap-2 px-4 sm:px-6 lg:h-16 lg:gap-4">
        <div className="flex-1 space-y-1.5 lg:flex-none">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="hidden h-12 w-64 rounded-lg lg:block" />
        <div className="hidden flex-1 lg:block" />
        <Skeleton className="h-12 w-24 rounded-full" />
      </div>
      <div className="flex h-14 items-center px-4 sm:px-6 lg:hidden">
        <Skeleton className="h-12 w-full rounded-lg sm:w-64" />
      </div>
      <div className="border-border grid grid-cols-[3.5rem_1fr_1fr] gap-2 border-b px-1 pt-1.5 pb-2.5">
        <span />
        <Skeleton className="mx-auto h-7 w-28 rounded-full" />
        <Skeleton className="mx-auto h-7 w-28 rounded-full" />
      </div>
      <div className="grid [grid-auto-rows:4rem] grid-cols-[3.5rem_1fr_1fr]">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="contents">
            <Skeleton className="mx-auto mt-1 h-3 w-8" />
            <div className="border-border border-t border-l p-1.5">
              {i % 3 === 1 ? <Skeleton className="relative z-10 h-[7rem] rounded-md" /> : null}
            </div>
            <div className="border-border border-t border-l p-1.5">
              {i % 3 === 0 ? <Skeleton className="relative z-10 h-[5.5rem] rounded-md" /> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
