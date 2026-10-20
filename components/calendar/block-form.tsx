"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { Field } from "@/components/forms/field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { SheetBody, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { createBlock } from "@/lib/actions/bookings";
import type { CalendarGroomer } from "@/lib/calendar-data";
import {
  BOOKING_START_TIMES,
  DAY_CLOSE,
  DAY_OPEN,
  SLOT_MINUTES,
  minutesToTime,
  timeToMinutes,
  vilniusClock,
} from "@/lib/clock";
import { datesBetween, shiftDate } from "@/lib/schedule";
import { cn } from "@/lib/utils";

export type BlockDefaults = { groomerId: string; date: string; startTime: string };

/** End times: 15 min after the first start time up to 22:00. */
const END_TIMES = [
  ...BOOKING_START_TIMES.slice(1),
  minutesToTime(timeToMinutes(BOOKING_START_TIMES.at(-1)!) + SLOT_MINUTES),
];

/** "Vizitas | Nedarbo laikas" at the top of the new-booking sheet. */
export function SheetModeSwitch({
  mode,
  onChange,
}: {
  mode: "booking" | "block";
  onChange: (mode: "booking" | "block") => void;
}) {
  const t = useTranslations("block");
  return (
    <div className="px-5 pt-2 pr-14 md:pt-4">
      <div
        role="radiogroup"
        aria-label={t("modeLabel")}
        className="bg-surface-muted ring-border grid grid-cols-2 rounded-lg p-0.5 ring-1 ring-inset"
      >
        {(["booking", "block"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => onChange(m)}
            className={cn(
              "flex h-10 items-center justify-center rounded-md px-3 text-sm transition-colors focus-visible:outline-offset-[-2px]",
              mode === m
                ? "bg-surface text-foreground ring-border-strong font-semibold shadow-sm ring-1"
                : "text-muted hover:text-foreground font-medium",
            )}
          >
            {m === "booking" ? t("modeBooking") : t("modeBlock")}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * US-16: blocked time for one or both groomers — one date or a period (vacation,
 * sick leave), from–to each day (or the whole working day) and an optional reason.
 * Shown in the calendar; nothing can be booked over it.
 */
export function BlockForm({
  defaults,
  groomers,
  onSaved,
}: {
  defaults: BlockDefaults;
  groomers: CalendarGroomer[];
  onSaved: (date: string) => void;
}) {
  const t = useTranslations("block");
  const tc = useTranslations("common");
  const startDefault = BOOKING_START_TIMES.includes(defaults.startTime) ? defaults.startTime : DAY_OPEN;
  const [groomerIds, setGroomerIds] = React.useState<string[]>([defaults.groomerId]);
  const [date, setDate] = React.useState(defaults.date);
  const [dateTo, setDateTo] = React.useState(defaults.date);
  const [startTime, setStartTime] = React.useState(startDefault);
  const [endTime, setEndTime] = React.useState(() =>
    minutesToTime(Math.min(timeToMinutes(startDefault) + 60, timeToMinutes(END_TIMES.at(-1)!))),
  );
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();

  const allSelected = groomers.length > 1 && groomers.every((g) => groomerIds.includes(g.id));
  const wholeDay = startTime === DAY_OPEN && endTime === DAY_CLOSE;
  const dayCount = dateTo >= date ? datesBetween(date, dateTo).length : 0;
  const multiDay = dayCount > 1;

  function changeDate(value: string) {
    setDate(value);
    // keep the period's length when its start moves
    if (value && dateTo && date && dateTo >= date) {
      const length = datesBetween(date, dateTo).length - 1;
      setDateTo(length > 0 ? shiftDate(value, length) : value);
    } else {
      setDateTo(value);
    }
  }

  function changeDateTo(value: string) {
    const wasSingle = dateTo === date;
    setDateTo(value);
    // a vacation or sick leave is usually whole days
    if (wasSingle && value > date) {
      setStartTime(DAY_OPEN);
      setEndTime(DAY_CLOSE);
    }
  }

  function toggleGroomer(id: string) {
    setGroomerIds((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  }

  function changeStart(value: string) {
    setStartTime(value);
    // keep the length when the end would fall before the new start
    if (timeToMinutes(endTime) <= timeToMinutes(value)) {
      setEndTime(minutesToTime(Math.min(timeToMinutes(value) + 60, timeToMinutes(END_TIMES.at(-1)!))));
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await createBlock({ groomerIds, date, dateTo, startTime, endTime, reason });
      if (res.ok) {
        toast({
          title: multiDay ? t("savedPeriod") : t("saved"),
          description: [res.summary?.range, reason.trim()].filter(Boolean).join(", "),
        });
        onSaved(date);
        return;
      }
      setError(res.error ?? null);
      setFieldErrors(res.fieldErrors ?? {});
    });
  }

  const fe = fieldErrors;
  const groomerError = fe.groomerIds;

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetHeader>
        <SheetTitle>{t("title")}</SheetTitle>
        <SheetDescription>{t("description")}</SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-6 pb-6">
        {error ? (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        ) : null}

        <fieldset aria-describedby={groomerError ? "block-groomers-error" : undefined}>
          <legend className="text-foreground mb-1.5 text-sm font-medium">{t("groomers")}</legend>
          <div className="flex flex-wrap gap-2">
            {groomers.map((g) => (
              <label
                key={g.id}
                className={cn(
                  "border-input bg-surface flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3.5 text-base font-medium transition-colors",
                  "has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary-soft-foreground",
                  "has-[:focus-visible]:ring-ring/25 has-[:focus-visible]:ring-[3px]",
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={groomerIds.includes(g.id)}
                  onChange={() => toggleGroomer(g.id)}
                />
                <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                {g.name}
              </label>
            ))}
          </div>
          {groomers.length > 1 ? (
            <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-base">
              <input
                type="checkbox"
                className="accent-primary size-5"
                checked={allSelected}
                onChange={(e) =>
                  setGroomerIds(e.target.checked ? groomers.map((g) => g.id) : [defaults.groomerId])
                }
              />
              {t("bothGroomers")}
            </label>
          ) : null}
          {groomerError ? (
            <p id="block-groomers-error" role="alert" className="text-danger mt-1.5 text-sm">
              {groomerError}
            </p>
          ) : null}
        </fieldset>

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <Field id="block-date" label={t("dateFrom")} error={fe.date}>
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  min={vilniusClock().date}
                  value={date}
                  onChange={(e) => changeDate(e.target.value)}
                  required
                />
              )}
            </Field>
            <Field id="block-date-to" label={t("dateTo")} error={fe.dateTo}>
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  min={date || vilniusClock().date}
                  value={dateTo}
                  onChange={(e) => changeDateTo(e.target.value)}
                  required
                />
              )}
            </Field>
          </div>
          <p className="text-muted text-sm" aria-live="polite">
            {multiDay ? `${t("periodDays", { count: dayCount })}. ` : ""}
            {t("periodHint")}
          </p>
        </div>

        <div className="space-y-3">
          {multiDay ? <p className="text-foreground text-sm font-medium">{t("timeEachDay")}</p> : null}
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base">
            <input
              type="checkbox"
              className="accent-primary size-5"
              checked={wholeDay}
              onChange={(e) => {
                if (e.target.checked) {
                  setStartTime(DAY_OPEN);
                  setEndTime(DAY_CLOSE);
                } else {
                  setEndTime(minutesToTime(timeToMinutes(DAY_OPEN) + 60));
                }
              }}
            />
            {t("wholeDay", { from: DAY_OPEN, to: DAY_CLOSE })}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field id="block-start" label={t("from")} error={fe.startTime}>
              {(p) => (
                <Select
                  {...p}
                  value={startTime}
                  onChange={(e) => changeStart(e.target.value)}
                  className="tabular-nums"
                >
                  {BOOKING_START_TIMES.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field id="block-end" label={t("to")} error={fe.endTime}>
              {(p) => (
                <Select
                  {...p}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="tabular-nums"
                >
                  {END_TIMES.filter((time) => timeToMinutes(time) > timeToMinutes(startTime)).map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </div>

        <Field id="block-reason" label={t("reason")} optional={tc("optional")} error={fe.reason}>
          {(p) => (
            <Input
              {...p}
              value={reason}
              maxLength={200}
              placeholder={t("reasonPlaceholder")}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </Field>
      </SheetBody>

      <SheetFooter>
        <Button type="submit" size="lg" loading={pending}>
          {pending ? tc("saving") : t("save")}
        </Button>
      </SheetFooter>
    </form>
  );
}
