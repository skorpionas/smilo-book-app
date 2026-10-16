"use client";

import {
  Cat,
  ChevronRight,
  Dog,
  PawPrint,
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
import { matchesClient } from "@/lib/search";
import { cn } from "@/lib/utils";
import { NewPetsSheet } from "@/components/pets/new-pets-sheet";
import type { VisitSummary } from "@/lib/visits";
import {
  CallOrOpen,
  ColumnHeader,
  groupByLetter,
  LetterSection,
  PET_COLUMNS,
  VisitCell,
} from "./directory-parts";

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
  visits: VisitSummary;
};

type Filter = "all" | "dog" | "cat";

/**
 * Pet-first directory: alphabetical sections, one row per dog or cat (a client's
 * pets kept together), a call button on the row; on tablet / desktop the rows
 * become columns (breed, client, next or last visit). Filtering is local
 * (instant; the query never leaves the device).
 */
export function PetsList({
  pets,
  clientsWithoutPets,
  today,
}: {
  pets: PetListRow[];
  today: string;
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
      {/* phone: search + add, filters below; tablet / desktop: one toolbar row */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-3 md:flex md:items-center">
        <SearchField
          id="pets-search"
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={setQuery}
          className="md:flex-1"
        />
        <Button onClick={() => setCreating(true)} className="shrink-0 md:order-3" aria-label={tp("newPet")}>
          <Plus aria-hidden />
          <span className="hidden sm:inline">{tp("newPet")}</span>
        </Button>
        <div
          role="group"
          aria-label={t("speciesFilter")}
          className="col-span-2 flex flex-wrap gap-2 md:order-2 md:flex-nowrap"
        >
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
            <div className="space-y-4">
              <ColumnHeader
                columns={PET_COLUMNS}
                labels={[t("colPet"), t("colBreed"), t("colClient"), t("colVisit")]}
              />
              {/* Letter sections; a client with 2+ pets is one block (its contact on
                  top) where its first pet would be, a single pet is one row. */}
              {groupByLetter(groupByFamily(visible), (g) => g.pets[0].name).map(({ letter, items }) => (
                <LetterSection
                  key={letter}
                  id={`pets-${letter}`}
                  letter={letter}
                  label={t("letter", { letter })}
                >
                  {/* a client's block is its own card; single pets in between share one,
                      so where a client's pets end is always visible */}
                  <div className="space-y-2">
                    {runs(items).map((run) =>
                      run.family ? (
                        <Card key={run.family.clientId} className="overflow-hidden">
                          <FamilyBlock group={run.family} today={today} />
                        </Card>
                      ) : (
                        <Card key={run.singles[0].clientId} className="overflow-hidden">
                          <ul className="divide-border divide-y">
                            {run.singles.map((g) => (
                              <PetRow
                                key={g.clientId}
                                pet={g.pets[0]}
                                today={today}
                                client={g.clientName}
                                call={g.phone}
                              />
                            ))}
                          </ul>
                        </Card>
                      ),
                    )}
                  </div>
                </LetterSection>
              ))}
            </div>
          ) : null}

          {orphans.length > 0 ? (
            <section aria-labelledby="no-pets-heading" className="space-y-2">
              <h2 id="no-pets-heading" className="text-foreground-soft px-1 text-[0.9375rem] font-semibold">
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

/** Keep the list's order (by pet name); a client appears where its first pet does. */
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

type Run = { family: FamilyGroup; singles?: never } | { family?: never; singles: FamilyGroup[] };

/** Consecutive single pets share a run; each multi-pet client is a run of its own. */
function runs(groups: FamilyGroup[]): Run[] {
  const out: Run[] = [];
  for (const g of groups) {
    const last = out[out.length - 1];
    if (g.pets.length > 1) out.push({ family: g });
    else if (last?.singles) last.singles.push(g);
    else out.push({ singles: [g] });
  }
  return out;
}

/** A client's pets together: a tinted client line (open / call), then one row per pet. */
function FamilyBlock({ group: g, today }: { group: FamilyGroup; today: string }) {
  const t = useTranslations("directory");
  const tc = useTranslations("clients");
  const showPhone = g.phoneDisplay && g.phoneDisplay !== g.clientName;
  return (
    <div className="bg-surface-muted/50">
      <div className="flex items-stretch">
        <Link
          href={`/clients/${g.clientId}`}
          aria-label={t("openClient", { name: g.clientName })}
          className="hover:bg-surface-muted flex min-h-11 min-w-0 flex-1 items-center gap-2 py-1.5 pl-4 transition-colors"
        >
          <Users aria-hidden className="text-muted size-4 shrink-0" />
          <span className="min-w-0 truncate text-sm">
            <span className="font-semibold">{g.clientName}</span>
            <span className="text-muted">
              {/* phone: the rows already show how many pets; keep the number visible */}
              <span className="hidden sm:inline">
                {" · "}
                {t("familyOf", { count: g.pets.length })}
              </span>
              {showPhone ? <span className="tabular-nums">{` · ${g.phoneDisplay}`}</span> : null}
            </span>
          </span>
        </Link>
        <CallOrOpen phone={g.phone} label={tc("callNamed", { phone: g.phoneDisplay })} />
      </div>
      <ul className="divide-border bg-surface divide-y" aria-label={t("familyPets", { name: g.clientName })}>
        {g.pets.map((p) => (
          <PetRow key={p.id} pet={p} today={today} />
        ))}
      </ul>
    </div>
  );
}

function PetRow({
  pet,
  today,
  client,
  call,
}: {
  pet: PetListRow;
  today: string;
  /** Shown for a single pet; in a client block the block names the client. */
  client?: string;
  call?: string | null;
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
        <span className={cn("min-w-0 flex-1 md:items-center", PET_COLUMNS)}>
          <span className="block min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-medium">{pet.name}</span>
              {pet.hasNotes ? (
                <TriangleAlert
                  aria-label={t("hasNotes")}
                  className="text-warning-foreground size-4 shrink-0"
                />
              ) : null}
            </span>
            {/* phone: breed and client on the second line, so the name is never the part that gets cut */}
            <span className="text-muted block truncate text-sm md:hidden">
              {[pet.breed, client].filter(Boolean).join(" · ")}
            </span>
          </span>
          <span className="text-foreground-soft hidden truncate text-sm md:block">{pet.breed || "–"}</span>
          <span className="text-foreground-soft hidden truncate text-sm md:block">{client ?? ""}</span>
          <span className="hidden md:block">
            <VisitCell visits={pet.visits} today={today} />
          </span>
        </span>
      </Link>
      {call !== undefined ? (
        <CallOrOpen phone={call} label={tc("callNamed", { phone: pet.phoneDisplay })} />
      ) : (
        <span className="flex w-14 shrink-0 items-center justify-center">
          <ChevronRight aria-hidden className="text-muted size-5" />
        </span>
      )}
    </li>
  );
}
