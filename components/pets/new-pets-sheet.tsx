"use client";

import { Cat, Dog, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Field, FormSection } from "@/components/forms/field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createPets } from "@/lib/actions/clients";
import { cn } from "@/lib/utils";

type Row = { key: number; name: string; species: "dog" | "cat" };

/**
 * Add a whole household at once (owner feedback 2026-10-16): one row per pet — name
 * and dog / cat — plus an optional owner contact for all of them. Breed, size, notes
 * and prices can be filled in later on each pet's page.
 */
export function NewPetsSheet({
  open,
  onOpenChange,
  clientId = null,
  openAfterCreate = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Add to an existing client (client page); otherwise the owner is optional. */
  clientId?: string | null;
  /** From the pet list: go to the new pet / family afterwards. */
  openAfterCreate?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {open ? (
          <NewPetsForm
            clientId={clientId}
            openAfterCreate={openAfterCreate}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function NewPetsForm({
  clientId,
  openAfterCreate,
  onDone,
}: {
  clientId: string | null;
  openAfterCreate: boolean;
  onDone: () => void;
}) {
  const t = useTranslations("newPets");
  const tp = useTranslations("pets");
  const tc = useTranslations("common");
  const tcl = useTranslations("clients");
  const ts = useTranslations("species");
  const nextKey = React.useRef(1);
  const [rows, setRows] = React.useState<Row[]>([{ key: 0, name: "", species: "dog" }]);
  const [owner, setOwner] = React.useState({ name: "", phone: "", email: "" });
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const focusLast = React.useRef(false);

  React.useEffect(() => {
    if (focusLast.current) {
      const last = rows[rows.length - 1];
      if (last) document.getElementById(`new-pet-${last.key}`)?.focus();
      focusLast.current = false;
    }
  }, [rows]);

  function addRow() {
    const key = nextKey.current++;
    // a new row takes the species of the one above (households are often all dogs)
    setRows((prev) => [...prev, { key, name: "", species: prev[prev.length - 1]?.species ?? "dog" }]);
    focusLast.current = true;
  }

  const named = rows.filter((r) => r.name.trim());
  const noContact = !clientId && !owner.name.trim() && !owner.phone.trim() && !owner.email.trim();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    // empty extra rows are ignored; the first row must have a name
    const pets = rows
      .filter((r, i) => i === 0 || r.name.trim())
      .map((r) => ({ name: r.name, species: r.species }));
    startTransition(async () => {
      const res = await createPets(
        {
          clientId: clientId ?? undefined,
          pets,
          ownerName: owner.name,
          ownerPhone: owner.phone,
          ownerEmail: owner.email,
        },
        openAfterCreate,
      );
      if (res?.ok) {
        toast({ title: t("saved", { count: pets.length }), description: pets.map((p) => p.name).join(", ") });
        onDone();
        return;
      }
      setError(res?.error ?? null);
      setFieldErrors(res?.fieldErrors ?? {});
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetHeader>
        <SheetTitle>{t("title")}</SheetTitle>
        <SheetDescription>{t("description")}</SheetDescription>
      </SheetHeader>
      <SheetBody className="space-y-6 pb-5">
        {error && Object.keys(fieldErrors).length === 0 ? (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        ) : null}

        <ol className="space-y-3" aria-label={t("listLabel")}>
          {rows.map((row, index) => {
            const err = fieldErrors[`pets.${index}.name`];
            return (
              <li key={row.key} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <label htmlFor={`new-pet-${row.key}`} className="sr-only">
                    {t("nameN", { n: index + 1 })}
                  </label>
                  <Input
                    id={`new-pet-${row.key}`}
                    value={row.name}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.key === row.key ? { ...r, name: e.target.value } : r)),
                      )
                    }
                    onKeyDown={(e) => {
                      // Enter on the last name adds the next row: type, Enter, type, Enter…
                      if (
                        e.key === "Enter" &&
                        index === rows.length - 1 &&
                        row.name.trim() &&
                        rows.length < 10
                      ) {
                        e.preventDefault();
                        addRow();
                      }
                    }}
                    placeholder={
                      index === 0 ? tp("namePlaceholder") : t("namePlaceholderN", { n: index + 1 })
                    }
                    autoComplete="off"
                    autoCapitalize="words"
                    maxLength={50}
                    autoFocus={index === 0}
                    aria-invalid={err ? true : undefined}
                    aria-describedby={err ? `new-pet-${row.key}-error` : undefined}
                  />
                  {err ? (
                    <p id={`new-pet-${row.key}-error`} className="text-danger mt-1 text-sm">
                      {err}
                    </p>
                  ) : null}
                </div>
                <div
                  role="group"
                  aria-label={t("speciesN", { n: index + 1 })}
                  className="flex shrink-0 gap-1"
                >
                  {(["dog", "cat"] as const).map((s) => {
                    const Icon = s === "cat" ? Cat : Dog;
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={row.species === s}
                        aria-label={ts(s)}
                        onClick={() =>
                          setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, species: s } : r)))
                        }
                        className={cn(
                          "flex size-11 items-center justify-center rounded-md border transition-colors",
                          row.species === s
                            ? "border-primary bg-primary-soft text-primary-soft-foreground"
                            : "border-input bg-surface text-muted hover:text-foreground",
                        )}
                      >
                        <Icon aria-hidden className="size-5" />
                      </button>
                    );
                  })}
                </div>
                {rows.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("removeN", { n: index + 1 })}
                    onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ol>
        {rows.length < 10 ? (
          <Button type="button" variant="secondary" className="w-full" onClick={addRow}>
            <Plus aria-hidden />
            {t("addRow")}
          </Button>
        ) : null}
        <p className="text-muted -mt-3 text-sm">{t("laterHint")}</p>

        {!clientId ? (
          <FormSection title={`${tp("ownerContact")} (${tc("optional")})`}>
            <p className="text-muted -mt-2 text-sm">
              {named.length > 1 && noContact
                ? t("familyHint", { names: named.map((r) => r.name.trim()).join(", ") })
                : tp("ownerContactHint")}
            </p>
            <Field
              id="new-pets-owner-name"
              label={tcl("fullName")}
              optional={tc("optional")}
              error={fieldErrors.ownerName}
            >
              {(p) => (
                <Input
                  {...p}
                  value={owner.name}
                  onChange={(e) => setOwner({ ...owner, name: e.target.value })}
                  autoComplete="off"
                  autoCapitalize="words"
                  maxLength={100}
                />
              )}
            </Field>
            <Field
              id="new-pets-owner-phone"
              label={tcl("phone")}
              hint={tcl("phoneHint")}
              optional={tc("optional")}
              error={fieldErrors.ownerPhone}
            >
              {(p) => (
                <Input
                  {...p}
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={owner.phone}
                  onChange={(e) => setOwner({ ...owner, phone: e.target.value })}
                />
              )}
            </Field>
            <Field
              id="new-pets-owner-email"
              label={tcl("email")}
              optional={tc("optional")}
              error={fieldErrors.ownerEmail}
            >
              {(p) => (
                <Input
                  {...p}
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  value={owner.email}
                  onChange={(e) => setOwner({ ...owner, email: e.target.value })}
                />
              )}
            </Field>
          </FormSection>
        ) : null}
      </SheetBody>
      <SheetFooter>
        <Button type="submit" size="lg" loading={pending}>
          {pending ? tc("saving") : t("save", { count: Math.max(named.length, 1) })}
        </Button>
      </SheetFooter>
    </form>
  );
}
