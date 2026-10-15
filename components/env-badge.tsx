import { getTranslations } from "next-intl/server";
import type { AppEnv } from "@/lib/app-env";

/**
 * Small fixed badge (phone: bottom-left above the tab bar; desktop: bottom-right — clear of headers, the FAB and the sidebar) on every non-production build (Vercel previews use the DEV
 * database, local uses the Docker stack) so the owner never confuses them with
 * the real app. Renders nothing in production.
 */
export async function EnvBadge() {
  const appEnv = (process.env.NEXT_PUBLIC_APP_ENV ?? "local") as AppEnv;
  if (appEnv === "production") return null;
  const t = await getTranslations("env");
  return (
    <div
      role="note"
      aria-label={t(`${appEnv}Label`)}
      title={t(`${appEnv}Label`)}
      data-testid="env-badge"
      className="pointer-events-none fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-2 z-50 rounded-md bg-amber-400 px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wider text-amber-950 shadow-sm lg:bottom-2"
    >
      {t(appEnv)}
    </div>
  );
}
