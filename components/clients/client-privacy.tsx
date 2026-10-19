"use client";

import { Download, ShieldX } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { anonymizeClient } from "@/lib/actions/clients";
import { ANONYMIZE_CONFIRM } from "@/lib/schemas/entities";

/**
 * GDPR on the client page (US-17, §15): download everything about the client as JSON,
 * or anonymise them. Anonymising is irreversible, so the owner types a word to confirm,
 * and it is refused while the client still has upcoming visits.
 */
export function ClientPrivacy({ clientId, hasUpcoming }: { clientId: string; hasUpcoming: boolean }) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  const [word, setWord] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const matches = word.trim().toUpperCase() === ANONYMIZE_CONFIRM;

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await anonymizeClient(clientId, word);
      if (res?.ok) {
        toast({ title: t("anonymized") });
        setOpen(false);
        return;
      }
      setError(res?.error ?? null);
    });
  }

  return (
    <section aria-labelledby="privacy-heading" className="space-y-2">
      <h2 id="privacy-heading" className="text-foreground-soft px-1 text-[0.9375rem] font-semibold">
        {t("privacyTitle")}
      </h2>
      <Card className="space-y-3 p-4 sm:p-5">
        <p className="text-muted text-sm">{t("privacyText")}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" className="flex-1 sm:flex-none">
            {/* a plain link: the browser downloads the file (Content-Disposition) */}
            <a href={`/api/export?clientId=${clientId}`} download>
              <Download aria-hidden />
              {t("export")}
            </a>
          </Button>
          <Button
            variant="ghost"
            className="text-danger flex-1 sm:flex-none"
            disabled={hasUpcoming}
            onClick={() => {
              setWord("");
              setError(null);
              setOpen(true);
            }}
          >
            <ShieldX aria-hidden />
            {t("anonymize")}
          </Button>
        </div>
        {hasUpcoming ? <p className="text-muted text-sm">{t("anonymizeBlocked")}</p> : null}
      </Card>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("anonymizeTitle")}</DialogTitle>
            <DialogDescription>{t("anonymizeText")}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (matches) confirm();
            }}
          >
            {error ? (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            ) : null}
            <div>
              <Label htmlFor="anonymize-word">{t("anonymizeTypeLabel", { word: ANONYMIZE_CONFIRM })}</Label>
              <Input
                id="anonymize-word"
                value={word}
                autoComplete="off"
                autoCapitalize="characters"
                onChange={(e) => setWord(e.target.value)}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={pending}>
                  {tc("cancel")}
                </Button>
              </DialogClose>
              <Button type="submit" variant="danger" loading={pending} disabled={!matches}>
                {t("anonymize")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
