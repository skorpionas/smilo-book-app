"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { useOnSaved } from "@/components/forms/use-on-saved";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { saveClient } from "@/lib/actions/clients";

export type ClientFormValues = {
  id: string;
  fullName: string;
  /** Display form ("+370 612 34567"); the action normalises it again. */
  phone: string | null;
  email: string | null;
  notes: string;
};

/** Create or edit a client (issue #15). `onSaved` receives the client id. */
export function ClientSheet({
  open,
  onOpenChange,
  client,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: ClientFormValues | null;
  onSaved?: (id: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {open ? (
          <ClientForm
            client={client ?? null}
            onSaved={(id) => {
              onOpenChange(false);
              onSaved?.(id);
            }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ClientForm({ client, onSaved }: { client: ClientFormValues | null; onSaved: (id: string) => void }) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(saveClient, null);
  useOnSaved(state, (s) => {
    toast({ title: t("saved") });
    if (s.id) onSaved(s.id);
  });
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetHeader>
        <SheetTitle>{client ? t("editClient") : t("newClient")}</SheetTitle>
      </SheetHeader>
      <SheetBody className="space-y-5 pb-5">
        {client ? <input type="hidden" name="id" value={client.id} /> : null}
        {state?.error && !state.fieldErrors ? (
          <Alert tone="danger" role="alert">
            {state.error}
          </Alert>
        ) : null}
        <Field id="client-name" name="fullName" label={t("fullName")} error={fe.fullName}>
          {(p) => (
            <Input
              {...p}
              defaultValue={client?.fullName ?? ""}
              placeholder={t("fullNamePlaceholder")}
              autoComplete="off"
              autoCapitalize="words"
              maxLength={100}
              required
              autoFocus={!client}
            />
          )}
        </Field>
        <Field
          id="client-phone"
          name="phone"
          label={t("phone")}
          hint={t("phoneHint")}
          optional={tc("optional")}
          error={fe.phone}
        >
          {(p) => (
            <Input {...p} type="tel" inputMode="tel" autoComplete="off" defaultValue={client?.phone ?? ""} />
          )}
        </Field>
        <Field id="client-email" name="email" label={t("email")} optional={tc("optional")} error={fe.email}>
          {(p) => (
            <Input
              {...p}
              type="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="off"
              defaultValue={client?.email ?? ""}
            />
          )}
        </Field>
        <Field id="client-notes" name="notes" label={t("notes")} optional={tc("optional")} error={fe.notes}>
          {(p) => (
            <Textarea
              {...p}
              defaultValue={client?.notes ?? ""}
              placeholder={t("notesPlaceholder")}
              maxLength={2000}
            />
          )}
        </Field>
      </SheetBody>
      <SheetFooter>
        <Button type="submit" loading={pending}>
          {pending ? tc("saving") : tc("save")}
        </Button>
      </SheetFooter>
    </form>
  );
}
