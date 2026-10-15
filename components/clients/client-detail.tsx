"use client";

import { Archive, ArchiveRestore, Cat, Dog, Pencil, Plus, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { setClientArchived, setPetArchived } from "@/lib/actions/clients";
import { formatAge } from "@/lib/format";
import { ClientSheet, type ClientFormValues } from "./client-sheet";
import { PetSheet, type PetFormValues } from "./pet-sheet";

/** Edit / archive / restore buttons on the client page header. */
export function ClientActions({ client, archived }: { client: ClientFormValues; archived: boolean }) {
  const t = useTranslations("clients");
  const [editing, setEditing] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  async function setArchived(value: boolean) {
    const res = await setClientArchived(client.id, value);
    if (res?.ok) {
      toast({ title: value ? t("archived") : t("restored"), description: client.fullName });
      return true;
    }
    toast({ title: res?.error ?? "", tone: "danger" });
    return false;
  }

  return (
    <>
      {archived ? (
        <Button variant="secondary" size="sm" onClick={() => setArchived(false)}>
          <ArchiveRestore aria-hidden />
          {t("restore")}
        </Button>
      ) : (
        <>
          <Button variant="ghost" size="icon" aria-label={t("archive")} onClick={() => setConfirming(true)}>
            <Archive aria-hidden />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Pencil aria-hidden />
            {t("edit")}
          </Button>
        </>
      )}
      <ClientSheet open={editing} onOpenChange={setEditing} client={client} />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("archiveTitle")}
        description={t("archiveText")}
        confirmLabel={t("archive")}
        onConfirm={() => setArchived(true)}
      />
    </>
  );
}

/** Pets of a client with add / edit / archive (issue #16). Notes (behaviour, allergies) are highlighted. */
export function PetsSection({
  clientId,
  pets,
  today,
  readOnly,
}: {
  clientId: string;
  pets: PetFormValues[];
  today: string;
  readOnly?: boolean;
}) {
  const t = useTranslations("clients");
  const tp = useTranslations("pets");
  const ts = useTranslations("species");
  const tz = useTranslations("sizes");
  const tu = useTranslations("units");
  const [editing, setEditing] = React.useState<PetFormValues | "new" | null>(null);
  const [archiving, setArchiving] = React.useState<PetFormValues | null>(null);

  async function archive(pet: PetFormValues) {
    const res = await setPetArchived(pet.id, clientId, true);
    if (res?.ok) {
      toast({ title: tp("archived"), description: pet.name });
      return true;
    }
    toast({ title: res?.error ?? "", tone: "danger" });
    return false;
  }

  return (
    <section aria-labelledby="pets-heading" className="space-y-2">
      <div className="flex min-h-11 items-center justify-between gap-2 px-1">
        <h2 id="pets-heading" className="text-muted text-xs font-semibold tracking-wider uppercase">
          {t("pets")}
        </h2>
        {!readOnly ? (
          <Button size="sm" variant="soft" onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            {tp("add")}
          </Button>
        ) : null}
      </div>

      {pets.length === 0 ? (
        <Card>
          <EmptyState
            icon={Dog}
            title={t("noPetsTitle")}
            description={t("noPetsText")}
            className="py-8"
            headingLevel={3}
          />
        </Card>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {pets.map((pet) => {
            const facts = [
              ts(pet.species),
              pet.breed,
              pet.size ? tz(pet.size) : null,
              pet.weightKg != null ? tu("kg", { kg: String(pet.weightKg).replace(".", ",") }) : null,
              pet.birthYear != null ? formatAge(tu, pet.birthYear, pet.birthMonth, today) : null,
            ].filter(Boolean);
            return (
              <li key={pet.id}>
                <Card className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <Avatar
                      name={pet.name}
                      icon={pet.species === "cat" ? <Cat aria-hidden /> : <Dog aria-hidden />}
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold">{pet.name}</h3>
                      <p className="text-muted text-sm">{facts.join(" · ")}</p>
                    </div>
                    {!readOnly ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="-mt-2 -mr-2"
                        aria-label={tp("edit", { name: pet.name })}
                        onClick={() => setEditing(pet)}
                      >
                        <Pencil aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                  {pet.notes ? <PetNotes notes={pet.notes} label={tp("notes")} /> : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <PetSheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        clientId={clientId}
        pet={editing === "new" ? null : editing}
        onArchive={(pet) => {
          setEditing(null);
          setArchiving(pet);
        }}
      />
      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(o) => !o && setArchiving(null)}
        title={tp("archiveTitle")}
        description={tp("archiveText")}
        confirmLabel={tp("archive")}
        onConfirm={() => (archiving ? archive(archiving) : Promise.resolve(true))}
      />
    </section>
  );
}

/** Highlighted behaviour / allergy notes (US-12): warning tint + icon, never colour alone. */
export function PetNotes({ notes, label }: { notes: string; label: string }) {
  return (
    <div className="bg-warning-soft text-warning-foreground flex gap-2 rounded-md px-3 py-2 text-sm leading-snug">
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p className="min-w-0 whitespace-pre-line">
        <span className="sr-only">{label}: </span>
        {notes}
      </p>
    </div>
  );
}
