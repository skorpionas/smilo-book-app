"use client";

import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { PetSheet, type PetFormValues } from "@/components/clients/pet-sheet";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { setPetArchived } from "@/lib/actions/clients";

/** Edit / archive / restore on the pet page header. */
export function PetActions({
  pet,
  clientId,
  archived,
}: {
  pet: PetFormValues;
  clientId: string;
  archived: boolean;
}) {
  const t = useTranslations("pets");
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  async function setArchived(value: boolean) {
    const res = await setPetArchived(pet.id, clientId, value);
    if (res?.ok) {
      toast({ title: value ? t("archived") : t("restored"), description: pet.name });
      router.refresh();
      return true;
    }
    toast({ title: res?.error ?? "", tone: "danger" });
    return false;
  }

  if (archived) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setArchived(false)}>
        <ArchiveRestore aria-hidden />
        {t("restore")}
      </Button>
    );
  }

  return (
    <>
      <Button variant="ghost" size="icon" aria-label={t("archive")} onClick={() => setConfirming(true)}>
        <Archive aria-hidden />
      </Button>
      <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
        <Pencil aria-hidden />
        <span className="sr-only sm:not-sr-only">{t("editShort")}</span>
      </Button>
      <PetSheet
        open={editing}
        onOpenChange={setEditing}
        clientId={clientId}
        pet={pet}
        onArchive={() => {
          setEditing(false);
          setConfirming(true);
        }}
      />
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
