"use client";

import { Pencil, Plus, Scissors, Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { Field } from "@/components/forms/field";
import { useFormAction } from "@/components/forms/use-form-action";
import { useOnSaved } from "@/components/forms/use-on-saved";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { deletePetService, makeUsualPetService, savePetService } from "@/lib/actions/pets";
import { DURATION_OPTIONS, formatDuration } from "@/lib/format";
import { formatEur } from "@/lib/money";

export type PetServiceRow = {
  id: string;
  serviceId: string;
  serviceName: string;
  durationMin: number;
  price: number;
  /** Service default, to show how this pet differs. */
  defaultDurationMin: number;
  defaultPrice: number;
};

export type ServiceChoice = { id: string; name: string; defaultDurationMin: number; defaultPrice: number };

/**
 * The pet's own services (owner feedback 2026-10-16): custom duration and price per
 * pet. The first row is the pet's usual service — the booking form picks it
 * automatically, so a regular is booked in a few taps.
 */
export function PetServicesSection({
  petId,
  petName,
  rows,
  services,
  readOnly,
}: {
  petId: string;
  petName: string;
  rows: PetServiceRow[];
  services: ServiceChoice[];
  readOnly?: boolean;
}) {
  const t = useTranslations("petServices");
  const tu = useTranslations("units");
  const [editing, setEditing] = React.useState<PetServiceRow | "new" | null>(null);
  const [removing, setRemoving] = React.useState<PetServiceRow | null>(null);
  const [, startTransition] = React.useTransition();

  const unused = services.filter((s) => !rows.some((r) => r.serviceId === s.id));

  function makeUsual(row: PetServiceRow) {
    startTransition(async () => {
      const res = await makeUsualPetService(row.id, petId);
      toast(
        res?.ok
          ? { title: t("madeUsual"), description: row.serviceName }
          : { title: res?.error ?? "", tone: "danger" },
      );
    });
  }

  async function remove(row: PetServiceRow) {
    const res = await deletePetService(row.id, petId);
    if (res?.ok) {
      toast({ title: t("removed"), description: row.serviceName });
      return true;
    }
    toast({ title: res?.error ?? "", tone: "danger" });
    return false;
  }

  return (
    <section aria-labelledby="pet-services-heading" className="space-y-2">
      <div className="flex min-h-11 items-center justify-between gap-2 px-1">
        <div>
          <h2 id="pet-services-heading" className="text-muted text-xs font-semibold tracking-wider uppercase">
            {t("title")}
          </h2>
        </div>
        {!readOnly && unused.length > 0 ? (
          <Button size="sm" variant="soft" onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            {t("add")}
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        // Compact on purpose: most pets use the standard price, so this must not push the visits down.
        <Card className="flex items-center gap-3 p-4">
          <span className="bg-primary-soft text-primary-soft-foreground flex size-10 shrink-0 items-center justify-center rounded-full">
            <Scissors aria-hidden className="size-5" />
          </span>
          <p className="text-muted min-w-0 flex-1 text-sm">{t("emptyText", { name: petName })}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-border divide-y">
            {rows.map((row, index) => (
              <li key={row.id} className="flex min-h-16 items-center gap-1 py-2 pr-2 pl-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="truncate">{row.serviceName}</span>
                    {index === 0 ? (
                      <Badge tone="primary">
                        <Star aria-hidden className="size-3" />
                        {t("usual")}
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-muted text-sm tabular-nums">
                    {formatDuration(tu, row.durationMin)} · {formatEur(row.price)}
                    {row.price !== row.defaultPrice || row.durationMin !== row.defaultDurationMin ? (
                      <span className="text-muted/80">
                        {" "}
                        (
                        {t("standard", {
                          duration: formatDuration(tu, row.defaultDurationMin),
                          price: formatEur(row.defaultPrice),
                        })}
                        )
                      </span>
                    ) : null}
                  </p>
                </div>
                {!readOnly ? (
                  <>
                    {index > 0 ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("makeUsualNamed", { name: row.serviceName })}
                        onClick={() => makeUsual(row)}
                      >
                        <Star aria-hidden />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("editNamed", { name: row.serviceName })}
                      onClick={() => setEditing(row)}
                    >
                      <Pencil aria-hidden />
                    </Button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {rows.length > 0 ? <p className="text-muted px-1 text-sm">{t("hint")}</p> : null}

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent>
          {editing !== null ? (
            <PetServiceForm
              key={editing === "new" ? "new" : editing.id}
              petId={petId}
              petName={petName}
              row={editing === "new" ? null : editing}
              services={editing === "new" ? unused : services}
              onSaved={() => setEditing(null)}
              onRemove={(row) => {
                setEditing(null);
                setRemoving(row);
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t("removeTitle")}
        description={t("removeText")}
        confirmLabel={t("remove")}
        onConfirm={() => (removing ? remove(removing) : Promise.resolve(true))}
      />
    </section>
  );
}

function PetServiceForm({
  petId,
  petName,
  row,
  services,
  onSaved,
  onRemove,
}: {
  petId: string;
  petName: string;
  row: PetServiceRow | null;
  services: ServiceChoice[];
  onSaved: () => void;
  onRemove: (row: PetServiceRow) => void;
}) {
  const t = useTranslations("petServices");
  const tc = useTranslations("common");
  const tu = useTranslations("units");
  const [state, onSubmit, pending] = useFormAction(savePetService);
  const first = row ? services.find((s) => s.id === row.serviceId) : services[0];
  const [serviceId, setServiceId] = React.useState(row?.serviceId ?? first?.id ?? "");
  const [durationMin, setDurationMin] = React.useState(row?.durationMin ?? first?.defaultDurationMin ?? 60);
  const [price, setPrice] = React.useState(priceText(row?.price ?? first?.defaultPrice ?? 0));
  useOnSaved(state, () => {
    toast({ title: t("saved"), description: petName });
    onSaved();
  });
  const fe = state?.fieldErrors ?? {};

  function onServiceChange(id: string) {
    setServiceId(id);
    const s = services.find((x) => x.id === id);
    if (s) {
      setDurationMin(s.defaultDurationMin);
      setPrice(priceText(s.defaultPrice));
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetHeader>
        <SheetTitle>{row ? t("editTitle") : t("addTitle")}</SheetTitle>
        <SheetDescription>{t("formHint", { name: petName })}</SheetDescription>
      </SheetHeader>
      <SheetBody className="space-y-5 pb-5">
        <input type="hidden" name="petId" value={petId} />
        {state?.error && !state.fieldErrors ? (
          <Alert tone="danger" role="alert">
            {state.error}
          </Alert>
        ) : null}
        {row ? <input type="hidden" name="serviceId" value={serviceId} /> : null}
        <Field
          id="pet-service"
          name={row ? undefined : "serviceId"}
          label={t("service")}
          error={fe.serviceId}
        >
          {(p) => (
            <Select
              {...p}
              value={serviceId}
              disabled={Boolean(row)}
              onChange={(e) => onServiceChange(e.target.value)}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="pet-service-duration" name="durationMin" label={t("duration")} error={fe.durationMin}>
            {(p) => (
              <Select
                {...p}
                value={String(durationMin)}
                onChange={(e) => setDurationMin(Number(e.target.value))}
              >
                {DURATION_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {formatDuration(tu, m)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="pet-service-price" name="price" label={t("price")} error={fe.price}>
            {(p) => (
              <Input
                {...p}
                inputMode="decimal"
                autoComplete="off"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="tabular-nums"
              />
            )}
          </Field>
        </div>
      </SheetBody>
      <SheetFooter>
        {row ? (
          <Button type="button" variant="ghost" className="text-danger mr-auto" onClick={() => onRemove(row)}>
            <Trash2 aria-hidden />
            {t("remove")}
          </Button>
        ) : null}
        <Button type="submit" size="lg" loading={pending}>
          {pending ? tc("saving") : tc("save")}
        </Button>
      </SheetFooter>
    </form>
  );
}

function priceText(value: number): string {
  return value.toFixed(2).replace(".", ",");
}
