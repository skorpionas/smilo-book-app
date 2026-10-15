"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { rescheduleBooking } from "@/lib/actions/bookings";
import type { CalendarBooking, CalendarGroomer } from "@/lib/calendar-data";
import { DAY_OPEN, GRID_ROWS, SLOT_MINUTES, minutesToTime, timeToMinutes } from "@/lib/clock";

const OPEN = timeToMinutes(DAY_OPEN);
const LONG_PRESS_MS = 350;
const MOUSE_THRESHOLD_PX = 6;
const TOUCH_SLOP_PX = 8;
const EDGE_PX = 80;

export type DragTarget = { groomerId: string; date: string; row: number; busy: boolean };
export type DropPreview = { row: number; span: number; label: string; busy: boolean };

type Move = { booking: CalendarBooking; target: DragTarget };

/**
 * Drag a scheduled booking (or block) to another time, groomer or day, then confirm.
 * Mouse: press and move. Touch: long-press (~0.35 s), then move; a quick swipe still scrolls.
 * Drop targets are lanes marked with data-lane-groomer / data-lane-date (not past days).
 * The keyboard / no-drag alternative is "Keisti datą ar laiką" in the booking sheet.
 */
export function useBookingDrag(groomers: CalendarGroomer[]) {
  const t = useTranslations("booking");
  const [drag, setDrag] = React.useState<{ booking: CalendarBooking; target: DragTarget | null } | null>(
    null,
  );
  const [pending, setPending] = React.useState<Move | null>(null);
  const suppressClick = React.useRef(false);

  const spanOf = (b: CalendarBooking) => Math.max(1, Math.ceil(b.durationMin / SLOT_MINUTES));

  const startDrag = React.useCallback(
    (e: React.PointerEvent<HTMLElement>, booking: CalendarBooking) => {
      if (booking.status !== "scheduled" || (e.pointerType === "mouse" && e.button !== 0)) return;
      const el = e.currentTarget;
      const grabY = e.clientY - el.getBoundingClientRect().top;
      const origin = { x: e.clientX, y: e.clientY };
      const touch = e.pointerType !== "mouse";
      const span = Math.max(1, Math.ceil(booking.durationMin / SLOT_MINUTES));
      let active = false;
      let last: DragTarget | null = null;

      const targetAt = (x: number, y: number): DragTarget | null => {
        const lane = document
          .elementsFromPoint(x, y)
          .map((n) => (n as HTMLElement).closest<HTMLElement>("[data-lane-groomer]"))
          .find(Boolean);
        if (!lane || lane.dataset.laneReadonly === "true") return null;
        const rect = lane.getBoundingClientRect();
        const rowPx = rect.height / GRID_ROWS;
        const raw = Math.round((y - grabY - rect.top) / rowPx);
        const row = Math.min(Math.max(raw, 0), Math.max(GRID_ROWS - span, 0));
        // Overlaps another card in this lane? (The database still has the final say.)
        const busy = [...lane.querySelectorAll<HTMLElement>("[data-booking-id]")].some((card) => {
          if (card.dataset.bookingId === booking.id) return false;
          const r = Number(card.dataset.row);
          const n = Number(card.dataset.span);
          return row < r + n && r < row + span;
        });
        return { groomerId: lane.dataset.laneGroomer!, date: lane.dataset.laneDate!, row, busy };
      };

      const activate = () => {
        active = true;
        suppressClick.current = true;
        document.body.style.userSelect = "none";
        if (touch) navigator.vibrate?.(10);
        setDrag({ booking, target: null });
      };
      const timer = touch ? window.setTimeout(activate, LONG_PRESS_MS) : undefined;

      const onMove = (ev: PointerEvent) => {
        const dist = Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y);
        if (!active) {
          if (touch) {
            if (dist > TOUCH_SLOP_PX) cleanup(); // a swipe: let the page scroll
            return;
          }
          if (dist < MOUSE_THRESHOLD_PX) return;
          activate();
        }
        // Scroll the page when dragging near the top / bottom edge.
        if (ev.clientY < EDGE_PX) window.scrollBy(0, -12);
        else if (ev.clientY > window.innerHeight - EDGE_PX) window.scrollBy(0, 12);
        last = targetAt(ev.clientX, ev.clientY);
        setDrag({ booking, target: last });
      };
      const blockScroll = (ev: TouchEvent) => {
        if (active) ev.preventDefault();
      };
      const onUp = () => {
        const wasActive = active;
        const target = last;
        cleanup();
        if (!wasActive) return;
        const moved =
          target &&
          (target.groomerId !== booking.groomerId ||
            target.date !== booking.date ||
            booking.grid === null ||
            target.row !== booking.grid.row);
        if (target && moved) {
          if (target.busy) toast({ title: t("slotBusy"), tone: "danger" });
          else setPending({ booking, target });
        }
        // Let the click that follows pointerup be swallowed, then re-enable taps.
        window.setTimeout(() => (suppressClick.current = false), 0);
      };
      const onCancel = () => {
        cleanup();
        window.setTimeout(() => (suppressClick.current = false), 0);
      };
      function cleanup() {
        window.clearTimeout(timer);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("touchmove", blockScroll);
        document.body.style.userSelect = "";
        setDrag(null);
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("touchmove", blockScroll, { passive: false });
    },
    [t],
  );

  /** Wrap a "tap to open" handler so the click ending a drag doesn't open the sheet. */
  const guardClick = React.useCallback(
    <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A) => {
        if (!suppressClick.current) fn(...args);
      },
    [],
  );

  /** Ghost shown in the lane under the pointer. */
  const previewFor = (groomerId: string, date: string): DropPreview | null => {
    const target = drag?.target;
    if (!drag || !target || target.groomerId !== groomerId || target.date !== date) return null;
    const span = spanOf(drag.booking);
    const start = OPEN + target.row * SLOT_MINUTES;
    const range = `${minutesToTime(start)}–${endTime(start, drag.booking.durationMin)}`;
    return {
      row: target.row,
      span,
      busy: target.busy,
      label: target.busy ? `${range} · ${t("busy")}` : range,
    };
  };

  const groomerName = (id: string) => groomers.find((g) => g.id === id)?.name ?? "";
  const describe = (m: Move) => {
    const b = m.booking;
    const start = OPEN + m.target.row * SLOT_MINUTES;
    const what =
      b.kind === "block" ? t("blockTitle") : b.items.map((i) => i.petName).join(", ") || t("detailTitle");
    return t("moveText", {
      what,
      from: `${b.date} ${b.startTime}–${b.endTime}, ${groomerName(b.groomerId)}`,
      to: `${m.target.date} ${minutesToTime(start)}–${endTime(start, b.durationMin)}, ${groomerName(m.target.groomerId)}`,
    });
  };

  async function confirmMove() {
    if (!pending) return true;
    const { booking, target } = pending;
    const res = await rescheduleBooking({
      id: booking.id,
      groomerId: target.groomerId,
      date: target.date,
      startTime: minutesToTime(OPEN + target.row * SLOT_MINUTES),
      durationMin: booking.durationMin,
    });
    if (res.ok) {
      toast({
        title: booking.kind === "block" ? t("blockRescheduled") : t("rescheduled"),
        description: `${target.date} ${res.summary?.range ?? ""}`,
      });
    } else {
      toast({ title: res.error ?? Object.values(res.fieldErrors ?? {})[0] ?? "", tone: "danger" });
    }
    return true;
  }

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(o) => !o && setPending(null)}
      tone="primary"
      title={pending?.booking.kind === "block" ? t("moveBlockTitle") : t("moveTitle")}
      description={pending ? describe(pending) : ""}
      confirmLabel={t("move")}
      cancelLabel={t("keep")}
      onConfirm={confirmMove}
    />
  );

  return { draggingId: drag?.booking.id ?? null, startDrag, guardClick, previewFor, dialog };
}

/** End time "HH:mm" (wraps past midnight only in theory: bookings are at most 10 h). */
function endTime(startMin: number, durationMin: number) {
  return minutesToTime((startMin + durationMin) % (24 * 60));
}
