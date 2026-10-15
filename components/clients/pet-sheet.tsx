"use client";

import { Archive } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Field } from "@/components/forms/field";
import { useFormAction } from "@/components/forms/use-form-action";
import { useOnSaved } from "@/components/forms/use-on-saved";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Select, Textarea } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { savePet } from "@/lib/actions/clients";
import { vilniusClock } from "@/lib/clock";
import { SIZES } from "@/lib/pets";
import { cn } from "@/lib/utils";

export type PetFormValues = {
  id: string;
  name: string;
  species: "dog" | "cat";
  breed: string;
  size: (typeof SIZES)[number] | null;
  weightKg: number | null;
  birthYear: number | null;
  birthMonth: number | null;
  notes: string;
};

/** Add or edit a pet of one client (issue #16). */
export function PetSheet({
  open,
  onOpenChange,
  clientId,
  pet,
  onArchive,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  pet: PetFormValues | null;
  onArchive?: (pet: PetFormValues) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {open ? (
          <PetForm
            key={pet?.id ?? "new"}
            clientId={clientId}
            pet={pet}
            onSaved={() => onOpenChange(false)}
            onArchive={onArchive}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function PetForm({
  clientId,
  pet,
  onSaved,
  onArchive,
}: {
  clientId: string;
  pet: PetFormValues | null;
  onSaved: () => void;
  onArchive?: (pet: PetFormValues) => void;
}) {
  const t = useTranslations("pets");
  const tc = useTranslations("common");
  const tz = useTranslations("sizes");
  const tm = useTranslations("months");
  const [birthYear, setBirthYear] = React.useState(pet?.birthYear != null ? String(pet.birthYear) : "");
  const [birthMonth, setBirthMonth] = React.useState(pet?.birthMonth != null ? String(pet.birthMonth) : "");
  const now = vilniusClock().date;
  const thisYear = Number(now.slice(0, 4));
  const thisMonth = Number(now.slice(5, 7));
  const years = Array.from({ length: thisYear - 1990 + 1 }, (_, i) => thisYear - i);
  const maxMonth = Number(birthYear) === thisYear ? thisMonth : 12;
  const [state, onSubmit, pending] = useFormAction(savePet);
  useOnSaved(state, () => {
    toast({ title: t("saved") });
    onSaved();
  });
  const fe = state?.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetHeader>
        <SheetTitle>{pet ? t("editPet") : t("newPet")}</SheetTitle>
      </SheetHeader>
      <SheetBody className="space-y-5 pb-5">
        <input type="hidden" name="clientId" value={clientId} />
        {pet ? <input type="hidden" name="id" value={pet.id} /> : null}
        {state?.error && !state.fieldErrors ? (
          <Alert tone="danger" role="alert">
            {state.error}
          </Alert>
        ) : null}
        <Field id="pet-name" name="name" label={t("name")} error={fe.name}>
          {(p) => (
            <Input
              {...p}
              defaultValue={pet?.name ?? ""}
              placeholder={t("namePlaceholder")}
              autoComplete="off"
              maxLength={50}
              required
              autoFocus={!pet}
            />
          )}
        </Field>

        <SpeciesToggle
          name="species"
          defaultValue={pet?.species ?? "dog"}
          label={t("species")}
          error={fe.species}
        />

        <Field id="pet-breed" name="breed" label={t("breed")} optional={tc("optional")} error={fe.breed}>
          {(p) => (
            <Input
              {...p}
              defaultValue={pet?.breed ?? ""}
              placeholder={t("breedPlaceholder")}
              autoComplete="off"
              maxLength={80}
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field id="pet-size" name="size" label={t("size")} optional={tc("optional")} error={fe.size}>
            {(p) => (
              <Select {...p} defaultValue={pet?.size ?? ""}>
                <option value="">{t("sizeNone")}</option>
                {SIZES.map((s) => (
                  <option key={s} value={s}>
                    {tz(s)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            id="pet-weight"
            name="weightKg"
            label={t("weight")}
            optional={tc("optional")}
            error={fe.weightKg}
          >
            {(p) => (
              <Input
                {...p}
                inputMode="decimal"
                autoComplete="off"
                placeholder={t("weightPlaceholder")}
                defaultValue={pet?.weightKg != null ? String(pet.weightKg).replace(".", ",") : ""}
                className="tabular-nums"
              />
            )}
          </Field>
        </div>

        <fieldset aria-describedby="pet-birth-hint">
          <legend className="text-foreground mb-1.5 text-sm font-medium">
            {t("birth")}
            <span className="text-muted ml-1 font-normal">({tc("optional")})</span>
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <Field
              id="pet-birth-year"
              name="birthYear"
              label={<span className="sr-only">{t("birthYear")}</span>}
              error={fe.birthYear}
            >
              {(p) => (
                <Select
                  {...p}
                  value={birthYear}
                  onChange={(e) => {
                    setBirthYear(e.target.value);
                    if (!e.target.value) setBirthMonth("");
                    else if (Number(e.target.value) === thisYear && Number(birthMonth) > thisMonth)
                      setBirthMonth("");
                  }}
                  className="tabular-nums"
                >
                  <option value="">{t("yearUnknown")}</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              id="pet-birth-month"
              name="birthMonth"
              label={<span className="sr-only">{t("birthMonth")}</span>}
              error={fe.birthMonth}
            >
              {(p) => (
                <Select
                  {...p}
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value)}
                  disabled={!birthYear}
                >
                  <option value="">{t("monthUnknown")}</option>
                  {Array.from({ length: maxMonth }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {tm(String(m) as "1")}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <FieldHint id="pet-birth-hint">{t("birthHint")}</FieldHint>
        </fieldset>

        <Field
          id="pet-notes"
          name="notes"
          label={t("notes")}
          hint={t("notesHint")}
          optional={tc("optional")}
          error={fe.notes}
        >
          {(p) => (
            <Textarea
              {...p}
              defaultValue={pet?.notes ?? ""}
              placeholder={t("notesPlaceholder")}
              maxLength={2000}
            />
          )}
        </Field>
      </SheetBody>
      <SheetFooter>
        {pet && onArchive ? (
          <Button
            type="button"
            variant="ghost"
            className="text-danger sm:mr-auto"
            onClick={() => onArchive(pet)}
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

/** Two big radio buttons: Šuo / Katė. Works uncontrolled (name) or controlled (value + onChange). */
export function SpeciesToggle({
  name,
  label,
  defaultValue,
  value,
  onChange,
  error,
  idPrefix = "species",
}: {
  name?: string;
  label: string;
  defaultValue?: "dog" | "cat";
  value?: "dog" | "cat";
  onChange?: (v: "dog" | "cat") => void;
  error?: string;
  idPrefix?: string;
}) {
  const ts = useTranslations("species");
  return (
    <fieldset>
      <legend className="text-foreground mb-1.5 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        {(["dog", "cat"] as const).map((s) => (
          <label
            key={s}
            className={cn(
              "border-input bg-surface flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-base font-medium transition-colors",
              "has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary-soft-foreground",
              "has-[:focus-visible]:ring-ring/25 has-[:focus-visible]:ring-[3px]",
            )}
          >
            <input
              id={`${idPrefix}-${s}`}
              type="radio"
              name={name ?? idPrefix}
              value={s}
              className="sr-only"
              {...(onChange
                ? { checked: value === s, onChange: () => onChange(s) }
                : { defaultChecked: (defaultValue ?? "dog") === s })}
            />
            {ts(s)}
          </label>
        ))}
      </div>
      {error ? <p className="text-danger mt-1.5 text-sm">{error}</p> : null}
    </fieldset>
  );
}
