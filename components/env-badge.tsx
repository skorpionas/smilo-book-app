import { getTranslations } from "next-intl/server";
import type { AppEnv } from "@/lib/app-env";

/**
 * Small fixed badge on every non-production build (Vercel previews use the DEV
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
      className="pointer-events-none fixed top-[max(0.25rem,env(safe-area-inset-top))] right-1 z-50 rounded-md bg-amber-400 px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wider text-amber-950 shadow-sm"
    >
      {t(appEnv)}
    </div>
  );
}
