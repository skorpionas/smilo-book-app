"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Confirmation for archive / cancel actions. `onConfirm` returns true to close.
 * The trigger is passed as a child (any button).
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  onConfirm,
  open,
  onOpenChange,
  secondary,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  onConfirm(): Promise<boolean>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A second answer next to the main one (e.g. "Tik šią dieną" / "Visą laikotarpį"). */
  secondary?: { label: string; onConfirm(): Promise<boolean> };
}) {
  const t = useTranslations("common");
  const [pending, startTransition] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" disabled={pending}>
              {cancelLabel ?? t("cancel")}
            </Button>
          </DialogClose>
          {secondary ? (
            <Button
              variant="secondary"
              disabled={pending}
              className={tone === "danger" ? "text-danger" : undefined}
              onClick={() =>
                startTransition(async () => {
                  if (await secondary.onConfirm()) onOpenChange(false);
                })
              }
            >
              {secondary.label}
            </Button>
          ) : null}
          <Button
            variant={tone}
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                if (await onConfirm()) onOpenChange(false);
              })
            }
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
