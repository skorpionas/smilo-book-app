"use client";

import { Cat, Dog, Plus, SearchX, Users } from "lucide-react";
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
import type { VisitSummary } from "@/lib/visits";
import { ClientSheet } from "./client-sheet";
import {
  CallOrOpen,
  CLIENT_COLUMNS,
  ColumnHeader,
  groupByLetter,
  LetterSection,
  VisitCell,
} from "./directory-parts";

export type ClientListRow = {
  id: string;
  /** Contact name, or phone / e-mail / pet names when there is none. */
  fullName: string;
  phone: string | null;
  phoneDisplay: string;
  email: string | null;
  visits: VisitSummary;
  pets: { name: string; species: "dog" | "cat" }[];
};

/**
 * Clients (the root: contact, pets, shared services). Alphabetical sections; on
 * tablet / desktop the rows become columns (contact, pets, next or last visit).
 * Filtering is local: instant, and the query never leaves the device.
 */
export function ClientsList({ clients, today }: { clients: ClientListRow[]; today: string }) {
  const t = useTranslations("clients");
  const td = useTranslations("directory");
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const deferred = React.useDeferredValue(query);
  const visible = React.useMemo(
    () =>
      clients
        .filter((c) => matchesClient({ ...c, petNames: c.pets.map((p) => p.name) }, deferred))
        .sort((a, b) => a.fullName.localeCompare(b.fullName, "lt")),
    [clients, deferred],
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <SearchField
          id="clients-search"
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={setQuery}
          className="flex-1"
        />
        <Button onClick={() => setCreating(true)} className="shrink-0" aria-label={t("add")}>
          <Plus aria-hidden />
          <span className="hidden sm:inline">{t("add")}</span>
        </Button>
      </div>

      {clients.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={t("emptyTitle")}
            description={t("emptyText")}
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                {t("add")}
              </Button>
            }
          />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState icon={SearchX} title={t("noResultsTitle")} description={t("noResultsText")} />
        </Card>
      ) : (
        <div className="space-y-4">
          <ColumnHeader
            columns={CLIENT_COLUMNS}
            labels={[td("colName"), td("colContact"), td("colPets"), td("colVisit")]}
          />
          {groupByLetter(visible, (c) => c.fullName).map(({ letter, items }) => (
            <LetterSection
              key={letter}
              id={`clients-${letter}`}
              letter={letter}
              label={td("letter", { letter })}
            >
              <Card className="overflow-hidden">
                <ul className="divide-border divide-y">
                  {items.map((c) => (
                    <ClientRow key={c.id} client={c} today={today} />
                  ))}
                </ul>
              </Card>
            </LetterSection>
          ))}
        </div>
      )}

      <ClientSheet open={creating} onOpenChange={setCreating} openAfterCreate />
    </div>
  );
}

function ClientRow({ client: c, today }: { client: ClientListRow; today: string }) {
  const t = useTranslations("clients");
  // A client without contacts is labelled by its pets: don't repeat them underneath.
  const petsAreTitle = !c.phone && !c.email && c.pets.length > 0;
  const contact = c.phoneDisplay || c.email || "";
  return (
    <li className="flex items-stretch">
      <Link
        href={`/clients/${c.id}`}
        className="hover:bg-surface-muted flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 transition-colors"
      >
        <Avatar name={c.fullName} />
        <span className={cn("min-w-0 flex-1 md:items-center", CLIENT_COLUMNS)}>
          <span className="block min-w-0">
            <span className="block truncate font-medium">{c.fullName}</span>
            {/* phone: contact and pets on the second line */}
            <span className="text-muted flex min-w-0 items-center gap-x-2 overflow-hidden text-sm whitespace-nowrap md:hidden">
              {contact && contact !== c.fullName ? <span className="tabular-nums">{contact}</span> : null}
              {!petsAreTitle ? <PetNames pets={c.pets} /> : null}
              {c.pets.length === 0 ? <span>{t("noPetsShort")}</span> : null}
            </span>
          </span>
          <span className="text-foreground-soft hidden truncate text-sm tabular-nums md:block">
            {contact && contact !== c.fullName ? contact : "–"}
          </span>
          <span className="text-foreground-soft hidden min-w-0 overflow-hidden text-sm whitespace-nowrap md:flex md:gap-x-2">
            {c.pets.length > 0 ? <PetNames pets={c.pets} /> : t("noPetsShort")}
          </span>
          <span className="hidden md:block">
            <VisitCell visits={c.visits} today={today} />
          </span>
        </span>
      </Link>
      <CallOrOpen phone={c.phone} label={t("callNamed", { phone: c.phoneDisplay })} />
    </li>
  );
}

function PetNames({ pets }: { pets: ClientListRow["pets"] }) {
  return (
    <>
      {pets.map((p) => (
        <span key={p.name} className="inline-flex items-center gap-1">
          {p.species === "cat" ? (
            <Cat aria-hidden className="size-3.5" />
          ) : (
            <Dog aria-hidden className="size-3.5" />
          )}
          {p.name}
        </span>
      ))}
    </>
  );
}
