import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClientsList } from "@/components/clients/clients-list";
import { PageBody, PageHeader } from "@/components/page-header";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: t("clients") };
}

export default async function Page() {
  const t = await getTranslations("pages");
  const supabase = await createClient();
  // A two-groomer salon has hundreds of clients, not tens of thousands: load them all and filter on the phone.
  const { data } = await supabase
    .from("clients")
    .select("id, full_name, phone_e164, pets(name, archived_at)")
    .is("archived_at", null)
    .is("anonymized_at", null)
    .order("full_name")
    .limit(2000);

  const clients = (data ?? []).map((c) => ({
    id: c.id,
    fullName: c.full_name,
    phone: c.phone_e164,
    phoneDisplay: formatPhone(c.phone_e164),
    petNames: c.pets
      .filter((p) => !p.archived_at)
      .map((p) => p.name)
      .sort((a, b) => a.localeCompare(b, "lt")),
  }));

  return (
    <>
      <PageHeader title={t("clients")} />
      <PageBody>
        <ClientsList clients={clients} />
      </PageBody>
    </>
  );
}
