"use client";

import { Cat, Dog, Phone, Plus, Search, Settings, Trash2, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";
import { SpeciesToggle } from "@/components/clients/pet-sheet";
import { Field, FormSection } from "@/components/forms/field";
import { useDebounced } from "@/components/search-field";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select, Textarea } from "@/components/ui/input";
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
import {
  createBooking,
  findClientsForBooking,
  getPricePrefill,
  type BookingClientOption,
} from "@/lib/actions/bookings";
import type { CalendarGroomer, CalendarService } from "@/lib/calendar-data";
import { DURATION_OPTIONS, formatDuration } from "@/lib/format";
import { formatEur, parseEur } from "@/lib/money";
import type { BookingInput } from "@/lib/schemas/booking";
import { searchDigits } from "@/lib/search";
import { DAY_CLOSE, DAY_OPEN, minutesToTime, timeToMinutes } from "@/lib/clock";
import { cn } from "@/lib/utils";
import { worksOn } from "@/lib/schedule";

export type BookingDefaults = {
  groomerId: string;
  date: string;
  startTime: string;
  client: BookingClientOption | null;
};

// Start times offered: 06:00–21:45 (outside 08:00–19:00 shows a warning, not a block).
const START_TIMES = Array.from({ length: 64 }, (_, i) => minutesToTime(6 * 60 + i * 15));
const NEW_PET = "__new";

type ItemState = {
  key: number;
  petId: string; // "" | pet uuid | NEW_PET
  newPetName: string;
  newPetSpecies: "dog" | "cat";
  serviceId: string;
  durationMin: number;
  price: string;
  priceSource: "last" | "default" | null;
};

type ClientState =
  | { mode: "none" }
  | { mode: "existing"; option: BookingClientOption }
  | { mode: "new"; fullName: string; phone: string; email: string };

/** Bottom sheet (phone) / side panel (laptop) for a new booking (US-05 … US-09). */
export function BookingSheet({
  defaults,
  onClose,
  onSaved,
  groomers,
  services,
}: {
  defaults: BookingDefaults | null;
  onClose: () => void;
  onSaved: (date: string) => void;
  groomers: CalendarGroomer[];
  services: CalendarService[];
}) {
  return (
    <Sheet open={defaults !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent aria-describedby={undefined}>
        {defaults ? (
          services.length === 0 ? (
            <NoServices />
          ) : (
            <BookingForm defaults={defaults} groomers={groomers} services={services} onSaved={onSaved} />
          )
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function NoServices() {
  const t = useTranslations("booking");
  return (
    <>
      <SheetHeader>
        <SheetTitle>{t("title")}</SheetTitle>
      </SheetHeader>
      <SheetBody>
        <EmptyState
          icon={Settings}
          title={t("noServicesTitle")}
          description={t("noServicesText")}
          action={
            <Button asChild>
              <Link href="/settings">{t("toSettings")}</Link>
            </Button>
          }
        />
      </SheetBody>
    </>
  );
}

function BookingForm({
  defaults,
  groomers,
  services,
  onSaved,
}: {
  defaults: BookingDefaults;
  groomers: CalendarGroomer[];
  services: CalendarService[];
  onSaved: (date: string) => void;
}) {
  const t = useTranslations("booking");
  const tc = useTranslations("common");
  const tu = useTranslations("units");
  const tp = useTranslations("pets");
  const nextKey = React.useRef(1);
  const bodyRef = React.useRef<HTMLDivElement>(null);

  const [groomerId, setGroomerId] = React.useState(defaults.groomerId);
  const [date, setDate] = React.useState(defaults.date);
  const [startTime, setStartTime] = React.useState(defaults.startTime);
  const [client, setClient] = React.useState<ClientState>(
    defaults.client ? { mode: "existing", option: defaults.client } : { mode: "none" },
  );
  const [items, setItems] = React.useState<ItemState[]>(() => [emptyItem(0, defaults.client)]);
  const [durationMin, setDurationMin] = React.useState<number | null>(null); // null = sum of items
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();

  const pets = client.mode === "existing" ? client.option.pets : [];
  const itemsSum = items.reduce((s, i) => s + i.durationMin, 0);
  const totalDuration = durationMin ?? (itemsSum || 15);
  const startMin = timeToMinutes(startTime);
  const endMin = startMin + totalDuration;
  const outsideHours = startMin < timeToMinutes(DAY_OPEN) || endMin > timeToMinutes(DAY_CLOSE);
  const groomer = groomers.find((g) => g.id === groomerId);
  const offDay = Boolean(groomer && /^\d{4}-\d{2}-\d{2}$/.test(date) && !worksOn(groomer, date));
  const totalPrice = items.reduce((s, i) => s + (parseEur(i.price) ?? 0), 0);

  function chooseClient(next: ClientState) {
    setClient(next);
    setFieldErrors({});
    const option = next.mode === "existing" ? next.option : null;
    // Pets belong to one client: reset the pet choice on every client change.
    setItems((prev) =>
      prev.map((item, index) => {
        const petId = index === 0 ? defaultPetId(option) : option ? "" : NEW_PET;
        return { ...item, petId, priceSource: null };
      }),
    );
    if (option?.pets.length === 1) {
      const only = option.pets[0];
      const first = items[0];
      if (first?.serviceId) void refreshPrice(first.key, only.id, first.serviceId);
    }
  }

  function updateItem(key: number, patch: Partial<ItemState>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  async function refreshPrice(key: number, petId: string, serviceId: string) {
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;
    if (!petId || petId === NEW_PET) {
      updateItem(key, { price: priceText(service.defaultPrice), priceSource: "default" });
      return;
    }
    const prefill = await getPricePrefill(petId, serviceId);
    const value = prefill ?? service.defaultPrice;
    updateItem(key, {
      price: priceText(value),
      priceSource: prefill !== null && prefill !== service.defaultPrice ? "last" : "default",
    });
  }

  function onPetChange(item: ItemState, petId: string) {
    updateItem(item.key, { petId });
    if (item.serviceId) void refreshPrice(item.key, petId, item.serviceId);
  }

  function onServiceChange(item: ItemState, serviceId: string) {
    const service = services.find((s) => s.id === serviceId);
    updateItem(item.key, {
      serviceId,
      durationMin: service?.defaultDurationMin ?? item.durationMin,
      price: service ? priceText(service.defaultPrice) : item.price,
      priceSource: service ? "default" : null,
    });
    if (service) void refreshPrice(item.key, item.petId, serviceId);
  }

  function addItem() {
    const key = nextKey.current++;
    setItems((prev) => [
      ...prev,
      { ...emptyItem(key, null), petId: client.mode === "existing" ? "" : NEW_PET },
    ]);
  }

  function removeItem(key: number) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const input: BookingInput = {
      groomerId,
      date,
      startTime,
      durationMin: totalDuration,
      client:
        client.mode === "existing"
          ? { mode: "existing", id: client.option.id }
          : client.mode === "new"
            ? { mode: "new", fullName: client.fullName, phone: client.phone, email: client.email }
            : (undefined as unknown as BookingInput["client"]),
      items: items.map((i) => ({
        pet:
          i.petId === NEW_PET
            ? { mode: "new", name: i.newPetName, species: i.newPetSpecies, breed: "" }
            : i.petId
              ? { mode: "existing", id: i.petId }
              : (undefined as unknown as BookingInput["items"][number]["pet"]),
        serviceId: i.serviceId,
        durationMin: i.durationMin,
        plannedPrice: i.price,
      })),
      notes,
    };

    startTransition(async () => {
      const res = await createBooking(input);
      if (res.ok) {
        const petNames = items
          .map((i) => (i.petId === NEW_PET ? i.newPetName : pets.find((p) => p.id === i.petId)?.name))
          .filter(Boolean)
          .join(", ");
        toast({ title: t("saved"), description: [res.summary?.range, petNames].filter(Boolean).join(", ") });
        onSaved(date);
        return;
      }
      setError(res.error ?? null);
      setFieldErrors(res.fieldErrors ?? {});
      if (!res.fieldErrors) toast({ title: res.error ?? "", tone: "danger" });
      bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const fe = fieldErrors;

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetHeader>
        <SheetTitle>{t("title")}</SheetTitle>
        <SheetDescription>{t("description")}</SheetDescription>
      </SheetHeader>

      <SheetBody ref={bodyRef} className="space-y-7 pb-6">
        {error ? (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        ) : null}

        {/* When + who */}
        <div className="grid grid-cols-2 gap-3">
          <Field id="booking-groomer" label={t("groomer")} error={fe.groomerId} className="col-span-2">
            {(p) => (
              <Select {...p} value={groomerId} onChange={(e) => setGroomerId(e.target.value)}>
                {groomers.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="booking-date" label={t("date")} error={fe.date}>
            {(p) => (
              <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            )}
          </Field>
          <Field id="booking-start" label={t("start")} error={fe.startTime}>
            {(p) => (
              <Select
                {...p}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="tabular-nums"
              >
                {(START_TIMES.includes(startTime) ? START_TIMES : [startTime, ...START_TIMES]).map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        {offDay && groomer ? (
          <Alert tone="info" className="-mt-4">
            {t("groomerOffDay", { name: groomer.name })}
          </Alert>
        ) : null}

        <ClientPicker
          client={client}
          onChange={chooseClient}
          errors={{
            client: fe.client,
            fullName: fe["client.fullName"],
            phone: fe["client.phone"],
            email: fe["client.email"],
          }}
        />

        <FormSection title={t("pets")}>
          {fe.items ? (
            <p role="alert" className="text-danger text-sm">
              {fe.items}
            </p>
          ) : null}
          {client.mode === "none" ? <p className="text-muted text-sm">{t("pickClientFirst")}</p> : null}
          <ol className={cn("space-y-4", client.mode === "none" && "hidden")}>
            {items.map((item, index) => {
              const prefix = `items.${index}`;
              const service = services.find((s) => s.id === item.serviceId);
              return (
                <li key={item.key} className="border-border space-y-4 rounded-lg border p-3.5">
                  <div className="-mt-1 -mr-1.5 flex min-h-9 items-center justify-between">
                    <span className="text-sm font-semibold">{t("petN", { n: index + 1 })}</span>
                    {items.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("removePet", { n: index + 1 })}
                        onClick={() => removeItem(item.key)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    ) : null}
                  </div>

                  {client.mode === "existing" ? (
                    <Field id={`item-${item.key}-pet`} label={t("pet")} error={fe[`${prefix}.pet`]}>
                      {(p) => (
                        <Select {...p} value={item.petId} onChange={(e) => onPetChange(item, e.target.value)}>
                          <option value="" disabled>
                            {t("choosePet")}
                          </option>
                          {pets.map((pet) => (
                            <option key={pet.id} value={pet.id}>
                              {pet.name}
                            </option>
                          ))}
                          <option value={NEW_PET}>{t("newPetOption")}</option>
                        </Select>
                      )}
                    </Field>
                  ) : null}

                  {item.petId === NEW_PET ? (
                    <div className="space-y-4">
                      <Field
                        id={`item-${item.key}-pet-name`}
                        label={t("newPetName")}
                        error={fe[`${prefix}.pet.name`] ?? fe[`${prefix}.pet`]}
                      >
                        {(p) => (
                          <Input
                            {...p}
                            value={item.newPetName}
                            onChange={(e) => updateItem(item.key, { newPetName: e.target.value })}
                            autoComplete="off"
                            maxLength={50}
                          />
                        )}
                      </Field>
                      <SpeciesToggle
                        idPrefix={`item-${item.key}-species`}
                        label={tp("species")}
                        value={item.newPetSpecies}
                        onChange={(v) => updateItem(item.key, { newPetSpecies: v })}
                        error={fe[`${prefix}.pet.species`]}
                      />
                    </div>
                  ) : null}

                  <Field
                    id={`item-${item.key}-service`}
                    label={t("service")}
                    error={fe[`${prefix}.serviceId`]}
                  >
                    {(p) => (
                      <Select
                        {...p}
                        value={item.serviceId}
                        onChange={(e) => onServiceChange(item, e.target.value)}
                      >
                        <option value="" disabled>
                          {t("chooseService")}
                        </option>
                        {services.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      id={`item-${item.key}-duration`}
                      label={t("duration")}
                      error={fe[`${prefix}.durationMin`]}
                    >
                      {(p) => (
                        <Select
                          {...p}
                          value={String(item.durationMin)}
                          onChange={(e) => updateItem(item.key, { durationMin: Number(e.target.value) })}
                        >
                          {DURATION_OPTIONS.map((m) => (
                            <option key={m} value={m}>
                              {formatDuration(tu, m)}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                    <Field
                      id={`item-${item.key}-price`}
                      label={t("price")}
                      error={fe[`${prefix}.plannedPrice`]}
                      hint={
                        service && item.priceSource
                          ? item.priceSource === "last"
                            ? t("priceLastTime")
                            : t("priceDefault")
                          : undefined
                      }
                    >
                      {(p) => (
                        <Input
                          {...p}
                          inputMode="decimal"
                          autoComplete="off"
                          value={item.price}
                          onChange={(e) => updateItem(item.key, { price: e.target.value, priceSource: null })}
                          className="tabular-nums"
                        />
                      )}
                    </Field>
                  </div>
                </li>
              );
            })}
          </ol>
          {items.length < 6 && client.mode !== "none" ? (
            <Button type="button" variant="secondary" className="w-full" onClick={addItem}>
              <Plus aria-hidden />
              {t("addPet")}
            </Button>
          ) : null}
        </FormSection>

        <div className="space-y-4">
          <Field
            id="booking-duration"
            label={t("totalDuration")}
            error={fe.durationMin}
            hint={t("endsAt", { time: endMin < 24 * 60 ? minutesToTime(endMin) : "—" })}
          >
            {(p) => (
              <Select
                {...p}
                value={String(totalDuration)}
                onChange={(e) => setDurationMin(Number(e.target.value))}
              >
                {(DURATION_OPTIONS.includes(totalDuration)
                  ? DURATION_OPTIONS
                  : [totalDuration, ...DURATION_OPTIONS]
                ).map((m) => (
                  <option key={m} value={m}>
                    {formatDuration(tu, m)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {outsideHours ? <Alert tone="info">{t("outsideHours")}</Alert> : null}
          <Field id="booking-notes" label={t("notes")} optional={tc("optional")} error={fe.notes}>
            {(p) => (
              <Textarea
                {...p}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("notesPlaceholder")}
                className="min-h-20"
                maxLength={2000}
              />
            )}
          </Field>
        </div>
      </SheetBody>

      <SheetFooter className="items-center">
        <p className="text-muted mr-auto hidden text-sm tabular-nums sm:block">
          {t("total", { price: formatEur(totalPrice) })}
        </p>
        <Button type="submit" size="lg" loading={pending}>
          {pending ? tc("saving") : tc("save")}
        </Button>
      </SheetFooter>
    </form>
  );
}

function ClientPicker({
  client,
  onChange,
  errors,
}: {
  client: ClientState;
  onChange: (c: ClientState) => void;
  errors: { client?: string; fullName?: string; phone?: string; email?: string };
}) {
  const t = useTranslations("booking");
  const tc = useTranslations("common");
  const tcl = useTranslations("clients");
  const [query, setQuery] = React.useState("");
  const debounced = useDebounced(query.trim(), 300);
  const [results, setResults] = React.useState<{ q: string; list: BookingClientOption[] }>({
    q: "",
    list: [],
  });
  const [searching, startSearch] = React.useTransition();

  React.useEffect(() => {
    if (client.mode !== "none" || debounced.length < 2) return;
    let cancelled = false;
    startSearch(async () => {
      const list = await findClientsForBooking(debounced);
      if (!cancelled) setResults({ q: debounced, list });
    });
    return () => {
      cancelled = true;
    };
  }, [debounced, client.mode]);

  if (client.mode === "existing") {
    const c = client.option;
    return (
      <FormSection title={t("client")}>
        <div className="border-border bg-surface-muted/50 flex items-center gap-3 rounded-lg border p-3">
          <Avatar name={c.fullName} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{c.fullName}</p>
            <p className="text-muted truncate text-sm">
              {[c.phoneDisplay, c.pets.map((p) => p.name).join(", ")].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ mode: "none" })}>
            {t("changeClient")}
          </Button>
        </div>
      </FormSection>
    );
  }

  if (client.mode === "new") {
    return (
      <FormSection
        title={t("newClientTitle")}
        action={
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ mode: "none" })}>
            <Search aria-hidden />
            {t("findExisting")}
          </Button>
        }
      >
        <Field id="new-client-name" label={tcl("fullName")} error={errors.fullName}>
          {(p) => (
            <Input
              {...p}
              value={client.fullName}
              onChange={(e) => onChange({ ...client, fullName: e.target.value })}
              placeholder={tcl("fullNamePlaceholder")}
              autoComplete="off"
              autoCapitalize="words"
              maxLength={100}
              autoFocus
            />
          )}
        </Field>
        <Field
          id="new-client-phone"
          label={tcl("phone")}
          hint={tcl("phoneHint")}
          optional={tc("optional")}
          error={errors.phone}
        >
          {(p) => (
            <Input
              {...p}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={client.phone}
              onChange={(e) => onChange({ ...client, phone: e.target.value })}
            />
          )}
        </Field>
        <Field id="new-client-email" label={tcl("email")} optional={tc("optional")} error={errors.email}>
          {(p) => (
            <Input
              {...p}
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              value={client.email}
              onChange={(e) => onChange({ ...client, email: e.target.value })}
            />
          )}
        </Field>
      </FormSection>
    );
  }

  const q = query.trim();
  const showResults = q.length >= 2 && results.q === debounced && debounced === q;
  const looksLikePhone = searchDigits(q).length >= 3 && /^[\d\s+()-]+$/.test(q);

  return (
    <FormSection title={t("client")}>
      <div className="relative">
        <label htmlFor="booking-client-search" className="sr-only">
          {t("client")}
        </label>
        <Search
          aria-hidden
          className="text-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
        />
        <Input
          id="booking-client-search"
          type="search"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("clientSearchPlaceholder")}
          aria-invalid={errors.client ? true : undefined}
          aria-describedby={errors.client ? "booking-client-error" : "booking-client-hint"}
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
      {errors.client ? (
        <p id="booking-client-error" role="alert" className="text-danger -mt-2 text-sm">
          {errors.client}
        </p>
      ) : q.length < 2 ? (
        <p id="booking-client-hint" className="text-muted -mt-2 text-sm">
          {t("clientSearchHint")}
        </p>
      ) : null}

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
                  onClick={() => onChange({ mode: "existing", option: c })}
                  aria-label={t("selectClient", { name: c.fullName })}
                  className="hover:bg-surface-muted flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition-colors"
                >
                  <Avatar name={c.fullName} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.fullName}</span>
                    <span className="text-muted flex items-center gap-2 truncate text-sm">
                      {c.phone ? (
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Phone aria-hidden className="size-3.5" />
                          {c.phoneDisplay}
                        </span>
                      ) : null}
                      {c.pets.map((p) => (
                        <span key={p.id} className="inline-flex items-center gap-1">
                          {p.species === "cat" ? (
                            <Cat aria-hidden className="size-3.5" />
                          ) : (
                            <Dog aria-hidden className="size-3.5" />
                          )}
                          {p.name}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted text-sm" aria-live="polite">
            {t("noClients")}
          </p>
        )
      ) : null}

      <Button
        type="button"
        variant={showResults && results.list.length === 0 ? "primary" : "secondary"}
        className="w-full"
        onClick={() =>
          onChange({
            mode: "new",
            fullName: looksLikePhone ? "" : q,
            phone: looksLikePhone ? q : "",
            email: "",
          })
        }
      >
        <UserPlus aria-hidden />
        {t("newClient")}
      </Button>
    </FormSection>
  );
}

function emptyItem(key: number, client: BookingClientOption | null): ItemState {
  return {
    key,
    petId: defaultPetId(client),
    newPetName: "",
    newPetSpecies: "dog",
    serviceId: "",
    durationMin: 60,
    price: "",
    priceSource: null,
  };
}

/** One pet → pick it; several → let the owner choose; none (or new client) → new pet. */
function defaultPetId(client: BookingClientOption | null): string {
  if (!client) return NEW_PET;
  if (client.pets.length === 1) return client.pets[0].id;
  return client.pets.length === 0 ? NEW_PET : "";
}

function priceText(value: number): string {
  return value.toFixed(2).replace(".", ",");
}
