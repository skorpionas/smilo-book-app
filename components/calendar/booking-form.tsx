"use client";

import { Cat, Copy, Dog, PawPrint, Phone, Plus, Search, Settings, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";
import { SpeciesToggle } from "@/components/clients/pet-sheet";
import { BlockForm, SheetModeSwitch } from "@/components/calendar/block-form";
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
  getClientForBooking,
  getPetForBooking,
  getPricePrefill,
  updateBooking,
  type BookingClientOption,
  type BookingPetOption,
} from "@/lib/actions/bookings";
import { groupItems } from "@/lib/booking-groups";
import type { CalendarBooking, CalendarGroomer, CalendarService } from "@/lib/calendar-data";
import { DURATION_OPTIONS, formatDuration } from "@/lib/format";
import { formatEur, parseEur } from "@/lib/money";
import { splitDuration, splitPrice } from "@/lib/split";
import type { BookingInput } from "@/lib/schemas/booking";
import { searchDigits } from "@/lib/search";
import {
  BOOKING_START_TIMES,
  DAY_CLOSE,
  DAY_OPEN,
  minutesToTime,
  timeToMinutes,
  vilniusClock,
} from "@/lib/clock";
import { cn } from "@/lib/utils";
import { worksOn } from "@/lib/schedule";

export type BookingDefaults = {
  groomerId: string;
  date: string;
  startTime: string;
  client: BookingClientOption | null;
  /** Pre-selected pet of `client` (booking from a pet page). */
  petId?: string | null;
  /** Change this existing visit instead of creating one (client fixed). */
  edit?: CalendarBooking;
};

const START_TIMES = BOOKING_START_TIMES;
const NEW_PET = "__new";
/** Book every active pet of the client together (they always come as a pair / group). */
export const ALL_PETS = "all";

type ItemState = {
  key: number;
  petId: string; // "" | pet uuid | NEW_PET
  newPetName: string;
  newPetSpecies: "dog" | "cat";
  serviceId: string;
  durationMin: number;
  price: string;
  priceSource: "pet" | "last" | "default" | "family" | null;
  /** Save duration + price as this pet's own service (or, shared, as the family's). */
  remember: boolean;
  /**
   * One service for several pets: the pets it covers. Duration and price are then
   * totals for all of them; they are split per pet when saving. null = a normal row.
   */
  sharedPetIds: string[] | null;
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
  // "Vizitas | Nedarbo laikas" (US-16): the same tap on a slot can block the time instead.
  // Remembered per opening: a new tap on the grid starts as a visit again.
  const [picked, setPicked] = React.useState<{ for: BookingDefaults | null; mode: "booking" | "block" }>({
    for: null,
    mode: "booking",
  });
  const mode = picked.for === defaults ? picked.mode : "booking";
  const setMode = (m: "booking" | "block") => setPicked({ for: defaults, mode: m });
  // A booking opened for a chosen client (client / pet page) is always a visit.
  const canBlock = defaults !== null && !defaults.client && !defaults.petId;

  return (
    <Sheet open={defaults !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent aria-describedby={undefined}>
        {defaults ? (
          <>
            {canBlock ? <SheetModeSwitch mode={mode} onChange={setMode} /> : null}
            {canBlock && mode === "block" ? (
              <BlockForm defaults={defaults} groomers={groomers} onSaved={onSaved} />
            ) : services.length === 0 ? (
              <NoServices />
            ) : (
              <BookingForm defaults={defaults} groomers={groomers} services={services} onSaved={onSaved} />
            )}
          </>
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
  onBack,
}: {
  defaults: BookingDefaults;
  groomers: CalendarGroomer[];
  services: CalendarService[];
  onSaved: (date: string) => void;
  /** Editing: back to the booking's details. */
  onBack?: () => void;
}) {
  const edit = defaults.edit;
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
  const [items, setItems] = React.useState<ItemState[]>(() =>
    edit
      ? itemsFromBooking(edit, 2000)
      : (clientItems(defaults.client, defaults.petId, services, 1000) ?? [
          withPetDefaults(emptyItem(0, defaults.client, defaults.petId), defaults.client, services),
        ]),
  );
  // null = sum of items; an edited visit keeps its own length if it differs from the sum
  const [durationMin, setDurationMin] = React.useState<number | null>(() =>
    edit && edit.durationMin !== edit.items.reduce((s, i) => s + i.durationMin, 0) ? edit.durationMin : null,
  );
  const [notes, setNotes] = React.useState(edit?.notes ?? "");
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

  function chooseClient(next: ClientState, petId?: string | null, newPetName?: string) {
    setClient(next);
    setFieldErrors({});
    if (next.mode === "new") {
      // New pet first; its owner's contact is optional (below the pet)
      setItems((prev) =>
        prev.map((item, index) => ({
          ...item,
          petId: NEW_PET,
          newPetName: index === 0 && newPetName !== undefined ? newPetName : item.newPetName,
          priceSource: null,
          remember: false,
        })),
      );
      return;
    }
    const option = next.mode === "existing" ? next.option : null;
    const preset = clientItems(option, petId, services, nextKey.current);
    if (preset) {
      setItems(preset);
      nextKey.current += 6;
      return;
    }
    // Pets belong to one client: reset the pet choice on every client change, then
    // pre-fill the chosen pet's usual service (its own duration and price).
    setItems((prev) =>
      prev.map((item, index) => {
        const chosen = index === 0 ? defaultPetId(option, petId) : option ? "" : NEW_PET;
        const reset = { ...item, petId: chosen, priceSource: null, remember: false };
        return withPetDefaults(reset, option, services, true);
      }),
    );
  }

  function updateItem(key: number, patch: Partial<ItemState>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  async function refreshPrice(key: number, petId: string, serviceId: string) {
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;
    const own = findPet(pets, petId)?.services.find((ps) => ps.serviceId === serviceId);
    if (own) {
      updateItem(key, { durationMin: own.durationMin, price: priceText(own.price), priceSource: "pet" });
      return;
    }
    if (!petId || petId === NEW_PET) {
      updateItem(key, { price: priceText(service.defaultPrice), priceSource: "default" });
      return;
    }
    const prefill = await getPricePrefill(petId, serviceId);
    const value = prefill ?? service.defaultPrice;
    // The answer arrives later: apply it only if the row still has this pet + service
    // and the owner hasn't typed a price meanwhile (typing clears priceSource).
    setItems((prev) =>
      prev.map((i) =>
        i.key === key && i.petId === petId && i.serviceId === serviceId && i.priceSource !== null
          ? {
              ...i,
              price: priceText(value),
              priceSource: prefill !== null && prefill !== service.defaultPrice ? "last" : "default",
            }
          : i,
      ),
    );
  }

  function onPetChange(item: ItemState, petId: string) {
    const pet = findPet(pets, petId);
    if (!item.serviceId && pet?.services[0]) {
      setItems((prev) =>
        prev.map((i) =>
          i.key === item.key
            ? withPetDefaults({ ...i, petId }, client.mode === "existing" ? client.option : null, services)
            : i,
        ),
      );
      return;
    }
    updateItem(item.key, { petId, remember: false });
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
      { ...emptyItem(key, null, null), petId: client.mode === "existing" ? "" : NEW_PET },
    ]);
  }

  /** One tap: another pet of the same client, with its own usual service, time and price. */
  function addPetItem(pet: BookingPetOption) {
    if (client.mode !== "existing") return;
    const key = nextKey.current++;
    const option = client.option;
    setItems((prev) => {
      // Re-use an empty first row instead of adding a second one
      const empty = prev.length === 1 && !prev[0].petId && !prev[0].serviceId;
      const item = withPetDefaults({ ...emptyItem(key, null, null), petId: pet.id }, option, services, true);
      return empty ? [item] : [...prev, item];
    });
  }

  /**
   * Several pets, one service: copy pet 1's service to the others. A pet with its own
   * price for that service keeps it; the others take pet 1's time and price.
   */
  function applyFirstServiceToAll() {
    setItems((prev) => {
      const first = prev[0];
      if (!first?.serviceId) return prev;
      return prev.map((item, index) => {
        if (index === 0) return item;
        const own = findPet(pets, item.petId)?.services.find((ps) => ps.serviceId === first.serviceId);
        return own
          ? {
              ...item,
              serviceId: first.serviceId,
              durationMin: own.durationMin,
              price: priceText(own.price),
              priceSource: "pet",
            }
          : {
              ...item,
              serviceId: first.serviceId,
              durationMin: first.durationMin,
              price: first.price,
              priceSource: null,
            };
      });
    });
  }

  /** Turn the rows into one shared service for several pets (totals, split on save). */
  function makeShared() {
    if (client.mode !== "existing") return;
    const option = client.option;
    const chosen = items.filter((i) => !i.sharedPetIds && i.petId && i.petId !== NEW_PET).map((i) => i.petId);
    const petIds = chosen.length >= 2 ? chosen : option.pets.slice(0, 6).map((p) => p.id);
    const serviceId = items.find((i) => i.serviceId)?.serviceId ?? "";
    const key = nextKey.current++;
    const base: ItemState = { ...emptyItem(key, null, null), petId: "", sharedPetIds: petIds, serviceId };
    const fam = serviceId ? option.familyServices?.find((f) => f.serviceId === serviceId) : undefined;
    const item: ItemState = fam
      ? { ...base, durationMin: fam.durationMin, price: priceText(fam.price), priceSource: "family" }
      : serviceId
        ? {
            ...base,
            durationMin: Math.min(
              600,
              items.reduce((sum, i) => sum + (i.serviceId ? i.durationMin : 0), 0) || 60,
            ),
            price: priceText(items.reduce((sum, i) => sum + (parseEur(i.price) ?? 0), 0)),
            priceSource: null,
          }
        : base;
    setItems([item, ...items.filter((i) => i.petId === NEW_PET && i.newPetName.trim())]);
  }

  /** Back to one row per pet, each with its own usual service and price. */
  function splitShared(key: number) {
    if (client.mode !== "existing") return;
    const option = client.option;
    const shared = items.find((i) => i.key === key);
    if (!shared?.sharedPetIds) return;
    const first = nextKey.current;
    nextKey.current += 6;
    const rows = shared.sharedPetIds.map((petId, i) => {
      const own = option.pets
        .find((p) => p.id === petId)
        ?.services.find((x) => x.serviceId === shared.serviceId);
      const service = services.find((x) => x.id === shared.serviceId);
      const base: ItemState = { ...emptyItem(first + i, null, null), petId, serviceId: shared.serviceId };
      return own
        ? { ...base, durationMin: own.durationMin, price: priceText(own.price), priceSource: "pet" as const }
        : service
          ? {
              ...base,
              durationMin: service.defaultDurationMin,
              price: priceText(service.defaultPrice),
              priceSource: "default" as const,
            }
          : withPetDefaults(base, option, services, true);
    });
    setItems((prev) => prev.flatMap((i) => (i.key === key ? rows : [i])));
  }

  function onSharedServiceChange(item: ItemState, serviceId: string) {
    const service = services.find((x) => x.id === serviceId);
    const count = item.sharedPetIds?.length ?? 1;
    const fam =
      client.mode === "existing"
        ? client.option.familyServices?.find((f) => f.serviceId === serviceId)
        : undefined;
    updateItem(
      item.key,
      fam
        ? {
            serviceId,
            durationMin: fam.durationMin,
            price: priceText(fam.price),
            priceSource: "family",
            remember: false,
          }
        : {
            serviceId,
            durationMin: Math.min(600, (service?.defaultDurationMin ?? 60) * count),
            price: service ? priceText(service.defaultPrice * count) : item.price,
            priceSource: service ? "default" : null,
          },
    );
  }

  function toggleSharedPet(item: ItemState, petId: string) {
    const current = item.sharedPetIds ?? [];
    const next = current.includes(petId) ? current.filter((id) => id !== petId) : [...current, petId];
    updateItem(item.key, { sharedPetIds: next });
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
      // Pet first: the client is optional. An owner-less pet → "none"; a new pet with
      // no contact typed → "none"; any of name / phone / e-mail → a new contact card.
      client:
        client.mode === "existing"
          ? client.option.id
            ? { mode: "existing", id: client.option.id }
            : { mode: "none" }
          : client.mode === "new"
            ? client.fullName.trim() || client.phone.trim() || client.email.trim()
              ? { mode: "new", fullName: client.fullName, phone: client.phone, email: client.email }
              : { mode: "none" }
            : (undefined as unknown as BookingInput["client"]),
      items: expandItems(items),
      rememberFamily: items
        .filter((i) => i.sharedPetIds && i.sharedPetIds.length > 1 && i.remember && i.serviceId)
        .map((i) => ({ serviceId: i.serviceId, durationMin: i.durationMin, price: i.price })),
      notes,
    };

    startTransition(async () => {
      const res = edit
        ? await updateBooking({
            id: edit.id,
            groomerId,
            date,
            startTime,
            durationMin: totalDuration,
            items: input.items,
            rememberFamily: input.rememberFamily,
            notes,
          })
        : await createBooking(input);
      if (res.ok) {
        const petNames = items
          .flatMap((i) =>
            i.sharedPetIds
              ? i.sharedPetIds.map((id) => pets.find((p) => p.id === id)?.name)
              : [i.petId === NEW_PET ? i.newPetName : pets.find((p) => p.id === i.petId)?.name],
          )
          .filter(Boolean)
          .join(", ");
        toast({
          title: edit ? t("changed") : t("saved"),
          description: [res.summary?.range, petNames].filter(Boolean).join(", "),
        });
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
  const pickerErrors = {
    client: fe.client,
    fullName: fe["client.fullName"],
    phone: fe["client.phone"],
    email: fe["client.email"],
  };

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetHeader>
        <SheetTitle>{edit ? t("editTitle") : t("title")}</SheetTitle>
        <SheetDescription className={edit ? "tabular-nums" : undefined}>
          {edit ? `${edit.date} · ${edit.startTime}–${edit.endTime}` : t("description")}
        </SheetDescription>
      </SheetHeader>

      <SheetBody ref={bodyRef} className="space-y-7 pb-6">
        {error ? (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        ) : null}

        {edit?.status === "completed" ? <Alert tone="info">{t("editCompletedNote")}</Alert> : null}

        {/* When + who (a completed visit keeps its time) */}
        <div className={cn("grid grid-cols-2 gap-3", edit?.status === "completed" && "hidden")}>
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
              <Input
                {...p}
                type="date"
                min={edit && edit.date < vilniusClock().date ? edit.date : vilniusClock().date}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
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

        {client.mode !== "new" ? (
          <ClientPicker
            client={client}
            onChange={chooseClient}
            errors={pickerErrors}
            locked={Boolean(edit)}
          />
        ) : null}

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
              if (item.sharedPetIds) {
                return (
                  <SharedItemRow
                    key={item.key}
                    item={item}
                    pets={pets}
                    services={services}
                    errors={fe}
                    canRemove={items.length > 1}
                    onRemove={() => removeItem(item.key)}
                    onSplit={() => splitShared(item.key)}
                    onTogglePet={(petId) => toggleSharedPet(item, petId)}
                    onService={(serviceId) => onSharedServiceChange(item, serviceId)}
                    onChange={(patch) => updateItem(item.key, patch)}
                  />
                );
              }
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
                          onChange={(e) =>
                            updateItem(item.key, {
                              durationMin: Number(e.target.value),
                              priceSource: item.priceSource === "pet" ? null : item.priceSource,
                            })
                          }
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
                          ? item.priceSource === "pet"
                            ? t("pricePet")
                            : item.priceSource === "last"
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
                  {service && item.petId && item.priceSource !== "pet" ? (
                    <label
                      htmlFor={`item-${item.key}-remember`}
                      className="-my-1 flex min-h-11 cursor-pointer items-center gap-3 text-sm"
                    >
                      <input
                        id={`item-${item.key}-remember`}
                        type="checkbox"
                        checked={item.remember}
                        onChange={(e) => updateItem(item.key, { remember: e.target.checked })}
                        className="accent-primary size-5 shrink-0"
                      />
                      <span>
                        {t("rememberForPet", {
                          name:
                            (item.petId === NEW_PET ? item.newPetName : findPet(pets, item.petId)?.name) ||
                            t("thisPet"),
                        })}
                      </span>
                    </label>
                  ) : null}
                </li>
              );
            })}
          </ol>
          {items.length > 1 &&
          !items.some((i) => i.sharedPetIds) &&
          items[0].serviceId &&
          items.slice(1).some((i) => i.serviceId !== items[0].serviceId) ? (
            <Button type="button" variant="soft" className="w-full" onClick={applyFirstServiceToAll}>
              <Copy aria-hidden />
              {t("applyToAll", { service: services.find((x) => x.id === items[0].serviceId)?.name ?? "" })}
            </Button>
          ) : null}
          {client.mode === "existing" && pets.length > 1 && !items.some((i) => i.sharedPetIds) ? (
            <Button type="button" variant="soft" className="w-full" onClick={makeShared}>
              <PawPrint aria-hidden />
              {t("oneServiceForAll")}
            </Button>
          ) : null}
          {items.length < 6 && client.mode === "existing" ? (
            <QuickAddPets
              pets={pets.filter(
                (p) => !items.some((i) => i.petId === p.id || i.sharedPetIds?.includes(p.id)),
              )}
              onAdd={addPetItem}
            />
          ) : null}
          {items.length < 6 && client.mode !== "none" ? (
            <Button type="button" variant="secondary" className="w-full" onClick={addItem}>
              <Plus aria-hidden />
              {t("addPet")}
            </Button>
          ) : null}
        </FormSection>

        {client.mode === "new" ? (
          <ClientPicker client={client} onChange={chooseClient} errors={pickerErrors} />
        ) : null}

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
        {onBack ? (
          <Button type="button" variant="secondary" size="lg" onClick={onBack} disabled={pending}>
            {t("back")}
          </Button>
        ) : null}
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
  locked = false,
}: {
  client: ClientState;
  onChange: (c: ClientState, petId?: string | null, newPetName?: string) => void;
  errors: { client?: string; fullName?: string; phone?: string; email?: string };
  /** The client of an existing visit cannot be changed. */
  locked?: boolean;
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
          {c.id ? (
            <Avatar name={c.fullName} />
          ) : (
            <Avatar
              name={c.pets[0]?.name ?? ""}
              icon={<SpeciesIcon species={c.pets[0]?.species ?? "dog"} />}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{c.id ? c.fullName : t("noOwner")}</p>
            <p className="text-muted flex flex-wrap items-center gap-x-2 text-sm">
              {c.phoneDisplay ? <span className="tabular-nums">{c.phoneDisplay}</span> : null}
              {c.pets.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1">
                  <SpeciesIcon species={p.species} className="size-3.5" />
                  {p.name}
                </span>
              ))}
            </p>
          </div>
          {locked ? null : (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ mode: "none" })}>
              {t("changeClient")}
            </Button>
          )}
        </div>
      </FormSection>
    );
  }

  if (client.mode === "new") {
    return (
      <FormSection
        title={`${t("ownerContact")} (${tc("optional")})`}
        action={
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ mode: "none" })}>
            <Search aria-hidden />
            {t("findExisting")}
          </Button>
        }
      >
        <p className="text-muted -mt-2 text-sm">{t("ownerContactHint")}</p>
        <Field id="new-client-name" label={tcl("fullName")} optional={tc("optional")} error={errors.fullName}>
          {(p) => (
            <Input
              {...p}
              value={client.fullName}
              onChange={(e) => onChange({ ...client, fullName: e.target.value })}
              placeholder={tcl("fullNamePlaceholder")}
              autoComplete="off"
              autoCapitalize="words"
              maxLength={100}
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
            {pickRows(results.list).map(({ client: c, pet, all }) =>
              all ? (
                <li key={`${c.id}-all`}>
                  <button
                    type="button"
                    onClick={() => onChange({ mode: "existing", option: c }, ALL_PETS)}
                    aria-label={t("selectAllPets", {
                      pets: c.pets.map((p) => p.name).join(", "),
                      client: c.fullName,
                    })}
                    className="hover:bg-surface-muted flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition-colors"
                  >
                    <Avatar name={c.fullName} size="sm" icon={<PawPrint aria-hidden />} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {t("allPetsTogether", { pets: c.pets.map((p) => p.name).join(" + ") })}
                      </span>
                      <span className="text-muted block truncate text-sm">{c.fullName}</span>
                    </span>
                  </button>
                </li>
              ) : (
                <li key={pet ? pet.id : c.id}>
                  <button
                    type="button"
                    onClick={() => onChange({ mode: "existing", option: c }, pet?.id ?? null)}
                    aria-label={
                      pet
                        ? t("selectPet", { pet: pet.name, client: c.fullName })
                        : t("selectClient", { name: c.fullName })
                    }
                    className="hover:bg-surface-muted flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition-colors"
                  >
                    {pet ? (
                      <Avatar name={pet.name} size="sm" icon={<SpeciesIcon species={pet.species} />} />
                    ) : (
                      <Avatar name={c.fullName} size="sm" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {pet ? pet.name : c.fullName}
                        {pet?.breed ? <span className="text-muted font-normal"> · {pet.breed}</span> : null}
                      </span>
                      <span className="text-muted flex items-center gap-2 truncate text-sm">
                        {pet ? <span className="truncate">{c.fullName}</span> : null}
                        {c.phone ? (
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Phone aria-hidden className="size-3.5" />
                            {c.phoneDisplay}
                          </span>
                        ) : null}
                        {!pet ? <span>{tcl("noPetsShort")}</span> : null}
                      </span>
                    </span>
                  </button>
                </li>
              ),
            )}
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
          // Pet first: typed text becomes the new pet's name (or the owner's phone)
          onChange(
            { mode: "new", fullName: "", phone: looksLikePhone ? q : "", email: "" },
            null,
            looksLikePhone ? "" : q,
          )
        }
      >
        <Plus aria-hidden />
        {t("newPet")}
      </Button>
    </FormSection>
  );
}

function emptyItem(key: number, client: BookingClientOption | null, petId?: string | null): ItemState {
  return {
    key,
    petId: defaultPetId(client, petId),
    newPetName: "",
    newPetSpecies: "dog",
    serviceId: "",
    durationMin: 60,
    price: "",
    priceSource: null,
    remember: false,
    sharedPetIds: null,
  };
}

/** Requested pet if it belongs to the client; one pet → pick it; several → let the owner choose; none → new pet. */
function defaultPetId(client: BookingClientOption | null, petId?: string | null): string {
  if (!client) return NEW_PET;
  if (petId && client.pets.some((p) => p.id === petId)) return petId;
  if (client.pets.length === 1) return client.pets[0].id;
  return client.pets.length === 0 ? NEW_PET : "";
}

function priceText(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function findPet(pets: BookingPetOption[], petId: string): BookingPetOption | undefined {
  return petId && petId !== NEW_PET ? pets.find((p) => p.id === petId) : undefined;
}

/**
 * Pre-fill an item from the pet's usual service (its first own service): service,
 * duration and price in one go. With `force`, replaces a service chosen earlier
 * (the pet changed); otherwise keeps it.
 */
function withPetDefaults(
  item: ItemState,
  client: BookingClientOption | null,
  services: { id: string }[],
  force = false,
): ItemState {
  const pet = client ? findPet(client.pets, item.petId) : undefined;
  if (!pet) return item;
  const own =
    (item.serviceId && pet.services.find((ps) => ps.serviceId === item.serviceId)) ||
    (force || !item.serviceId
      ? pet.services.find((ps) => services.some((s) => s.id === ps.serviceId))
      : undefined);
  if (!own) return item;
  return {
    ...item,
    serviceId: own.serviceId,
    durationMin: own.durationMin,
    price: priceText(own.price),
    priceSource: "pet",
  };
}

type PickRow = { client: BookingClientOption; pet: BookingPetOption | null; all?: boolean };

/**
 * Picker rows, pet first: matched pets, then the client's other pets; clients without
 * pets as one row. A client with 2+ pets also gets "Maksas + Žuikis" — pets that always
 * come together are booked in one tap.
 */
export function pickRows(list: BookingClientOption[]): PickRow[] {
  const rows: PickRow[] = [];
  for (const c of list) {
    if (c.pets.length === 0) {
      rows.push({ client: c, pet: null });
      continue;
    }
    const matched = new Set(c.matchedPetIds ?? []);
    const ordered = [...c.pets.filter((p) => matched.has(p.id)), ...c.pets.filter((p) => !matched.has(p.id))];
    for (const pet of ordered) rows.push({ client: c, pet });
    if (c.pets.length > 1) rows.push({ client: c, pet: null, all: true });
  }
  // Matched pets first, each client's "together" row right after them
  const first = rows.filter(
    (r) =>
      (r.pet && r.client.matchedPetIds?.includes(r.pet.id)) ||
      (r.all && (r.client.matchedPetIds?.length ?? 0) > 0),
  );
  return [...first, ...rows.filter((r) => !first.includes(r))];
}

/** One item per pet of the client (max 6), each with its own usual service, time and price. */
function familyItems(client: BookingClientOption, services: { id: string }[], firstKey: number): ItemState[] {
  return client.pets
    .slice(0, 6)
    .map((pet, i) =>
      withPetDefaults({ ...emptyItem(firstKey + i, null, null), petId: pet.id }, client, services, true),
    );
}

function QuickAddPets({ pets, onAdd }: { pets: BookingPetOption[]; onAdd: (pet: BookingPetOption) => void }) {
  const t = useTranslations("booking");
  if (pets.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t("quickAddLabel")}>
      {pets.map((pet) => (
        <Button key={pet.id} type="button" variant="soft" size="sm" onClick={() => onAdd(pet)}>
          <Plus aria-hidden />
          <SpeciesIcon species={pet.species} />
          {t("addNamedPet", { name: pet.name })}
        </Button>
      ))}
    </div>
  );
}

function SpeciesIcon({ species, className }: { species: "dog" | "cat"; className?: string }) {
  return species === "cat" ? (
    <Cat aria-hidden className={className} />
  ) : (
    <Dog aria-hidden className={className} />
  );
}

/**
 * Rows to start with when a client is chosen. A client with several pets and a usual
 * shared service gets that one row (also when no pet was asked for, e.g. "Registruoti
 * vizitą" on the client page); "all pets" without one gets a row per pet. null = the
 * usual single row.
 */
function clientItems(
  client: BookingClientOption | null | undefined,
  petId: string | null | undefined,
  services: { id: string }[],
  firstKey: number,
): ItemState[] | null {
  if (!client) return null;
  const wantsAll = petId === ALL_PETS || !petId;
  if (wantsAll && client.pets.length > 1 && familyServiceFor(client, services)) {
    return [sharedItem(firstKey, client, services)];
  }
  if (petId === ALL_PETS && client.pets.length > 0) return familyItems(client, services, firstKey);
  return null;
}

/** The client's usual shared service, if it is still offered. */
function familyServiceFor(client: BookingClientOption, services: { id: string }[]) {
  return client.familyServices?.find((f) => services.some((x) => x.id === f.serviceId));
}

/** One row for all of the client's pets with the family's usual shared service. */
function sharedItem(key: number, client: BookingClientOption, services: { id: string }[]): ItemState {
  const fam = familyServiceFor(client, services);
  return {
    ...emptyItem(key, null, null),
    petId: "",
    sharedPetIds: client.pets.slice(0, 6).map((p) => p.id),
    serviceId: fam?.serviceId ?? "",
    durationMin: fam?.durationMin ?? 60,
    price: fam ? priceText(fam.price) : "",
    priceSource: fam ? "family" : null,
  };
}

/**
 * Rows → what the server stores: one row per pet. A shared row becomes one row per
 * pet with the total time and price split (remainder on the first pet) and a common
 * sharedGroup number, so it can be shown as one line again.
 */
function expandItems(items: ItemState[]): BookingInput["items"] {
  let group = 0;
  return items.flatMap((i): BookingInput["items"] => {
    if (i.sharedPetIds && i.sharedPetIds.length > 0) {
      const ids = i.sharedPetIds;
      const total = parseEur(i.price);
      const prices: (number | string)[] =
        total === null ? ids.map(() => i.price) : splitPrice(total, ids.length);
      const minutes = splitDuration(i.durationMin, ids.length);
      const sharedGroup = ids.length > 1 ? ++group : undefined;
      return ids.map((id, n) => ({
        pet: { mode: "existing" as const, id },
        serviceId: i.serviceId,
        durationMin: minutes[n],
        plannedPrice: prices[n],
        remember: false,
        sharedGroup,
      }));
    }
    return [
      {
        pet:
          i.petId === NEW_PET
            ? { mode: "new" as const, name: i.newPetName, species: i.newPetSpecies, breed: "" }
            : i.petId
              ? { mode: "existing" as const, id: i.petId }
              : (undefined as unknown as BookingInput["items"][number]["pet"]),
        serviceId: i.serviceId,
        durationMin: i.durationMin,
        plannedPrice: i.price,
        remember: i.remember,
      },
    ];
  });
}

/** One service for several pets: pet chips, service, total time and total price. */
function SharedItemRow({
  item,
  pets,
  services,
  errors,
  canRemove,
  onRemove,
  onSplit,
  onTogglePet,
  onService,
  onChange,
}: {
  item: ItemState;
  pets: BookingPetOption[];
  services: { id: string; name: string }[];
  errors: Record<string, string>;
  canRemove: boolean;
  onRemove: () => void;
  onSplit: () => void;
  onTogglePet: (petId: string) => void;
  onService: (serviceId: string) => void;
  onChange: (patch: Partial<ItemState>) => void;
}) {
  const t = useTranslations("booking");
  const tu = useTranslations("units");
  const chosen = item.sharedPetIds ?? [];
  const names = pets.filter((p) => chosen.includes(p.id)).map((p) => p.name);
  const total = parseEur(item.price);
  const split =
    total !== null && chosen.length > 1 ? splitPrice(total, chosen.length).map(formatEur).join(" + ") : null;
  // The expanded rows all carry the same values: show the first error of any of them
  const err = (field: string) =>
    Object.entries(errors).find(([k]) => k.startsWith("items.") && k.endsWith(`.${field}`))?.[1];

  return (
    <li className="border-primary/40 bg-primary-soft/20 space-y-4 rounded-lg border p-3.5">
      <div className="-mt-1 -mr-1.5 flex min-h-9 items-center justify-between gap-2">
        <span className="text-sm font-semibold">{t("sharedTitle")}</span>
        <span className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onSplit}>
            {t("splitPerPet")}
          </Button>
          {canRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("removeShared")}
              onClick={onRemove}
            >
              <Trash2 aria-hidden />
            </Button>
          ) : null}
        </span>
      </div>

      <div role="group" aria-label={t("sharedPets")} className="flex flex-wrap gap-2">
        {pets.map((pet) => {
          const on = chosen.includes(pet.id);
          return (
            <button
              key={pet.id}
              type="button"
              aria-pressed={on}
              onClick={() => onTogglePet(pet.id)}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-foreground-soft hover:bg-surface-muted",
              )}
            >
              <SpeciesIcon species={pet.species} className="size-4" />
              {pet.name}
            </button>
          );
        })}
      </div>
      {chosen.length < 2 ? <p className="text-danger -mt-2 text-sm">{t("sharedNeedsTwo")}</p> : null}

      <Field id={`shared-${item.key}-service`} label={t("service")} error={err("serviceId")}>
        {(p) => (
          <Select {...p} value={item.serviceId} onChange={(e) => onService(e.target.value)}>
            <option value="" disabled>
              {t("chooseService")}
            </option>
            {services.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id={`shared-${item.key}-duration`} label={t("sharedDuration")} error={err("durationMin")}>
          {(p) => (
            <Select
              {...p}
              value={String(item.durationMin)}
              onChange={(e) =>
                onChange({
                  durationMin: Number(e.target.value),
                  priceSource: item.priceSource === "family" ? null : item.priceSource,
                })
              }
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
          id={`shared-${item.key}-price`}
          label={t("sharedPrice")}
          error={err("plannedPrice")}
          hint={
            item.priceSource === "family"
              ? t("priceFamily")
              : split
                ? t("splitAs", { parts: split })
                : undefined
          }
        >
          {(p) => (
            <Input
              {...p}
              inputMode="decimal"
              autoComplete="off"
              value={item.price}
              onChange={(e) => onChange({ price: e.target.value, priceSource: null })}
              className="tabular-nums"
            />
          )}
        </Field>
      </div>

      {item.serviceId && chosen.length > 1 && item.priceSource !== "family" ? (
        <label
          htmlFor={`shared-${item.key}-remember`}
          className="-my-1 flex min-h-11 cursor-pointer items-center gap-3 text-sm"
        >
          <input
            id={`shared-${item.key}-remember`}
            type="checkbox"
            checked={item.remember}
            onChange={(e) => onChange({ remember: e.target.checked })}
            className="accent-primary size-5 shrink-0"
          />
          <span>{t("rememberFamily", { names: names.join(", ") })}</span>
        </label>
      ) : null}
    </li>
  );
}

/**
 * An existing visit as form rows: a shared group → one shared row with its totals;
 * other items → one row each. Prices are what was charged (actual) or planned.
 */
function itemsFromBooking(booking: CalendarBooking, firstKey: number): ItemState[] {
  return groupItems(booking.items).map((group, n) => {
    const first = group[0];
    const price = group.reduce((sum, i) => sum + (i.actualPrice ?? i.plannedPrice), 0);
    return {
      ...emptyItem(firstKey + n, null, null),
      petId: group.length > 1 ? "" : first.petId,
      sharedPetIds: group.length > 1 ? group.map((i) => i.petId) : null,
      serviceId: first.serviceId,
      durationMin: group.reduce((sum, i) => sum + i.durationMin, 0),
      price: priceText(price),
    };
  });
}

/**
 * "Keisti paslaugas" on a booking's details: loads the client's pets and usual
 * services, then the booking form with the visit's rows. Pets or services archived
 * since the booking was made stay selectable for it.
 */
export function BookingEditForm({
  booking,
  groomers,
  services,
  onBack,
  onSaved,
}: {
  booking: CalendarBooking;
  groomers: CalendarGroomer[];
  services: CalendarService[];
  onBack: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("booking");
  const [client, setClient] = React.useState<BookingClientOption | null | undefined>(undefined);

  React.useEffect(() => {
    let cancelled = false;
    const load = booking.client
      ? getClientForBooking(booking.client.id)
      : booking.items[0]?.petId
        ? getPetForBooking(booking.items[0].petId)
        : Promise.resolve(null);
    void load.then((c) => {
      if (!cancelled) setClient(c);
    });
    return () => {
      cancelled = true;
    };
  }, [booking]);

  if (client === undefined) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>{t("editTitle")}</SheetTitle>
        </SheetHeader>
        <SheetBody className="flex items-center justify-center py-12">
          <Spinner />
        </SheetBody>
      </>
    );
  }

  const option = withBookingPets(client, booking);
  const options = [
    ...services,
    ...booking.items
      .filter((i) => i.serviceId && !services.some((s) => s.id === i.serviceId))
      .filter((i, n, all) => all.findIndex((x) => x.serviceId === i.serviceId) === n)
      .map((i) => ({
        id: i.serviceId,
        name: i.serviceName,
        defaultDurationMin: i.durationMin,
        defaultPrice: i.plannedPrice,
      })),
  ];

  return (
    <BookingForm
      defaults={{
        groomerId: booking.groomerId,
        date: booking.date,
        startTime: booking.startTime,
        client: option,
        edit: booking,
      }}
      groomers={
        groomers.some((g) => g.id === booking.groomerId)
          ? groomers
          : [{ id: booking.groomerId, name: "—", color: "#64748b", workDays: [] }, ...groomers]
      }
      services={options}
      onBack={onBack}
      onSaved={() => onSaved()}
    />
  );
}

/** The client option plus any pet of the booking that is no longer listed (archived). */
function withBookingPets(client: BookingClientOption | null, booking: CalendarBooking): BookingClientOption {
  const base: BookingClientOption = client ?? {
    id: booking.client?.id ?? null,
    fullName: booking.client?.fullName ?? "",
    phone: booking.client?.phone ?? null,
    phoneDisplay: booking.client?.phoneDisplay ?? "",
    pets: [],
  };
  const missing = booking.items
    .filter((i) => i.petId && !base.pets.some((p) => p.id === i.petId))
    .filter((i, n, all) => all.findIndex((x) => x.petId === i.petId) === n)
    .map((i): BookingPetOption => ({
      id: i.petId,
      name: i.petName,
      species: i.species,
      breed: "",
      services: [],
    }));
  return missing.length > 0 ? { ...base, pets: [...base.pets, ...missing] } : base;
}
