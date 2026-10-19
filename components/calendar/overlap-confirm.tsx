"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";

type Ask = {
  groomer: string;
  visits: string[];
  /** Moving an existing visit (drag / "Keisti datą ar laiką") instead of booking a new one. */
  move?: boolean;
  /** Save again with the overlap allowed; resolves true to close the dialog. */
  retry(): Promise<boolean>;
};

/**
 * "Šis laikas jau užimtas — registruoti vizitą, kuris su juo persidengia?" (owner feedback
 * 2026-10-19). A save that lands on another visit of the same groomer comes back with
 * `overlap`; `ask` shows what is already there and, on "Taip", saves again with
 * `allowOverlap`. Blocked time never gets here: the server answers with a plain error.
 */
export function useOverlapConfirm() {
  const t = useTranslations("booking");
  const [ask, setAsk] = React.useState<Ask | null>(null);

  const dialog = (
    <ConfirmDialog
      open={ask !== null}
      onOpenChange={(o) => !o && setAsk(null)}
      tone="primary"
      title={t("overlapTitle")}
      description={
        ask
          ? t(ask.move ? "overlapMoveText" : "overlapText", {
              groomer: ask.groomer,
              visits: ask.visits.join("; "),
            })
          : ""
      }
      confirmLabel={ask?.move ? t("overlapMoveConfirm") : t("overlapConfirm")}
      cancelLabel={t("overlapBack")}
      onConfirm={() => (ask ? ask.retry() : Promise.resolve(true))}
    />
  );

  return { ask: setAsk, dialog };
}
