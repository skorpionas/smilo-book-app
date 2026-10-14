import { getTranslations } from "next-intl/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("app");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" width={64} height={64} className="rounded-2xl" />
          <div>
            <p className="text-2xl font-semibold tracking-tight">{t("name")}</p>
            <p className="text-muted text-sm">{t("description")}</p>
          </div>
        </div>
        <div className="border-border bg-surface rounded-2xl border p-6 shadow-sm">{children}</div>
      </div>
    </main>
  );
}
