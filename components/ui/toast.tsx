"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Toast as ToastPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Toasts for save / overlap feedback. Call `toast({ title, tone })` from any
 * client component; <Toaster /> is mounted once in the app layout.
 * Radix announces them politely (errors assertively), pauses on hover/focus
 * and supports swipe-to-dismiss on phones.
 */
type Tone = "success" | "danger" | "info";
type ToastItem = { id: number; title: string; description?: string; tone: Tone; open: boolean };

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(input: { title: string; description?: string; tone?: Tone }) {
  items = [...items.slice(-2), { id: nextId++, tone: "success", ...input, open: true }];
  emit();
}

function close(id: number) {
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
    <ToastPrimitive.Provider swipeDirection="down" duration={5000} label={t("notifications")}>
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
      {/* Phones: just above the tab bar. Laptops: bottom-right corner. */}
      <ToastPrimitive.Viewport className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex w-full max-w-md flex-col gap-2 p-3 outline-none lg:right-4 lg:bottom-4 lg:left-auto lg:mx-0 lg:w-96 lg:p-0" />
    </ToastPrimitive.Provider>
  );
}
