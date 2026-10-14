import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("title") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const t = await getTranslations("auth");
  return (
    <>
      <h1 className="mb-5 text-xl font-semibold">{t("title")}</h1>
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </>
  );
}
