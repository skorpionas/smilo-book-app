"use client";

import { Search, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Field, FormSection } from "@/components/forms/field";
import { useDebounced } from "@/components/search-field";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { findClientsForBooking, type BookingClientOption } from "@/lib/actions/bookings";
import { setPetOwner, type PetOwnerInput } from "@/lib/actions/clients";

/**
 * Pet first: the owner is optional. This sheet adds one later (an existing client or a
 * new contact card with any of name / phone / e-mail), changes it, or removes it.
 */
export function PetOwnerButton({
  petId,
  petName,
  hasOwner,
}: {
  petId: string;
  petName: string;
  hasOwner: boolean;
}) {
  const t = useTranslations("petOwner");
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant={hasOwner ? "ghost" : "secondary"} className="w-full" onClick={() => setOpen(true)}>
        <UserRound aria-hidden />
        {t("change")}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          {open ? (
            <PetOwnerForm petId={petId} petName={petName} hasOwner={hasOwner} onDone={() => setOpen(false)} />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function PetOwnerForm({
  petId,
  petName,
  hasOwner,
  onDone,
}: {
  petId: string;
  petName: string;
  hasOwner: boolean;
  onDone: () => void;
}) {
  const t = useTranslations("petOwner");
  const tc = useTranslations("common");
  const tcl = useTranslations("clients");
  const router = useRouter();
  const [mode, setMode] = React.useState<"find" | "new">("find");
  const [query, setQuery] = React.useState("");
  const debounced = useDebounced(query.trim(), 300);
  const [results, setResults] = React.useState<{ q: string; list: BookingClientOption[] }>({
    q: "",
    list: [],
  });
  const [searching, startSearch] = React.useTransition();
  const [contact, setContact] = React.useState({ fullName: "", phone: "", email: "" });
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [pending, startSave] = React.useTransition();

  React.useEffect(() => {
    if (mode !== "find" || debounced.length < 2) return;
    let cancelled = false;
    startSearch(async () => {
      const list = (await findClientsForBooking(debounced)).filter((o) => o.id !== null);
      if (!cancelled) setResults({ q: debounced, list });
    });
    return () => {
      cancelled = true;
    };
  }, [debounced, mode]);

  function save(input: PetOwnerInput, done: string) {
    setError(null);
    setFieldErrors({});
    startSave(async () => {
      const res = await setPetOwner(petId, input);
      if (res?.ok) {
        toast({ title: done, description: petName });
        router.refresh();
        onDone();
        return;
      }
      setError(res?.error ?? null);
      setFieldErrors(res?.fieldErrors ?? {});
    });
  }

  const showResults = query.trim().length >= 2 && results.q === debounced && debounced === query.trim();

  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (mode === "new") save({ mode: "new", ...contact }, t("saved"));
      }}
    >
      <SheetHeader>
        <SheetTitle>{hasOwner ? t("changeTitle") : t("addTitle")}</SheetTitle>
        <SheetDescription>{t("description", { name: petName })}</SheetDescription>
      </SheetHeader>
      <SheetBody className="space-y-6 pb-5">
        {error && Object.keys(fieldErrors).length === 0 ? (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        ) : null}

        <div role="group" aria-label={t("how")} className="bg-surface-muted grid grid-cols-2 rounded-lg p-1">
          {(["find", "new"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={
                mode === m
                  ? "bg-surface text-foreground min-h-10 rounded-md text-sm font-medium shadow-sm"
                  : "text-muted hover:text-foreground min-h-10 rounded-md text-sm font-medium"
              }
            >
              {m === "find" ? t("existing") : t("newContact")}
            </button>
          ))}
        </div>

        {mode === "find" ? (
          <FormSection title={t("existing")}>
            <div className="relative">
              <label htmlFor="owner-search" className="sr-only">
                {t("searchLabel")}
              </label>
              <Search
                aria-hidden
                className="text-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
              />
              <Input
                id="owner-search"
                type="search"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="pr-11 pl-10 [&::-webkit-search-cancel-button]:hidden"
              />
              <span className="absolute top-1/2 right-1 flex -translate-y-1/2">
                {searching ? (
                  <span className="flex size-11 items-center justify-center">
                    <Spinner />
                  </span>
                ) : query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label={tc("clear")}
                    className="text-muted hover:text-foreground flex size-11 items-center justify-center rounded-full"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                ) : null}
              </span>
            </div>
            {showResults ? (
              results.list.length > 0 ? (
                <ul
                  className="border-border divide-border divide-y overflow-hidden rounded-lg border"
                  aria-live="polite"
                >
                  {results.list.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => save({ mode: "existing", id: c.id! }, t("saved"))}
                        aria-label={t("choose", { name: c.fullName })}
                        className="hover:bg-surface-muted flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition-colors"
                      >
                        <Avatar name={c.fullName} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{c.fullName}</span>
                          <span className="text-muted block truncate text-sm tabular-nums">
                            {[c.phoneDisplay, c.pets.map((p) => p.name).join(", ")]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted text-sm" aria-live="polite">
                  {t("noneFound")}
                </p>
              )
            ) : (
              <p className="text-muted text-sm">{t("searchHint")}</p>
            )}
          </FormSection>
        ) : (
          <FormSection title={t("newContact")}>
            <p className="text-muted -mt-2 text-sm">{t("newContactHint")}</p>
            <Field
              id="owner-name"
              label={tcl("fullName")}
              optional={tc("optional")}
              error={fieldErrors.fullName}
            >
              {(p) => (
                <Input
                  {...p}
                  value={contact.fullName}
                  onChange={(e) => setContact({ ...contact, fullName: e.target.value })}
                  autoComplete="off"
                  autoCapitalize="words"
                  maxLength={100}
                />
              )}
            </Field>
            <Field
              id="owner-phone"
              label={tcl("phone")}
              hint={tcl("phoneHint")}
              optional={tc("optional")}
              error={fieldErrors.phone}
            >
              {(p) => (
                <Input
                  {...p}
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  value={contact.phone}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                />
              )}
            </Field>
            <Field id="owner-email" label={tcl("email")} optional={tc("optional")} error={fieldErrors.email}>
              {(p) => (
                <Input
                  {...p}
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  value={contact.email}
                  onChange={(e) => setContact({ ...contact, email: e.target.value })}
                />
              )}
            </Field>
          </FormSection>
        )}
      </SheetBody>
      <SheetFooter>
        {mode === "new" ? (
          <Button type="submit" size="lg" loading={pending}>
            {pending ? tc("saving") : tc("save")}
          </Button>
        ) : null}
      </SheetFooter>
    </form>
  );
}
