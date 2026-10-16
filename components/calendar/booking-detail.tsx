"use client";

import { Ban, CalendarClock, Cat, ChevronRight, Dog, Phone, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";
import { PetNotes } from "@/components/clients/client-detail";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { Field } from "@/components/forms/field";
import { Alert } from "@/components/ui/alert";
import { Input, Select } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GroomerChip } from "@/components/ui/groomer-chip";
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
import { cancelBooking, deleteBooking, rescheduleBooking } from "@/lib/actions/bookings";
import type { CalendarBooking, CalendarGroomer } from "@/lib/calendar-data";
import { BOOKING_START_TIMES, DAY_CLOSE, DAY_OPEN, timeToMinutes, vilniusClock } from "@/lib/clock";
import { DURATION_OPTIONS, formatDuration } from "@/lib/format";
import { worksOn } from "@/lib/schedule";
import { formatEur } from "@/lib/money";

/**
 * Details of a booking or blocked time (US-10). While still scheduled:
 * change date / time / groomer / length, cancel (stays in history) or delete (mistakes).
 */
export function BookingDetailSheet({
  booking,
  groomers,
  onClose,
}: {
  booking: CalendarBooking | null;
  /** All active groomers (for the reschedule form); the booking's own one is looked up here. */
  groomers: CalendarGroomer[];
  onClose: () => void;
}) {
  const t = useTranslations("booking");
  const tc = useTranslations("clients");
  const tu = useTranslations("units");
  const tp = useTranslations("pets");
  const [confirming, setConfirming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  // Keep the last booking rendered while the sheet animates closed.
  const [shown, setShown] = React.useState(booking);
  if (booking && booking !== shown) {
    setShown(booking);
    setEditing(false);
  }
  const b = booking ?? shown;
  const groomer = groomers.find((g) => g.id === b?.groomerId) ?? null;
  const editable = b !== null && b.status === "scheduled";

  async function remove() {
    if (!b) return true;
    const res = await deleteBooking(b.id);
    if (res.ok) {
      toast({
        title: b.kind === "block" ? t("blockDeleted") : t("deleted"),
        description: `${b.date} ${b.startTime}–${b.endTime}`,
      });
      onClose();
      return true;
    }
    toast({ title: res.error ?? "", tone: "danger" });
    return false;
  }

  async function cancel() {
    if (!b) return true;
    const res = await cancelBooking(b.id);
    if (res.ok) {
      toast({ title: t("cancelled"), description: `${b.startTime}–${b.endTime}` });
      onClose();
      return true;
    }
    toast({ title: res.error ?? "", tone: "danger" });
    return false;
  }

  return (
    <>
      <Sheet open={booking !== null} onOpenChange={(o) => !o && onClose()}>
        <SheetContent>
          {b && editing ? (
            <RescheduleForm
              key={b.id}
              booking={b}
              groomers={groomers}
              onBack={() => setEditing(false)}
              onSaved={onClose}
            />
          ) : b ? (
            <>
              <SheetHeader>
                <SheetTitle className="tabular-nums">
                  {b.startTime}–{b.endTime}
                </SheetTitle>
                <SheetDescription className="tabular-nums">
                  {b.date} · {formatDuration(tu, b.durationMin)}
                </SheetDescription>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {groomer ? <GroomerChip name={groomer.name} color={groomer.color} /> : null}
                  {b.kind === "booking" ? <StatusBadge status={b.status} /> : null}
                </div>
              </SheetHeader>

              <SheetBody className="space-y-6 pb-6">
                {b.kind === "block" ? (
                  <div className="space-y-1">
                    <p className="flex items-center gap-2 font-semibold">
                      <Ban aria-hidden className="text-muted size-5" />
                      {t("blockTitle")}
                    </p>
                    {b.blockReason ? <p className="text-foreground-soft">{b.blockReason}</p> : null}
                  </div>
                ) : (
                  <>
                    <section className="space-y-3">
                      <h3 className="text-foreground-soft text-[0.9375rem] font-semibold">{t("pets")}</h3>
                      <ul className="space-y-3">
                        {groupItems(b.items).map((group) => {
                          const first = group[0];
                          const shared = group.length > 1;
                          const minutes = group.reduce((m, i) => m + i.durationMin, 0);
                          const price = group.reduce((m, i) => m + (i.actualPrice ?? i.plannedPrice), 0);
                          return (
                            <li key={first.id} className="border-border space-y-2 rounded-lg border p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="flex flex-wrap items-center gap-x-3">
                                    {group.map((item) =>
                                      item.petId ? (
                                        <Link
                                          key={item.id}
                                          href={`/pets/${item.petId}`}
                                          className="hover:text-primary -my-1 inline-flex min-h-11 items-center gap-1.5 font-semibold"
                                        >
                                          {item.species === "cat" ? (
                                            <Cat aria-hidden className="text-muted size-4" />
                                          ) : (
                                            <Dog aria-hidden className="text-muted size-4" />
                                          )}
                                          {item.petName}
                                          <ChevronRight aria-hidden className="text-muted size-4" />
                                        </Link>
                                      ) : (
                                        <span key={item.id} className="font-semibold">
                                          {item.petName}
                                        </span>
                                      ),
                                    )}
                                  </p>
                                  <p className="text-muted text-sm">
                                    {first.serviceName} · {formatDuration(tu, minutes)}
                                    {shared ? ` · ${t("sharedTogether")}` : ""}
                                  </p>
                                </div>
                                <p className="font-medium tabular-nums">{formatEur(price)}</p>
                              </div>
                              {group.map((item) =>
                                item.petNotes ? (
                                  <PetNotes key={item.id} notes={item.petNotes} label={tp("notes")} />
                                ) : null,
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>

                    {b.client ? (
                      <section className="space-y-2">
                        <h3 className="text-foreground-soft text-[0.9375rem] font-semibold">{t("client")}</h3>
                        <p className="text-lg font-semibold">{b.client.fullName}</p>
                        <div className="flex flex-wrap gap-2">
                          {b.client.phone ? (
                            <Button asChild variant="secondary">
                              <a
                                href={`tel:${b.client.phone}`}
                                aria-label={tc("callNamed", { phone: b.client.phoneDisplay })}
                              >
                                <Phone aria-hidden />
                                <span className="tabular-nums">{b.client.phoneDisplay}</span>
                              </a>
                            </Button>
                          ) : null}
                          <Button asChild variant="ghost">
                            <Link href={`/clients/${b.client.id}`}>
                              <UserRound aria-hidden />
                              {t("openClient")}
                            </Link>
                          </Button>
                        </div>
                      </section>
                    ) : null}

                    {b.notes ? (
                      <section className="space-y-1">
                        <h3 className="text-foreground-soft text-[0.9375rem] font-semibold">
                          {t("bookingNotes")}
                        </h3>
                        <p className="whitespace-pre-line">{b.notes}</p>
                      </section>
                    ) : null}
                  </>
                )}
              </SheetBody>

              {editable ? (
                <SheetFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button variant="secondary" onClick={() => setEditing(true)}>
                    <CalendarClock aria-hidden />
                    {t("reschedule")}
                  </Button>
                  {b.kind === "booking" ? (
                    <Button variant="secondary" className="text-danger" onClick={() => setConfirming(true)}>
                      <Ban aria-hidden />
                      {t("cancel")}
                    </Button>
                  ) : null}
                  <Button variant="ghost" className="text-danger" onClick={() => setDeleting(true)}>
                    <Trash2 aria-hidden />
                    {t("delete")}
                  </Button>
                </SheetFooter>
              ) : null}
            </>
          ) : null}
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("cancelTitle")}
        description={t("cancelText")}
        confirmLabel={t("cancel")}
        cancelLabel={t("keep")}
        onConfirm={cancel}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={b?.kind === "block" ? t("deleteBlockTitle") : t("deleteTitle")}
        description={b?.kind === "block" ? t("deleteBlockText") : t("deleteText")}
        confirmLabel={t("delete")}
        cancelLabel={t("keep")}
        onConfirm={remove}
      />
    </>
  );
}

/** Change groomer, date, start and length of a scheduled booking or block. */
function RescheduleForm({
  booking,
  groomers,
  onBack,
  onSaved,
}: {
  booking: CalendarBooking;
  groomers: CalendarGroomer[];
  onBack: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("booking");
  const tc = useTranslations("common");
  const tu = useTranslations("units");
  const today = vilniusClock().date;
  const [groomerId, setGroomerId] = React.useState(booking.groomerId);
  const [date, setDate] = React.useState(booking.date < today ? today : booking.date);
  const [startTime, setStartTime] = React.useState(booking.startTime);
  const [durationMin, setDurationMin] = React.useState(booking.durationMin);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();

  const start = timeToMinutes(startTime);
  const outsideHours = start < timeToMinutes(DAY_OPEN) || start + durationMin > timeToMinutes(DAY_CLOSE);
  const groomer = groomers.find((g) => g.id === groomerId);
  const offDay = Boolean(groomer && /^\d{4}-\d{2}-\d{2}$/.test(date) && !worksOn(groomer, date));
  // Keep the booking's own groomer selectable even if she was deactivated meanwhile.
  const options = groomers.some((g) => g.id === booking.groomerId)
    ? groomers
    : [{ id: booking.groomerId, name: "—", color: "#64748b", workDays: [] }, ...groomers];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await rescheduleBooking({ id: booking.id, groomerId, date, startTime, durationMin });
      if (res.ok) {
        toast({
          title: booking.kind === "block" ? t("blockRescheduled") : t("rescheduled"),
          description: `${date} ${res.summary?.range ?? ""}`,
        });
        onSaved();
        return;
      }
      setError(res.error ?? null);
      setFieldErrors(res.fieldErrors ?? {});
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetHeader>
        <SheetTitle>{t("rescheduleTitle")}</SheetTitle>
        <SheetDescription className="tabular-nums">
          {booking.date} · {booking.startTime}–{booking.endTime}
        </SheetDescription>
      </SheetHeader>
      <SheetBody className="space-y-5 pb-6">
        {error ? (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field
            id="reschedule-groomer"
            label={t("groomer")}
            error={fieldErrors.groomerId}
            className="col-span-2"
          >
            {(p) => (
              <Select {...p} value={groomerId} onChange={(e) => setGroomerId(e.target.value)}>
                {options.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="reschedule-date" label={t("date")} error={fieldErrors.date}>
            {(p) => (
              <Input
                {...p}
                type="date"
                min={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            )}
          </Field>
          <Field id="reschedule-start" label={t("start")} error={fieldErrors.startTime}>
            {(p) => (
              <Select
                {...p}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="tabular-nums"
              >
                {(BOOKING_START_TIMES.includes(startTime)
                  ? BOOKING_START_TIMES
                  : [startTime, ...BOOKING_START_TIMES]
                ).map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            id="reschedule-duration"
            label={t("totalDuration")}
            error={fieldErrors.durationMin}
            className="col-span-2"
          >
            {(p) => (
              <Select {...p} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))}>
                {(DURATION_OPTIONS.includes(durationMin)
                  ? DURATION_OPTIONS
                  : [durationMin, ...DURATION_OPTIONS]
                ).map((m) => (
                  <option key={m} value={m}>
                    {formatDuration(tu, m)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {booking.date < today ? <Alert tone="info">{t("pastNote")}</Alert> : null}
        {offDay && groomer ? <Alert tone="info">{t("groomerOffDay", { name: groomer.name })}</Alert> : null}
        {outsideHours ? <Alert tone="info">{t("outsideHours")}</Alert> : null}
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

/** Rows entered as one shared service (same sharedGroup) are shown as one line. */
function groupItems(items: CalendarBooking["items"]): CalendarBooking["items"][] {
  const groups: CalendarBooking["items"][] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (item.sharedGroup !== null && last && last[0].sharedGroup === item.sharedGroup) last.push(item);
    else groups.push([item]);
  }
  return groups;
}
