"use client";

import {
  Cat,
  ChevronRight,
  Dog,
  PawPrint,
  Phone,
  Plus,
  SearchX,
  TriangleAlert,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";
import { SearchField } from "@/components/search-field";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { phoneDigits } from "@/lib/phone";
import { matchesClient } from "@/lib/search";
import { cn } from "@/lib/utils";
import { NewPetsSheet } from "@/components/pets/new-pets-sheet";

export type PetListRow = {
  id: string;
  name: string;
  species: "dog" | "cat";
  breed: string;
  hasNotes: boolean;
  /** null = no owner yet (pet first). */
  clientId: string | null;
  clientName: string;
  phone: string | null;
  phoneDisplay: string;
};

type Filter = "all" | "dog" | "cat";

/**
 * Pet-first directory: one row per dog or cat, owner and phone underneath, a call
 * button on the row. Filtering is local (instant; the query never leaves the device).
 */
export function PetsList({
  pets,
  clientsWithoutPets,
}: {
  pets: PetListRow[];
  clientsWithoutPets: { id: string; fullName: string; phoneDisplay: string }[];
}) {
  const t = useTranslations("directory");
  const tc = useTranslations("clients");
  const tp = useTranslations("pets");
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [creating, setCreating] = React.useState(false);
  const deferred = React.useDeferredValue(query);

  const counts = React.useMemo(
    () => ({
      all: pets.length,
      dog: pets.filter((p) => p.species === "dog").length,
      cat: pets.filter((p) => p.species === "cat").length,
    }),
    [pets],
  );
  const visible = React.useMemo(
    () =>
      pets.filter(
        (p) =>
          (filter === "all" || p.species === filter) &&
          matchesClient({ fullName: p.clientName, phone: p.phone, petNames: [p.name, p.breed] }, deferred),
      ),
    [pets, filter, deferred],
  );
  const orphans = React.useMemo(
    () =>
      filter === "all"
        ? clientsWithoutPets.filter((c) =>
            matchesClient({ fullName: c.fullName, phone: null, petNames: [] }, deferred),
          )
        : [],
    [clientsWithoutPets, filter, deferred],
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <SearchField
          id="pets-search"
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={setQuery}
          className="flex-1"
        />
        <Button onClick={() => setCreating(true)} className="shrink-0" aria-label={tp("newPet")}>
          <Plus aria-hidden />
          <span className="hidden sm:inline">{tp("newPet")}</span>
        </Button>
      </div>

      <div role="group" aria-label={t("speciesFilter")} className="flex flex-wrap gap-2">
        {(
          [
            { key: "all", label: t("all"), icon: PawPrint },
            { key: "dog", label: t("dogs"), icon: Dog },
            { key: "cat", label: t("cats"), icon: Cat },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
              filter === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-foreground-soft hover:bg-surface-muted",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {label}
            <span className={cn("tabular-nums", filter === key ? "opacity-80" : "text-muted")}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {pets.length === 0 && clientsWithoutPets.length === 0 ? (
        <Card>
          <EmptyState
            icon={PawPrint}
            title={t("emptyTitle")}
            description={t("emptyText")}
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                {tp("newPet")}
              </Button>
            }
          />
        </Card>
      ) : visible.length === 0 && orphans.length === 0 ? (
        <Card>
          <EmptyState icon={SearchX} title={tc("noResultsTitle")} description={tc("noResultsText")} />
        </Card>
      ) : (
        <>
          {visible.length > 0 ? (
            // Pets grouped by family: a family with 2+ pets is one block with its
            // contact on top; a single pet is one row with its family underneath.
            <ul className="gap-3 space-y-3 md:columns-2 xl:columns-3 [&>li]:break-inside-avoid">
              {groupByFamily(visible).map((g) =>
                g.pets.length > 1 ? (
                  <li key={g.clientId}>
                    <Card className="overflow-hidden">
                      <div className="border-border bg-surface-muted/40 flex items-stretch border-b">
                        <Link
                          href={`/clients/${g.clientId}`}
                          className="hover:bg-surface-muted flex min-h-12 min-w-0 flex-1 items-center gap-2 py-2 pl-4 transition-colors"
                        >
                          <Users aria-hidden className="text-muted size-4 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{g.clientName}</span>
                            <span className="text-muted block truncate text-xs">
                              {t("familyOf", { count: g.pets.length })}
                              {g.phoneDisplay && g.phoneDisplay !== g.clientName
                                ? ` · ${g.phoneDisplay}`
                                : ""}
                            </span>
                          </span>
                        </Link>
                        <CallOrOpen
                          phone={g.phone}
                          phoneDisplay={g.phoneDisplay}
                          label={tc("callNamed", { phone: g.phoneDisplay })}
                        />
                      </div>
                      <ul
                        className="divide-border divide-y"
                        aria-label={t("familyPets", { name: g.clientName })}
                      >
                        {g.pets.map((p) => (
                          <PetRow key={p.id} pet={p} sub={p.breed} />
                        ))}
                      </ul>
                    </Card>
                  </li>
                ) : (
                  <li key={g.clientId}>
                    <Card className="overflow-hidden">
                      <ul>
                        <PetRow
                          pet={g.pets[0]}
                          sub={[g.pets[0].breed, g.clientName].filter(Boolean).join(" · ")}
                          call={{ phone: g.phone, phoneDisplay: g.phoneDisplay }}
                        />
                      </ul>
                    </Card>
                  </li>
                ),
              )}
            </ul>
          ) : null}

          {orphans.length > 0 ? (
            <section aria-labelledby="no-pets-heading" className="space-y-2">
              <h2
                id="no-pets-heading"
                className="text-muted px-1 text-xs font-semibold tracking-wider uppercase"
              >
                {t("withoutPets")}
              </h2>
              <Card className="overflow-hidden">
                <ul className="divide-border divide-y">
                  {orphans.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/clients/${c.id}`}
                        className="hover:bg-surface-muted flex min-h-14 items-center gap-3 px-4 py-2 transition-colors"
                      >
                        <Avatar name={c.fullName} size="sm" icon={<UserRound aria-hidden />} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{c.fullName}</span>
                          <span className="text-muted block truncate text-sm">{t("addPetHint")}</span>
                        </span>
                        <ChevronRight aria-hidden className="text-muted size-5 shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ) : null}
        </>
      )}

      {/* Pet first: a new pet needs no owner; contact details are optional in the form */}
      <NewPetsSheet open={creating} onOpenChange={setCreating} openAfterCreate />
    </div>
  );
}

type FamilyGroup = {
  clientId: string;
  clientName: string;
  phone: string | null;
  phoneDisplay: string;
  pets: PetListRow[];
};

/** Keep the list's order (by pet name); a family appears where its first pet does. */
function groupByFamily(pets: PetListRow[]): FamilyGroup[] {
  const groups = new Map<string, FamilyGroup>();
  for (const p of pets) {
    const key = p.clientId ?? `pet:${p.id}`;
    const g = groups.get(key);
    if (g) g.pets.push(p);
    else
      groups.set(key, {
        clientId: key,
        clientName: p.clientName,
        phone: p.phone,
        phoneDisplay: p.phoneDisplay,
        pets: [p],
      });
  }
  return [...groups.values()];
}

function PetRow({
  pet,
  sub,
  call,
}: {
  pet: PetListRow;
  sub: string;
  call?: { phone: string | null; phoneDisplay: string };
}) {
  const t = useTranslations("directory");
  const tc = useTranslations("clients");
  return (
    <li className="flex items-stretch">
      <Link
        href={`/pets/${pet.id}`}
        className="hover:bg-surface-muted flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 transition-colors"
      >
        <Avatar
          name={pet.name}
          icon={pet.species === "cat" ? <Cat aria-hidden /> : <Dog aria-hidden />}
          label={pet.species === "cat" ? t("cat") : t("dog")}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-medium">{pet.name}</span>
            {pet.hasNotes ? (
              <TriangleAlert aria-label={t("hasNotes")} className="text-warning-foreground size-4 shrink-0" />
            ) : null}
          </span>
          {/* breed (and family) on the second line, so the name is never the part that gets cut */}
          {sub ? <span className="text-muted block truncate text-sm">{sub}</span> : null}
        </span>
      </Link>
      {call ? (
        <CallOrOpen
          phone={call.phone}
          phoneDisplay={call.phoneDisplay}
          label={tc("callNamed", { phone: call.phoneDisplay })}
        />
      ) : (
        <span className="flex w-14 shrink-0 items-center justify-center">
          <ChevronRight aria-hidden className="text-muted size-5" />
        </span>
      )}
    </li>
  );
}

function CallOrOpen({ phone, label }: { phone: string | null; phoneDisplay: string; label: string }) {
  return phone ? (
    <a
      href={`tel:+${phoneDigits(phone)}`}
      aria-label={label}
      className="text-primary hover:bg-surface-muted flex w-14 shrink-0 items-center justify-center transition-colors"
    >
      <Phone aria-hidden className="size-5" />
    </a>
  ) : (
    <span className="flex w-14 shrink-0 items-center justify-center">
      <ChevronRight aria-hidden className="text-muted size-5" />
    </span>
  );
}
