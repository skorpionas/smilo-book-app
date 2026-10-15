"use client";

import { ArrowDown, ArrowUp, Check, Pencil, Plus, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Field } from "@/components/forms/field";
import { useFormAction } from "@/components/forms/use-form-action";
import { useOnSaved } from "@/components/forms/use-on-saved";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { GroomerChip } from "@/components/ui/groomer-chip";
import { FieldHint, Input } from "@/components/ui/input";
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
import { moveGroomer, saveGroomer } from "@/lib/actions/settings";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./services-section";

export type GroomerRow = { id: string; name: string; color: string; isActive: boolean };

// Mid-tone colours: readable as a dot / stripe / 16 % tint on both themes.
const PRESETS = [
  { key: "teal", value: "#0d9488" },
  { key: "amber", value: "#d97706" },
  { key: "rose", value: "#e11d48" },
  { key: "violet", value: "#7c3aed" },
  { key: "blue", value: "#2563eb" },
  { key: "green", value: "#16a34a" },
  { key: "orange", value: "#ea580c" },
  { key: "slate", value: "#64748b" },
] as const;

export function GroomersSection({ groomers }: { groomers: GroomerRow[] }) {
  const t = useTranslations("settings");
  const [editing, setEditing] = React.useState<GroomerRow | "new" | null>(null);
  const [moving, startMove] = React.useTransition();

  function move(g: GroomerRow, direction: "up" | "down") {
    startMove(async () => {
      const res = await moveGroomer(g.id, direction);
      if (!res?.ok) toast({ title: res?.error ?? "", tone: "danger" });
    });
  }

  return (
    <section aria-labelledby="groomers-heading" className="space-y-2">
      <SectionHeading
        id="groomers-heading"
        title={t("groomers")}
        hint={t("groomersHint")}
        action={
          <Button size="sm" variant="soft" onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            {t("addGroomer")}
          </Button>
        }
      />
      <Card className="overflow-hidden">
        {groomers.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title={t("noGroomersTitle")}
            description={t("noGroomersText")}
            className="py-10"
            headingLevel={3}
            action={
              <Button onClick={() => setEditing("new")}>
                <Plus aria-hidden />
                {t("addGroomer")}
              </Button>
            }
          />
        ) : (
          <ul className="divide-border divide-y" aria-busy={moving || undefined}>
            {groomers.map((g, i) => (
              <li key={g.id} className="flex min-h-16 items-center gap-1 py-2 pr-2 pl-4">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <GroomerChip
                    name={g.name}
                    color={g.color}
                    className={cn("truncate", !g.isActive && "opacity-60")}
                  />
                  {!g.isActive ? <Badge tone="outline">{t("inactive")}</Badge> : null}
                </div>
                {groomers.length > 1 ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={i === 0 || moving}
                      aria-label={t("moveUp", { name: g.name })}
                      onClick={() => move(g, "up")}
                    >
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={i === groomers.length - 1 || moving}
                      aria-label={t("moveDown", { name: g.name })}
                      onClick={() => move(g, "down")}
                    >
                      <ArrowDown aria-hidden />
                    </Button>
                  </>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("editGroomerNamed", { name: g.name })}
                  onClick={() => setEditing(g)}
                >
                  <Pencil aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent>
          {editing !== null ? (
            <GroomerForm
              key={editing === "new" ? "new" : editing.id}
              groomer={editing === "new" ? null : editing}
              defaultColor={PRESETS[groomers.length % PRESETS.length].value}
              onSaved={() => setEditing(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function GroomerForm({
  groomer,
  defaultColor,
  onSaved,
}: {
  groomer: GroomerRow | null;
  defaultColor: string;
  onSaved: () => void;
}) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [state, onSubmit, pending] = useFormAction(saveGroomer);
  const [color, setColor] = React.useState(groomer?.color ?? defaultColor);
  const [name, setName] = React.useState(groomer?.name ?? "");
  useOnSaved(state, () => {
    toast({ title: t("groomerSaved") });
    onSaved();
  });
  const fe = state?.fieldErrors ?? {};
  const isPreset = PRESETS.some((p) => p.value === color.toLowerCase());

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetHeader>
        <SheetTitle>{groomer ? t("editGroomer") : t("addGroomer")}</SheetTitle>
        <SheetDescription>{t("groomersHint")}</SheetDescription>
      </SheetHeader>
      <SheetBody className="space-y-5 pb-5">
        {groomer ? <input type="hidden" name="id" value={groomer.id} /> : null}
        <input type="hidden" name="color" value={color} />
        {state?.error && !state.fieldErrors ? (
          <Alert tone="danger" role="alert">
            {state.error}
          </Alert>
        ) : null}
        <Field id="groomer-name" name="name" label={t("groomerName")} error={fe.name}>
          {(p) => (
            <Input
              {...p}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("groomerNamePlaceholder")}
              autoComplete="off"
              maxLength={50}
              required
              autoFocus={!groomer}
            />
          )}
        </Field>

        <fieldset>
          <legend className="text-foreground mb-2 text-sm font-medium">{t("color")}</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {PRESETS.map((p) => {
              const selected = color.toLowerCase() === p.value;
              return (
                <button
                  key={p.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={t(`colors.${p.key}`)}
                  title={t(`colors.${p.key}`)}
                  onClick={() => setColor(p.value)}
                  className={cn(
                    "flex size-11 items-center justify-center rounded-full ring-offset-2 ring-offset-[var(--surface)] transition-shadow",
                    selected ? "ring-foreground ring-2" : "hover:ring-border-strong hover:ring-2",
                  )}
                  style={{ backgroundColor: p.value }}
                >
                  {selected ? <Check aria-hidden className="size-5 text-white" strokeWidth={3} /> : null}
                </button>
              );
            })}
            <label
              className={cn(
                "border-border-strong relative flex size-11 cursor-pointer items-center justify-center overflow-hidden rounded-full border",
                !isPreset && "ring-foreground ring-2 ring-offset-2 ring-offset-[var(--surface)]",
              )}
              title={t("customColor")}
            >
              <span className="sr-only">{t("customColor")}</span>
              <span
                aria-hidden
                className="size-full"
                style={{
                  background: isPreset
                    ? "conic-gradient(#e11d48, #d97706, #16a34a, #0d9488, #2563eb, #7c3aed, #e11d48)"
                    : color,
                }}
              />
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>
          {fe.color ? <p className="text-danger mt-1.5 text-sm">{fe.color}</p> : null}
          <div className="mt-3">
            <GroomerChip name={name.trim() || t("groomerNamePlaceholder")} color={color} />
          </div>
        </fieldset>

        <div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={groomer?.isActive ?? true}
              className="accent-primary size-5"
              aria-describedby="groomer-active-hint"
            />
            <span className="text-base">{t("active")}</span>
          </label>
          <FieldHint id="groomer-active-hint" className="mt-0">
            {t("activeHint")}
          </FieldHint>
        </div>
      </SheetBody>
      <SheetFooter>
        <Button type="submit" loading={pending}>
          {pending ? tc("saving") : tc("save")}
        </Button>
      </SheetFooter>
    </form>
  );
}
