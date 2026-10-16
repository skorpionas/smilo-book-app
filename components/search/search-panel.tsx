"use client";

import { Cat, ChevronRight, Dog, Search, SearchX } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";
import { SearchField, useDebounced } from "@/components/search-field";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { searchDirectory, type SearchHit } from "@/lib/actions/search";

/** Search tab (US-14): one box, clients and pets, results within ~300 ms of the last keystroke. */
export function SearchPanel() {
  const t = useTranslations("search");
  const [query, setQuery] = React.useState("");
  const debounced = useDebounced(query.trim(), 300);
  const [result, setResult] = React.useState<{ q: string; hits: SearchHit[] }>({ q: "", hits: [] });
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (debounced.length < 2) return;
    let cancelled = false;
    startTransition(async () => {
      const hits = await searchDirectory(debounced);
      if (!cancelled) setResult({ q: debounced, hits });
    });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const q = query.trim();
  const ready = q.length >= 2 && result.q === q;
  const clients = ready ? result.hits.filter((h) => h.kind === "client") : [];
  const pets = ready ? result.hits.filter((h) => h.kind === "pet") : [];

  return (
    <div className="space-y-6">
      <SearchField
        id="global-search"
        label={t("label")}
        placeholder={t("placeholder")}
        value={query}
        onChange={setQuery}
        pending={pending}
        autoFocus
      />

      {q.length < 2 ? (
        <EmptyState icon={Search} title={t("label")} description={t("hint")} />
      ) : ready && result.hits.length === 0 ? (
        <EmptyState icon={SearchX} title={t("noResultsTitle")} description={t("noResultsText")} />
      ) : (
        <div className="space-y-6" aria-live="polite">
          {pets.length > 0 ? (
            <HitList
              title={t("petsHeading")}
              hits={pets}
              render={(h) => ({
                avatar: (
                  <Avatar
                    name={h.title}
                    icon={h.species === "cat" ? <Cat aria-hidden /> : <Dog aria-hidden />}
                  />
                ),
                subtitle: t("petOwner", { client: h.subtitle }),
              })}
            />
          ) : null}
          {clients.length > 0 ? (
            <HitList
              title={t("clientsHeading")}
              hits={clients}
              render={(h) => ({ avatar: <Avatar name={h.title} />, subtitle: h.subtitle })}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function HitList({
  title,
  hits,
  render,
}: {
  title: string;
  hits: SearchHit[];
  render: (hit: SearchHit) => { avatar: React.ReactNode; subtitle: string };
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-muted px-1 text-xs font-semibold tracking-wider uppercase">{title}</h2>
      <Card className="overflow-hidden">
        <ul className="divide-border divide-y">
          {hits.map((h) => {
            const { avatar, subtitle } = render(h);
            return (
              <li key={`${h.kind}-${h.id}`}>
                <Link
                  href={h.kind === "pet" ? `/pets/${h.id}` : `/clients/${h.clientId}`}
                  className="hover:bg-surface-muted flex min-h-16 items-center gap-3 px-4 py-2.5 transition-colors"
                >
                  {avatar}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{h.title}</span>
                    {subtitle ? (
                      <span className="text-muted block truncate text-sm tabular-nums">{subtitle}</span>
                    ) : null}
                  </span>
                  <ChevronRight aria-hidden className="text-muted size-5 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
