"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog as SheetPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Sheet: bottom sheet on phones (< 1024 px), right-hand side panel on laptops.
 * Built on Radix Dialog → focus trap, Esc to close, scroll lock, aria-modal.
 * Primary actions go in <SheetFooter>, which sits in the thumb zone on phones.
 */
export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

export function SheetContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content>) {
  const t = useTranslations("common");
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="bg-overlay data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in fixed inset-0 z-50" />
      <SheetPrimitive.Content
        className={cn(
          "bg-surface text-foreground fixed z-50 flex flex-col shadow-lg outline-none",
          // phone: bottom sheet
          "border-border inset-x-0 bottom-0 max-h-[92dvh] rounded-t-xl border-t",
          "data-[state=closed]:animate-sheet-down data-[state=open]:animate-sheet-up",
          // laptop: side panel
          "lg:inset-y-0 lg:right-0 lg:left-auto lg:h-dvh lg:max-h-none lg:w-[28rem] lg:rounded-none lg:border-t-0 lg:border-l",
          "lg:data-[state=closed]:animate-sheet-right lg:data-[state=open]:animate-sheet-left",
          className,
        )}
        {...props}
      >
        <div aria-hidden className="flex justify-center pt-2.5 pb-1 lg:hidden">
          <span className="bg-border-strong h-1.5 w-10 rounded-full" />
        </div>
        {children}
        <SheetPrimitive.Close
          aria-label={t("close")}
          className="text-muted hover:bg-surface-muted hover:text-foreground absolute top-2 right-2 flex size-11 items-center justify-center rounded-full transition-colors lg:top-3 lg:right-3"
        >
          <X aria-hidden className="size-5" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 px-5 pt-2 pr-14 pb-3 lg:pt-5", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      className={cn("font-display text-xl font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn("text-muted text-sm", className)} {...props} />;
}

/** Scrollable middle part. */
export function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-2", className)}
      {...props}
    />
  );
}

/** Sticky actions in the thumb zone; primary action last (= right). Phones: buttons share the row. */
export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-border bg-surface flex gap-2 border-t px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] *:flex-1 sm:justify-end sm:*:flex-none",
        className,
      )}
      {...props}
    />
  );
}
