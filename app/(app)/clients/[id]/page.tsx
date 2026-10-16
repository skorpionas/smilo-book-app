import { ArrowLeft, CalendarPlus, Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ClientActions, PetsSection } from "@/components/clients/client-detail";
import { PageBody, PageHeader } from "@/components/page-header";
import { PetServicesSection } from "@/components/pets/pet-services-section";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GroomerDot } from "@/components/ui/groomer-chip";
import { uuid } from "@/lib/schemas/common";
import { formatEur } from "@/lib/money";
import { contactLabel, formatPhone, phoneDigits } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { todayInVilnius, toVilniusDate, toVilniusTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  // The client's name is personal data; keep it out of the tab title / history.
  const t = await getTranslations("pages");
  return { title: t("clients") };
}

export default async function ClientPage({ params }: PageProps<"/clients/[id]">) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();

  const t = await getTranslations("clients");
  const supabase = await createClient();
  const [{ data: client }, { data: pets }, { data: bookings }, { data: family }, { data: services }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, full_name, phone_e164, email, notes, archived_at, anonymized_at")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("pets")
        .select("id, name, species, breed, size, weight_kg, birth_year, birth_month, notes")
        .eq("client_id", id)
        .is("archived_at", null)
        .order("name"),
      supabase
        .from("bookings")
        .select(
          "id, start_at, end_at, status, notes, groomers(name, color), booking_items(id, position, planned_price, actual_price, visit_notes, pets(name), services(name))",
        )
        .eq("client_id", id)
        .eq("kind", "booking")
        .order("start_at", { ascending: false })
        .limit(200),
      supabase
        .from("client_services")
        .select(
          "id, service_id, duration_min, price, position, created_at, services(name, default_duration_min, default_price, archived_at)",
        )
        .eq("client_id", id)
        .order("position")
        .order("created_at"),
      supabase
        .from("services")
        .select("id, name, default_duration_min, default_price")
        .is("archived_at", null)
        .order("name"),
    ]);
  if (!client) notFound();

  const { all, upcoming, history } = partitionVisits(bookings ?? []);
  const cancelled = all.filter((b) => b.status === "cancelled").length;
  const noShows = all.filter((b) => b.status === "no_show").length;
  const readOnly = client.archived_at !== null || client.anonymized_at !== null;

  return (
    <>
      <PageHeader
        title={contactLabel({ ...client, pets: pets ?? [] })}
        eyebrow={
          <Link href="/clients?view=owners" className="hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft aria-hidden className="size-4" />
            {t("back")}
          </Link>
        }
      >
        {client.anonymized_at ? null : (
          <ClientActions
            archived={client.archived_at !== null}
            client={{
              id: client.id,
              fullName: client.full_name ?? "",
              phone: formatPhone(client.phone_e164),
              email: client.email,
              notes: client.notes,
            }}
          />
        )}
      </PageHeader>

      <PageBody className="max-w-3xl space-y-8">
        <Card className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <Avatar name={contactLabel({ ...client, pets: pets ?? [] })} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-1.5">
                {client.anonymized_at ? <Badge tone="neutral">{t("anonymizedBadge")}</Badge> : null}
                {client.archived_at && !client.anonymized_at ? (
                  <Badge tone="neutral">{t("archivedBadge")}</Badge>
                ) : null}
                {/* only when there is something to warn about: "0" badges were noise */}
                {cancelled > 0 ? (
                  <Badge tone="neutral">{t("cancelledCount", { count: cancelled })}</Badge>
                ) : null}
                {noShows > 0 ? <Badge tone="warning">{t("noShowCount", { count: noShows })}</Badge> : null}
              </div>
              {client.full_name && (client.phone_e164 || client.email) ? (
                <p className="mt-1.5 font-medium">{client.full_name}</p>
              ) : null}
              {client.phone_e164 ? (
                <p className="mt-1 text-base tabular-nums">{formatPhone(client.phone_e164)}</p>
              ) : !client.full_name && !client.email ? (
                // A family without any contact is fine: it is shown by its pets
                <p className="text-muted mt-1.5 text-sm">{t("noContact")}</p>
              ) : null}
              {client.email ? <p className="text-muted truncate text-sm">{client.email}</p> : null}
            </div>
          </div>
          {client.notes ? (
            <p className="text-foreground-soft text-sm whitespace-pre-line">{client.notes}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {client.phone_e164 ? (
              <Button asChild variant="secondary">
                <a
                  href={`tel:+${phoneDigits(client.phone_e164)}`}
                  aria-label={t("callNamed", { phone: formatPhone(client.phone_e164) })}
                >
                  <Phone aria-hidden />
                  {t("call")}
                </a>
              </Button>
            ) : null}
            {client.email ? (
              <Button asChild variant="ghost">
                <a href={`mailto:${client.email}`}>
                  <Mail aria-hidden />
                  {t("email")}
                </a>
              </Button>
            ) : null}
            {!readOnly ? (
              <Button asChild>
                <Link href={`/calendar?client=${client.id}`}>
                  <CalendarPlus aria-hidden />
                  {t("book")}
                </Link>
              </Button>
            ) : null}
          </div>
        </Card>

        <PetsSection
          clientId={client.id}
          today={todayInVilnius()}
          readOnly={readOnly}
          pets={(pets ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            species: p.species,
            breed: p.breed,
            size: p.size,
            weightKg: p.weight_kg === null ? null : Number(p.weight_kg),
            birthYear: p.birth_year,
            birthMonth: p.birth_month,
            notes: p.notes,
          }))}
        />

        {/* One service for all the pets together (e.g. "Maudymas abiem, 2 h, 50 €") */}
        {/* Always visible: see, add, edit and remove the family's shared services */}
        {!client.anonymized_at ? (
          <PetServicesSection
            kind="family"
            petId={client.id}
            petName={(pets ?? []).map((p) => p.name).join(", ")}
            readOnly={readOnly}
            services={(services ?? []).map((x) => ({
              id: x.id,
              name: x.name,
              defaultDurationMin: x.default_duration_min,
              defaultPrice: Number(x.default_price),
            }))}
            rows={(family ?? [])
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
        ) : null}

        <VisitSection id="upcoming" title={t("upcoming")} empty={t("noUpcoming")} visits={upcoming} />
        <VisitSection id="history" title={t("history")} empty={t("noHistory")} visits={history} />
      </PageBody>
    </>
  );
}

/** Upcoming = scheduled and not over yet (oldest first); history = everything else (newest first). */
function partitionVisits<T extends { status: string; end_at: string; booking_items: { position: number }[] }>(
  rows: T[],
) {
  const now = Date.now();
  const all = rows.map((b) => ({
    ...b,
    items: [...b.booking_items].sort((x, y) => x.position - y.position) as T["booking_items"],
  }));
  const isUpcoming = (b: T) => b.status === "scheduled" && new Date(b.end_at).getTime() >= now;
  return {
    all,
    upcoming: all.filter(isUpcoming).reverse(),
    history: all.filter((b) => !isUpcoming(b)),
  };
}

type Visit = {
  id: string;
  start_at: string;
  end_at: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  notes: string;
  groomers: { name: string; color: string } | null;
  items: {
    id: string;
    planned_price: number;
    actual_price: number | null;
    visit_notes: string;
    pets: { name: string } | null;
    services: { name: string } | null;
  }[];
};

function VisitSection({
  id,
  title,
  empty,
  visits,
}: {
  id: string;
  title: string;
  empty: string;
  visits: Visit[];
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-2">
      <h2 id={`${id}-heading`} className="text-foreground-soft px-1 text-[0.9375rem] font-semibold">
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
                className={cn("space-y-1.5 px-4 py-3", v.status === "cancelled" && "opacity-70")}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium tabular-nums">
                    <Link
                      href={`/calendar?date=${toVilniusDate(v.start_at)}`}
                      className="hover:text-primary underline-offset-4 hover:underline"
                    >
                      {toVilniusDate(v.start_at)} · {toVilniusTime(v.start_at)}–{toVilniusTime(v.end_at)}
                    </Link>
                  </p>
                  <StatusBadge status={v.status} />
                </div>
                {v.groomers ? (
                  <p className="text-muted flex items-center gap-1.5 text-sm">
                    <GroomerDot color={v.groomers.color} />
                    {v.groomers.name}
                  </p>
                ) : null}
                <ul className="space-y-1">
                  {v.items.map((item) => (
                    <li key={item.id} className="text-sm">
                      <span className="flex justify-between gap-3">
                        <span>
                          <span className="font-semibold">{item.pets?.name}</span>
                          {item.services ? ` · ${item.services.name}` : null}
                        </span>
                        <span className="tabular-nums">
                          {formatEur(item.actual_price ?? item.planned_price)}
                        </span>
                      </span>
                      {item.visit_notes ? (
                        <span className="text-muted block whitespace-pre-line">{item.visit_notes}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {v.notes ? <p className="text-muted text-sm whitespace-pre-line">{v.notes}</p> : null}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
