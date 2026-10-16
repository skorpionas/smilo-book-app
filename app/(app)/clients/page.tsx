import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ClientsList } from "@/components/clients/clients-list";
import { PetsList } from "@/components/clients/pets-list";
import { PageBody, PageHeader } from "@/components/page-header";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: t("clients") };
}

/**
 * Pet-first directory (owner feedback 2026-10-16): the salon thinks in dogs and
 * cats, so the default view lists pets with their owner; "Šeimininkai" lists
 * clients (one client can have several pets).
 */
export default async function Page({ searchParams }: PageProps<"/clients">) {
  const { view } = await searchParams;
  const owners = view === "owners";
  const t = await getTranslations("directory");
  const supabase = await createClient();

  // A two-groomer salon has hundreds of clients, not tens of thousands: load them all and filter on the device.
  const { data } = await supabase
    .from("clients")
    .select("id, full_name, phone_e164, pets(id, name, species, breed, notes, archived_at)")
    .is("archived_at", null)
    .is("anonymized_at", null)
    .order("full_name")
    .limit(2000);
  const rows = data ?? [];

  return (
    <>
      <PageHeader title={t("title")} />
      <PageBody className="space-y-4">
        <nav aria-label={t("viewLabel")} className="bg-surface-muted inline-flex rounded-lg p-1">
          {[
            { href: "/clients", active: !owners, label: t("pets") },
            { href: "/clients?view=owners", active: owners, label: t("owners") },
          ].map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "flex min-h-10 min-w-28 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors",
                tab.active ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {owners ? (
          <ClientsList
            clients={rows.map((c) => ({
              id: c.id,
              fullName: c.full_name,
              phone: c.phone_e164,
              phoneDisplay: formatPhone(c.phone_e164),
              pets: c.pets
                .filter((p) => !p.archived_at)
                .map((p) => ({ name: p.name, species: p.species }))
                .sort((a, b) => a.name.localeCompare(b.name, "lt")),
            }))}
          />
        ) : (
          <PetsList
            pets={rows
              .flatMap((c) =>
                c.pets
                  .filter((p) => !p.archived_at)
                  .map((p) => ({
                    id: p.id,
                    name: p.name,
                    species: p.species,
                    breed: p.breed,
                    hasNotes: p.notes.trim().length > 0,
                    clientId: c.id,
                    clientName: c.full_name,
                    phone: c.phone_e164,
                    phoneDisplay: formatPhone(c.phone_e164),
                  })),
              )
              .sort((a, b) => a.name.localeCompare(b.name, "lt"))}
            clientsWithoutPets={rows
              .filter((c) => c.pets.every((p) => p.archived_at))
              .map((c) => ({ id: c.id, fullName: c.full_name, phoneDisplay: formatPhone(c.phone_e164) }))}
          />
        )}
      </PageBody>
    </>
  );
}
