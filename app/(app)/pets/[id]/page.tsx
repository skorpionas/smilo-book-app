import { ArrowLeft, CalendarPlus, Cat, ChevronRight, Dog, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PetNotes } from "@/components/clients/client-detail";
import { PageBody, PageHeader } from "@/components/page-header";
import { PetActions } from "@/components/pets/pet-actions";
import { PetServicesSection } from "@/components/pets/pet-services-section";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GroomerDot } from "@/components/ui/groomer-chip";
import { formatAge } from "@/lib/format";
import { formatEur } from "@/lib/money";
import { formatPhone, phoneDigits } from "@/lib/phone";
import { uuid } from "@/lib/schemas/common";
import { createClient } from "@/lib/supabase/server";
import { todayInVilnius, toVilniusDate, toVilniusTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  // Names are personal data; keep them out of the tab title / history.
  const t = await getTranslations("pages");
  return { title: t("pets") };
}

/** Pet page (US-12): profile, highlighted notes, own services and prices, visits, owner. */
export default async function PetPage({ params }: PageProps<"/pets/[id]">) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const t = await getTranslations("petPage");
  const tp = await getTranslations("pets");
  const ts = await getTranslations("species");
  const tz = await getTranslations("sizes");
  const tu = await getTranslations("units");
  const supabase = await createClient();

  const [{ data: pet }, { data: own }, { data: services }, { data: items }] = await Promise.all([
    supabase
      .from("pets")
      .select(
        "id, name, species, breed, size, weight_kg, birth_year, birth_month, notes, archived_at, client_id, clients(id, full_name, phone_e164, archived_at, anonymized_at, pets(id, name, species, archived_at))",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("pet_services")
      .select(
        "id, service_id, duration_min, price, position, created_at, services(name, default_duration_min, default_price, archived_at)",
      )
      .eq("pet_id", id)
      .order("position")
      .order("created_at"),
    supabase
      .from("services")
      .select("id, name, default_duration_min, default_price")
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("booking_items")
      .select(
        "id, planned_price, actual_price, visit_notes, services(name), bookings!inner(id, start_at, end_at, status, notes, groomers(name, color))",
      )
      .eq("pet_id", id)
      .limit(300),
  ]);
  if (!pet || !pet.clients) notFound();

  const client = pet.clients;
  const today = todayInVilnius();
  const readOnly = pet.archived_at !== null || client.archived_at !== null || client.anonymized_at !== null;
  const siblings = client.pets.filter((p) => p.id !== pet.id && !p.archived_at);
  const facts = [
    ts(pet.species),
    pet.breed,
    pet.size ? tz(pet.size) : null,
    pet.weight_kg != null ? tu("kg", { kg: String(pet.weight_kg).replace(".", ",") }) : null,
    pet.birth_year != null ? formatAge(tu, pet.birth_year, pet.birth_month, today) : null,
  ].filter(Boolean);

  const { upcoming, history } = partitionPetVisits(items ?? []);
  const lastDone = history.find((v) => v.booking.status === "completed");

  const SpeciesIcon = pet.species === "cat" ? Cat : Dog;

  return (
    <>
      <PageHeader
        title={pet.name}
        eyebrow={
          <Link href="/clients" className="hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft aria-hidden className="size-4" />
            {t("back")}
          </Link>
        }
      >
        {client.anonymized_at ? null : (
          <PetActions
            clientId={client.id}
            archived={pet.archived_at !== null}
            pet={{
              id: pet.id,
              name: pet.name,
              species: pet.species,
              breed: pet.breed,
              size: pet.size,
              weightKg: pet.weight_kg === null ? null : Number(pet.weight_kg),
              birthYear: pet.birth_year,
              birthMonth: pet.birth_month,
              notes: pet.notes,
            }}
          />
        )}
      </PageHeader>

      <PageBody className="grid gap-6 md:grid-cols-[minmax(0,1fr)_16rem] md:items-start lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        {/* Main column: profile, own services, visits */}
        <div className="min-w-0 space-y-8">
          <Card className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <Avatar name={pet.name} size="lg" icon={<SpeciesIcon aria-hidden />} />
              <div className="min-w-0 flex-1">
                <p className="text-foreground-soft">{facts.join(" · ")}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {pet.archived_at ? <Badge tone="neutral">{tp("archivedBadge")}</Badge> : null}
                  {lastDone ? (
                    <Badge tone="outline">
                      {t("lastVisit", { date: toVilniusDate(lastDone.booking.start_at) })}
                    </Badge>
                  ) : (
                    <Badge tone="outline">{t("noVisitsYet")}</Badge>
                  )}
                </div>
              </div>
            </div>
            {pet.notes ? <PetNotes notes={pet.notes} label={tp("notes")} /> : null}
            {!readOnly ? (
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href={`/calendar?client=${client.id}&pet=${pet.id}`}>
                  <CalendarPlus aria-hidden />
                  {t("book", { name: pet.name })}
                </Link>
              </Button>
            ) : null}
          </Card>

          <PetServicesSection
            petId={pet.id}
            petName={pet.name}
            readOnly={readOnly}
            services={(services ?? []).map((s) => ({
              id: s.id,
              name: s.name,
              defaultDurationMin: s.default_duration_min,
              defaultPrice: Number(s.default_price),
            }))}
            rows={(own ?? [])
              .filter((r) => r.services && !r.services.archived_at)
              .map((r) => ({
                id: r.id,
                serviceId: r.service_id,
                serviceName: r.services?.name ?? "",
                durationMin: r.duration_min,
                price: Number(r.price),
                defaultDurationMin: r.services?.default_duration_min ?? r.duration_min,
                defaultPrice: Number(r.services?.default_price ?? r.price),
              }))}
          />

          <PetVisits id="pet-upcoming" title={t("upcoming")} empty={t("noUpcoming")} visits={upcoming} />
          <PetVisits id="pet-history" title={t("history")} empty={t("noHistory")} visits={history} />
        </div>

        {/* Side column (stacks under on phones): owner and the rest of the family */}
        <aside className="space-y-6 md:sticky md:top-24">
          <section aria-labelledby="owner-heading" className="space-y-2">
            <h2 id="owner-heading" className="text-muted px-1 text-xs font-semibold tracking-wider uppercase">
              {t("owner")}
            </h2>
            <Card className="overflow-hidden">
              <Link
                href={`/clients/${client.id}`}
                className="hover:bg-surface-muted flex min-h-16 items-center gap-3 px-4 py-3 transition-colors"
              >
                <Avatar name={client.full_name} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{client.full_name}</span>
                  <span className="text-muted block truncate text-sm tabular-nums">
                    {client.phone_e164 ? formatPhone(client.phone_e164) : t("noPhone")}
                  </span>
                </span>
                <ChevronRight aria-hidden className="text-muted size-5 shrink-0" />
              </Link>
              {client.phone_e164 ? (
                <div className="border-border border-t p-3">
                  <Button asChild variant="secondary" className="w-full">
                    <a
                      href={`tel:+${phoneDigits(client.phone_e164)}`}
                      aria-label={t("callNamed", { phone: formatPhone(client.phone_e164) })}
                    >
                      <Phone aria-hidden />
                      {t("call")}
                    </a>
                  </Button>
                </div>
              ) : null}
            </Card>
          </section>

          {siblings.length > 0 ? (
            <section aria-labelledby="family-heading" className="space-y-2">
              <h2
                id="family-heading"
                className="text-muted px-1 text-xs font-semibold tracking-wider uppercase"
              >
                {t("family")}
              </h2>
              <Card className="overflow-hidden">
                <ul className="divide-border divide-y">
                  {siblings.map((s) => {
                    const Icon = s.species === "cat" ? Cat : Dog;
                    return (
                      <li key={s.id}>
                        <Link
                          href={`/pets/${s.id}`}
                          className="hover:bg-surface-muted flex min-h-14 items-center gap-3 px-4 py-2 transition-colors"
                        >
                          <Avatar name={s.name} size="sm" icon={<Icon aria-hidden />} />
                          <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                          <ChevronRight aria-hidden className="text-muted size-5 shrink-0" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          ) : null}
        </aside>
      </PageBody>
    </>
  );
}

/** Upcoming = scheduled and not over (oldest first); history = the rest (newest first). */
function partitionPetVisits(rows: (Omit<PetVisit, "booking"> & { bookings: PetVisit["booking"] })[]) {
  const now = Date.now();
  const visits = rows
    .map((i) => ({ ...i, booking: i.bookings }))
    .sort((a, b) => b.booking.start_at.localeCompare(a.booking.start_at));
  const isUpcoming = (v: PetVisit) =>
    v.booking.status === "scheduled" && new Date(v.booking.end_at).getTime() >= now;
  return { upcoming: visits.filter(isUpcoming).reverse(), history: visits.filter((v) => !isUpcoming(v)) };
}

type PetVisit = {
  id: string;
  planned_price: number;
  actual_price: number | null;
  visit_notes: string;
  services: { name: string } | null;
  booking: {
    id: string;
    start_at: string;
    end_at: string;
    status: "scheduled" | "completed" | "cancelled" | "no_show";
    notes: string;
    groomers: { name: string; color: string } | null;
  };
};

function PetVisits({
  id,
  title,
  empty,
  visits,
}: {
  id: string;
  title: string;
  empty: string;
  visits: PetVisit[];
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-2">
      <h2 id={`${id}-heading`} className="text-muted px-1 text-xs font-semibold tracking-wider uppercase">
        {title}
      </h2>
      {visits.length === 0 ? (
        <p className="text-muted px-1 text-sm">{empty}</p>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-border divide-y">
            {visits.map((v) => (
              <li
                key={v.id}
                className={cn("space-y-1 px-4 py-3", v.booking.status === "cancelled" && "opacity-70")}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/calendar?date=${toVilniusDate(v.booking.start_at)}`}
                    className="hover:text-primary font-medium tabular-nums underline-offset-4 hover:underline"
                  >
                    {toVilniusDate(v.booking.start_at)} · {toVilniusTime(v.booking.start_at)}–
                    {toVilniusTime(v.booking.end_at)}
                  </Link>
                  <StatusBadge status={v.booking.status} />
                </div>
                <p className="flex justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {v.booking.groomers ? <GroomerDot color={v.booking.groomers.color} /> : null}
                    <span className="truncate">
                      {[v.services?.name, v.booking.groomers?.name].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="tabular-nums">{formatEur(v.actual_price ?? v.planned_price)}</span>
                </p>
                {v.visit_notes ? (
                  <p className="text-muted text-sm whitespace-pre-line">{v.visit_notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
