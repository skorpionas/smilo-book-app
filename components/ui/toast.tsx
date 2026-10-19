"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Toast as ToastPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Toasts for save / overlap feedback. Call `toast({ title, tone })` from any
 * client component; <Toaster /> is mounted once in the app layout.
 *
 * Shown at the top of the screen, away from the sheet's Save / Cancel buttons at
 * the bottom. They close by themselves (our own timer, not Radix's: on phones a
 * tap under a fresh toast made Radix pause it for good); a mouse resting on one
 * keeps it open. Radix announces them politely (errors assertively) and supports
 * swipe-to-dismiss.
 */
type Tone = "success" | "danger" | "info";
type ToastItem = { id: number; title: string; description?: string; tone: Tone; open: boolean };

/** How long a toast stays: errors a little longer, so there is time to read them. */
export const TOAST_MS = { success: 4000, info: 4000, danger: 7000 } as const;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export function toast(input: { title: string; description?: string; tone?: Tone }) {
  const item: ToastItem = { id: nextId++, tone: "success", ...input, open: true };
  // At most three at a time: the oldest goes
  for (const old of items.slice(0, -2)) stopTimer(old.id);
  items = [...items.slice(-2), item];
  startTimer(item.id, TOAST_MS[item.tone]);
  emit();
}

function startTimer(id: number, ms: number) {
  stopTimer(id);
  timers.set(
    id,
    setTimeout(() => close(id), ms),
  );
}

function stopTimer(id: number) {
  const timer = timers.get(id);
  if (timer !== undefined) clearTimeout(timer);
  timers.delete(id);
}

function close(id: number) {
  stopTimer(id);
  // keep the item mounted for the exit animation, then drop it
  items = items.map((t) => (t.id === id ? { ...t, open: false } : t));
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 200);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const EMPTY: ToastItem[] = [];

const ICONS = { success: CircleCheck, danger: CircleAlert, info: Info } as const;
const ICON_CLASS = {
  success: "text-primary",
  danger: "text-danger",
  info: "text-info-foreground",
} as const;

export function Toaster() {
  const t = useTranslations("common");
  const list = React.useSyncExternalStore(
    subscribe,
    () => items,
    () => EMPTY,
  );

  return (
    // Radix's own timer is off (Infinity): see the note at the top
    <ToastPrimitive.Provider swipeDirection="up" duration={Infinity} label={t("notifications")}>
      {list.map((item) => {
        const Icon = ICONS[item.tone];
        return (
          <ToastPrimitive.Root
            key={item.id}
            type={item.tone === "danger" ? "foreground" : "background"}
            open={item.open}
            onOpenChange={(open) => {
              if (!open) close(item.id);
            }}
            // A mouse resting on the toast keeps it open; touch never pauses it.
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") stopTimer(item.id);
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse" && item.open) startTimer(item.id, 2000);
            }}
            className={cn(
              "border-border bg-surface text-foreground pointer-events-auto flex w-full items-start gap-3 rounded-lg border p-3.5 pr-2 shadow-lg",
              "data-[state=closed]:animate-toast-out data-[state=open]:animate-toast-in",
              "data-[swipe=end]:animate-toast-out data-[swipe=cancel]:translate-y-0 data-[swipe=cancel]:transition-transform data-[swipe=move]:translate-y-[var(--radix-toast-swipe-move-y)]",
            )}
          >
            <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", ICON_CLASS[item.tone])} />
            <div className="min-w-0 flex-1">
              <ToastPrimitive.Title className="text-sm font-semibold">{item.title}</ToastPrimitive.Title>
              {item.description ? (
                <ToastPrimitive.Description className="text-muted mt-0.5 text-sm">
                  {item.description}
                </ToastPrimitive.Description>
              ) : null}
            </div>
            <ToastPrimitive.Close
              aria-label={t("dismiss")}
              className="text-muted hover:bg-surface-muted hover:text-foreground -my-1.5 flex size-11 shrink-0 items-center justify-center rounded-full transition-colors"
            >
              <X aria-hidden className="size-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}
      {/* Top centre on every screen: never over the sheet's buttons or the tab bar. */}
      <ToastPrimitive.Viewport className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-[60] mx-auto flex w-full max-w-md flex-col gap-2 p-3 outline-none sm:top-[calc(env(safe-area-inset-top)+0.5rem)]" />
    </ToastPrimitive.Provider>
  );
}
