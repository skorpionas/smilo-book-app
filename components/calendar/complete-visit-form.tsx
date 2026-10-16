"use client";

import { Ban, CircleCheck, UserX } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Field } from "@/components/forms/field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { SheetBody, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { completeVisit } from "@/lib/actions/bookings";
import { groupItems } from "@/lib/booking-groups";
import type { CalendarBooking } from "@/lib/calendar-data";
import { formatEur, parseEur } from "@/lib/money";
import type { VisitResult } from "@/lib/schemas/booking";
import { splitPrice } from "@/lib/split";
import { cn } from "@/lib/utils";

const RESULTS: { value: VisitResult; icon: typeof CircleCheck }[] = [
  { value: "completed", icon: CircleCheck },
  { value: "no_show", icon: UserX },
  { value: "cancelled", icon: Ban },
];

/**
 * US-11: result of a visit — Įvykdyta / Neatvyko / Atšaukta, the actual price (one
 * field per line; a shared service is split per pet on save) and notes per pet.
 * Visits complete themselves after their end time, so this is mostly for corrections.
 */
export function CompleteVisitForm({
  booking,
  onBack,
  onSaved,
}: {
  booking: CalendarBooking;
  onBack: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("booking");
  const ts = useTranslations("status");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const groups = React.useMemo(() => groupItems(booking.items), [booking.items]);

  const [status, setStatus] = React.useState<VisitResult>(
    booking.status === "no_show" ? "no_show" : "completed",
  );
  // one price per line (shared service = total of its rows)
  const [prices, setPrices] = React.useState(() =>
    groups.map((g) => priceText(g.reduce((s, i) => s + (i.actualPrice ?? i.plannedPrice), 0))),
  );
  const [notes, setNotes] = React.useState(() =>
    Object.fromEntries(booking.items.map((i) => [i.id, i.visitNotes])),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [priceErrors, setPriceErrors] = React.useState<Record<number, string>>({});
  const [pending, startTransition] = React.useTransition();
  const done = status === "completed";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPriceErrors({});

    const items: { id: string; actualPrice: number | null; visitNotes: string }[] = [];
    const bad: Record<number, string> = {};
    groups.forEach((group, gi) => {
      const total = done ? parseEur(prices[gi]) : null;
      if (done && total === null) bad[gi] = te("invalidPrice");
      const parts = total === null ? [] : splitPrice(total, group.length);
      group.forEach((item, i) =>
        items.push({ id: item.id, actualPrice: parts[i] ?? null, visitNotes: notes[item.id] ?? "" }),
      );
    });
    if (Object.keys(bad).length > 0) {
      setPriceErrors(bad);
      return;
    }

    startTransition(async () => {
      const res = await completeVisit({ id: booking.id, status, items });
      if (res.ok) {
        toast({
          title: t("visitSaved"),
          description: `${booking.date} ${booking.startTime}–${booking.endTime}`,
        });
        onSaved();
        return;
      }
      setError(res.error ?? null);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetHeader>
        <SheetTitle>{booking.status === "scheduled" ? t("completeTitle") : t("correctTitle")}</SheetTitle>
        <SheetDescription className="tabular-nums">
          {booking.date} · {booking.startTime}–{booking.endTime}
        </SheetDescription>
      </SheetHeader>
      <SheetBody className="space-y-6 pb-6">
        {error ? (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        ) : null}
        {booking.status === "completed" ? <Alert tone="info">{t("autoCompleteHint")}</Alert> : null}

        <fieldset>
          <legend className="text-foreground mb-2 text-sm font-medium">{t("result")}</legend>
          <div role="radiogroup" className="grid grid-cols-3 gap-2">
            {RESULTS.map(({ value, icon: Icon }) => {
              const selected = status === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setStatus(value)}
                  className={cn(
                    "border-border flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
                    selected
                      ? "border-primary bg-primary-soft text-primary-soft-foreground ring-primary ring-1"
                      : "text-foreground-soft hover:bg-surface-muted",
                  )}
                >
                  <Icon aria-hidden className="size-5" />
                  {ts(value)}
                </button>
              );
            })}
          </div>
          {!done ? <p className="text-muted mt-2 text-sm">{t("noPriceHint")}</p> : null}
        </fieldset>

        <ul className="space-y-4">
          {groups.map((group, gi) => {
            const first = group[0];
            const planned = group.reduce((s, i) => s + i.plannedPrice, 0);
            const names = group.map((i) => i.petName).join(" + ");
            return (
              <li key={first.id} className="border-border space-y-3 rounded-lg border p-3">
                <div>
                  <p className="font-semibold">{names}</p>
                  <p className="text-muted text-sm">{first.serviceName}</p>
                </div>
                {done ? (
                  <Field
                    id={`visit-price-${first.id}`}
                    label={t("actualPrice")}
                    hint={t("plannedPrice", { price: formatEur(planned) })}
                    error={priceErrors[gi]}
                  >
                    {(p) => (
                      <Input
                        {...p}
                        inputMode="decimal"
                        autoComplete="off"
                        value={prices[gi]}
                        onChange={(e) =>
                          setPrices((all) => all.map((v, i) => (i === gi ? e.target.value : v)))
                        }
                        className="tabular-nums"
                      />
                    )}
                  </Field>
                ) : null}
                {group.map((item) => (
                  <Field
                    key={item.id}
                    id={`visit-notes-${item.id}`}
                    label={group.length > 1 ? t("visitNotesFor", { name: item.petName }) : t("visitNotes")}
                  >
                    {(p) => (
                      <Textarea
                        {...p}
                        rows={2}
                        maxLength={2000}
                        placeholder={t("visitNotesPlaceholder")}
                        value={notes[item.id] ?? ""}
                        onChange={(e) => setNotes((all) => ({ ...all, [item.id]: e.target.value }))}
                      />
                    )}
                  </Field>
                ))}
              </li>
            );
          })}
        </ul>
      </SheetBody>
      <SheetFooter className="flex-row gap-2">
        <Button type="button" variant="secondary" onClick={onBack} disabled={pending}>
          {t("back")}
        </Button>
        <Button type="submit" loading={pending} className="flex-1">
          {pending ? tc("saving") : tc("save")}
        </Button>
      </SheetFooter>
    </form>
  );
}

function priceText(value: number): string {
  return value.toFixed(2).replace(".", ",");
}
