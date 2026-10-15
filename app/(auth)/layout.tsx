import { getTranslations } from "next-intl/server";
import { EnvBadge } from "@/components/env-badge";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("app");
  return (
    <main className="pt-safe pb-safe flex min-h-dvh flex-col items-center px-4 py-10 sm:justify-center sm:py-16">
      <div className="motion-safe:animate-fade-in w-full max-w-sm">
        <div className="mt-6 mb-8 flex flex-col items-center gap-4 text-center sm:mt-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt=""
            width={56}
            height={56}
            className="ring-border rounded-xl shadow-sm ring-1"
          />
          <div>
            <p className="font-display flex items-center justify-center gap-2 text-3xl font-semibold tracking-tight">
              {t("name")}
              <EnvBadge />
            </p>
            <p className="text-muted mt-1 text-sm">{t("description")}</p>
          </div>
        </div>
        <div className="border-border bg-surface rounded-xl border p-5 shadow-sm sm:p-7">{children}</div>
      </div>
    </main>
  );
}
