"use client";

import { Archive, ArchiveRestore, ChevronDown, Pencil, Plus, Scissors } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useActionState } from "react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { Field } from "@/components/forms/field";
import { useOnSaved } from "@/components/forms/use-on-saved";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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
import { saveService, setServiceArchived } from "@/lib/actions/settings";
import { DURATION_OPTIONS, formatDuration } from "@/lib/format";
import { formatEur } from "@/lib/money";

export type ServiceRow = {
  id: string;
  name: string;
  defaultDurationMin: number;
  defaultPrice: number;
  archived: boolean;
};

export function ServicesSection({ services }: { services: ServiceRow[] }) {
  const t = useTranslations("settings");
  const tu = useTranslations("units");
  const [editing, setEditing] = React.useState<ServiceRow | "new" | null>(null);
  const [archiving, setArchiving] = React.useState<ServiceRow | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);

  const active = services.filter((s) => !s.archived);
  const archived = services.filter((s) => s.archived);

  async function toggleArchive(service: ServiceRow, archive: boolean) {
    const res = await setServiceArchived(service.id, archive);
    if (res?.ok) {
      toast({ title: archive ? t("serviceArchived") : t("serviceRestored"), description: service.name });
      return true;
    }
    toast({ title: res?.error ?? "", tone: "danger" });
    return false;
  }

  return (
    <section aria-labelledby="services-heading" className="space-y-2">
      <SectionHeading
        id="services-heading"
        title={t("services")}
        hint={t("servicesHint")}
        action={
          <Button size="sm" variant="soft" onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            {t("addService")}
          </Button>
        }
      />

      <Card className="overflow-hidden">
        {active.length === 0 ? (
          <EmptyState
            icon={Scissors}
            title={t("noServicesTitle")}
            description={t("noServicesText")}
            className="py-10"
            headingLevel={3}
            action={
              <Button onClick={() => setEditing("new")}>
                <Plus aria-hidden />
                {t("addService")}
              </Button>
            }
          />
        ) : (
          <ul className="divide-border divide-y">
            {active.map((s) => (
              <li key={s.id} className="flex min-h-16 items-center gap-2 py-2 pr-2 pl-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-muted text-sm tabular-nums">
                    {formatDuration(tu, s.defaultDurationMin)} · {formatEur(s.defaultPrice)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("editServiceNamed", { name: s.name })}
                  onClick={() => setEditing(s)}
                >
                  <Pencil aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {archived.length > 0 ? (
        <div>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((v) => !v)}
            className="text-muted"
          >
            <ChevronDown
              aria-hidden
              className={showArchived ? "rotate-180 transition-transform" : "transition-transform"}
            />
            {t("archivedServices")} ({archived.length})
          </Button>
          {showArchived ? (
            <Card className="mt-1 overflow-hidden">
              <ul className="divide-border divide-y">
                {archived.map((s) => (
                  <li key={s.id} className="flex min-h-14 items-center gap-2 py-2 pr-2 pl-4">
                    <div className="text-muted min-w-0 flex-1">
                      <p className="truncate">{s.name}</p>
                      <p className="text-sm tabular-nums">
                        {formatDuration(tu, s.defaultDurationMin)} · {formatEur(s.defaultPrice)}
                      </p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => toggleArchive(s, false)}>
                      <ArchiveRestore aria-hidden />
                      {t("restore")}
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      ) : null}

      <ServiceSheet
        service={editing}
        onClose={() => setEditing(null)}
        onArchive={(s) => {
          setEditing(null);
          setArchiving(s);
        }}
      />
      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(o) => !o && setArchiving(null)}
        title={t("archiveServiceTitle")}
        description={t("archiveServiceText")}
        confirmLabel={t("archive")}
        onConfirm={() => (archiving ? toggleArchive(archiving, true) : Promise.resolve(true))}
      />
    </section>
  );
}

function ServiceSheet({
  service,
  onClose,
  onArchive,
}: {
  service: ServiceRow | "new" | null;
  onClose: () => void;
  onArchive: (s: ServiceRow) => void;
}) {
  const t = useTranslations("settings");
  return (
    <Sheet open={service !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        {service !== null ? (
          <ServiceForm
            key={service === "new" ? "new" : service.id}
            service={service === "new" ? null : service}
            onSaved={onClose}
            onArchive={onArchive}
            title={service === "new" ? t("addService") : t("editService")}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ServiceForm({
  service,
  title,
  onSaved,
  onArchive,
}: {
  service: ServiceRow | null;
  title: string;
  onSaved: () => void;
  onArchive: (s: ServiceRow) => void;
}) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const tu = useTranslations("units");
  const [state, action, pending] = useActionState(saveService, null);
  useOnSaved(state, () => {
    toast({ title: t("serviceSaved") });
    onSaved();
  });
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetHeader>
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>{t("servicesHint")}</SheetDescription>
      </SheetHeader>
      <SheetBody className="space-y-5 pb-5">
        {service ? <input type="hidden" name="id" value={service.id} /> : null}
        {state?.error && !state.fieldErrors ? (
          <Alert tone="danger" role="alert">
            {state.error}
          </Alert>
        ) : null}
        <Field id="service-name" name="name" label={t("serviceName")} error={fe.name}>
          {(p) => (
            <Input
              {...p}
              defaultValue={service?.name ?? ""}
              placeholder={t("serviceNamePlaceholder")}
              autoComplete="off"
              maxLength={80}
              required
              autoFocus={!service}
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field
            id="service-duration"
            name="defaultDurationMin"
            label={t("defaultDuration")}
            error={fe.defaultDurationMin}
          >
            {(p) => (
              <Select {...p} defaultValue={String(service?.defaultDurationMin ?? 120)}>
                {DURATION_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {formatDuration(tu, m)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            id="service-price"
            name="defaultPrice"
            label={t("defaultPrice")}
            hint={t("priceHint")}
            error={fe.defaultPrice}
          >
            {(p) => (
              <Input
                {...p}
                inputMode="decimal"
                autoComplete="off"
                defaultValue={service ? String(service.defaultPrice).replace(".", ",") : ""}
                required
                className="tabular-nums"
              />
            )}
          </Field>
        </div>
      </SheetBody>
      <SheetFooter>
        {service ? (
          <Button
            type="button"
            variant="ghost"
            className="text-danger sm:mr-auto"
            onClick={() => onArchive(service)}
          >
            <Archive aria-hidden />
            {t("archive")}
          </Button>
        ) : null}
        <Button type="submit" loading={pending}>
          {pending ? tc("saving") : tc("save")}
        </Button>
      </SheetFooter>
    </form>
  );
}

export function SectionHeading({
  id,
  title,
  hint,
  action,
}: {
  id: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 px-1">
      <div className="min-w-0">
        <h2 id={id} className="text-muted text-xs font-semibold tracking-wider uppercase">
          {title}
        </h2>
        {hint ? <p className="text-muted mt-0.5 text-sm">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}
