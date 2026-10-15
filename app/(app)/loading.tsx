import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/** Generic page skeleton: header + a few list rows. Shown instantly on navigation. */
export default async function Loading() {
  const t = await getTranslations("app");
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{t("loading")}</span>
      <div className="border-border border-b">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center px-4 sm:px-6">
          <Skeleton className="h-6 w-40" />
        </div>
      </div>
      <div className="mx-auto max-w-5xl space-y-3 px-4 py-4 sm:px-6 sm:py-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="border-border bg-surface flex items-center gap-3 rounded-lg border p-4">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3.5 w-3/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
