"use client";

import { Ban, Phone, UserRound } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";
import { PetNotes } from "@/components/clients/client-detail";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
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
import { cancelBooking } from "@/lib/actions/bookings";
import type { CalendarBooking, CalendarGroomer } from "@/lib/calendar-data";
import { formatDuration } from "@/lib/format";
import { formatEur } from "@/lib/money";

/** Details of a booking or blocked time; cancel for scheduled bookings (US-10, cancel part). */
export function BookingDetailSheet({
  booking,
  groomer,
  onClose,
}: {
  booking: CalendarBooking | null;
  groomer: CalendarGroomer | null;
  onClose: () => void;
}) {
  const t = useTranslations("booking");
  const tc = useTranslations("clients");
  const tu = useTranslations("units");
  const tp = useTranslations("pets");
  const [confirming, setConfirming] = React.useState(false);
  // Keep the last booking rendered while the sheet animates closed.
  const [shown, setShown] = React.useState(booking);
  if (booking && booking !== shown) setShown(booking);
  const b = booking ?? shown;

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
          {b ? (
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
                    {b.client ? (
                      <section className="space-y-2">
                        <h3 className="text-muted text-xs font-semibold tracking-wider uppercase">
                          {t("client")}
                        </h3>
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

                    <section className="space-y-3">
                      <h3 className="text-muted text-xs font-semibold tracking-wider uppercase">
                        {t("pets")}
                      </h3>
                      <ul className="space-y-3">
                        {b.items.map((item) => (
                          <li key={item.id} className="border-border space-y-2 rounded-lg border p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold">{item.petName}</p>
                                <p className="text-muted text-sm">
                                  {item.serviceName} · {formatDuration(tu, item.durationMin)}
                                </p>
                              </div>
                              <p className="font-medium tabular-nums">
                                {formatEur(item.actualPrice ?? item.plannedPrice)}
                              </p>
                            </div>
                            {item.petNotes ? <PetNotes notes={item.petNotes} label={tp("notes")} /> : null}
                          </li>
                        ))}
                      </ul>
                    </section>

                    {b.notes ? (
                      <section className="space-y-1">
                        <h3 className="text-muted text-xs font-semibold tracking-wider uppercase">
                          {t("bookingNotes")}
                        </h3>
                        <p className="whitespace-pre-line">{b.notes}</p>
                      </section>
                    ) : null}
                  </>
                )}
              </SheetBody>

              {b.kind === "booking" && b.status === "scheduled" ? (
                <SheetFooter>
                  <Button variant="secondary" className="text-danger" onClick={() => setConfirming(true)}>
                    <Ban aria-hidden />
                    {t("cancel")}
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
    </>
  );
}
