"use client";

import { Cat, ChevronRight, Dog, Plus, SearchX, Users } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";
import { SearchField } from "@/components/search-field";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { matchesClient } from "@/lib/search";
import { ClientSheet } from "./client-sheet";

export type ClientListRow = {
  id: string;
  fullName: string;
  phone: string | null;
  phoneDisplay: string;
  pets: { name: string; species: "dog" | "cat" }[];
};

/** Clients list (issue #15). Filtering is local: instant, and the query never leaves the phone. */
export function ClientsList({ clients }: { clients: ClientListRow[] }) {
  const t = useTranslations("clients");
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const deferred = React.useDeferredValue(query);
  const visible = React.useMemo(
    () => clients.filter((c) => matchesClient({ ...c, petNames: c.pets.map((p) => p.name) }, deferred)),
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
        <Card className="overflow-hidden">
          <ul className="divide-border divide-y">
            {visible.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/clients/${c.id}`}
                  className="hover:bg-surface-muted flex min-h-16 items-center gap-3 px-4 py-2.5 transition-colors"
                >
                  <Avatar name={c.fullName} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.fullName}</span>
                    <span className="text-muted flex min-w-0 items-center gap-x-2 overflow-hidden text-sm whitespace-nowrap">
                      {c.phoneDisplay ? <span className="tabular-nums">{c.phoneDisplay}</span> : null}
                      {c.pets.map((p) => (
                        <span key={p.name} className="inline-flex items-center gap-1">
                          {p.species === "cat" ? (
                            <Cat aria-hidden className="size-3.5" />
                          ) : (
                            <Dog aria-hidden className="size-3.5" />
                          )}
                          {p.name}
                        </span>
                      ))}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="text-muted size-5 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ClientSheet open={creating} onOpenChange={setCreating} openAfterCreate />
    </div>
  );
}
