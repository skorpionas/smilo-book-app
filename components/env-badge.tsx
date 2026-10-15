import { getTranslations } from "next-intl/server";
import type { AppEnv } from "@/lib/app-env";
import { cn } from "@/lib/utils";

/**
 * DEV / LOCAL marker on every non-production build (Vercel previews use the DEV
 * database, local uses the Docker stack) so the owner never confuses them with
 * the real app. Renders nothing in production.
 *
 * - `inline`: next to the "Smilo" name (sidebar, login pages).
 * - `floating`: phones in the app, where the name isn't on screen — bottom-left, above the tab bar.
 */
export async function EnvBadge({
  variant = "inline",
  className,
}: {
  variant?: "inline" | "floating";
  className?: string;
}) {
  const appEnv = (process.env.NEXT_PUBLIC_APP_ENV ?? "local") as AppEnv;
  if (appEnv === "production") return null;
  const t = await getTranslations("env");
  return (
    <span
      role="note"
      aria-label={t(`${appEnv}Label`)}
      title={t(`${appEnv}Label`)}
      data-testid="env-badge"
      className={cn(
        "rounded-md bg-amber-400 px-1.5 py-0.5 font-sans text-[0.65rem] leading-none font-bold tracking-wider text-amber-950",
        variant === "inline"
          ? "inline-flex items-center self-center"
          : "pointer-events-none fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-2 z-50 shadow-sm",
        className,
      )}
    >
      {t(appEnv)}
    </span>
  );
}
