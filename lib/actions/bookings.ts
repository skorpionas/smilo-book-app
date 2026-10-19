"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { dbFailed, validationFailed, type ActionState } from "@/lib/action-helpers";
import { requireUser } from "@/lib/auth";
import {
  blockSchema,
  bookingSchema,
  completeVisitSchema,
  rescheduleSchema,
  updateBookingSchema,
  type BlockInput,
  type BookingInput,
  type CompleteVisitInput,
  type RescheduleInput,
  type UpdateBookingInput,
} from "@/lib/schemas/booking";
import { uuid } from "@/lib/schemas/common";
import { contactLabel, formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { todayInVilnius, toVilniusDate, toVilniusTime, vilniusToUtc } from "@/lib/time";

/** A pet's own duration + price for one service; the first one is the pet's usual service. */
export type PetServiceOption = { serviceId: string; durationMin: number; price: number };

export type BookingPetOption = {
  id: string;
  name: string;
  species: "dog" | "cat";
  breed: string;
  services: PetServiceOption[];
};

/**
 * A client with its pets — or, for a pet without an owner (pet first), `id: null`
 * with just that one pet. `fullName` is the display label (name, else phone / e-mail).
 */
export type BookingClientOption = {
  id: string | null;
  fullName: string;
  phone: string | null;
  phoneDisplay: string;
  pets: BookingPetOption[];
  /** Pets whose name matched the search (shown first in the picker). */
  matchedPetIds?: string[];
  /** The family's shared services (totals for all pets together); first = usual. */
  familyServices?: PetServiceOption[];
};

/** Client picker in the booking sheet (US-05): name, pet name or phone digits; ≥ 2 characters. */
export async function findClientsForBooking(query: string): Promise<BookingClientOption[]> {
  await requireUser();
  const q = String(query ?? "")
    .trim()
    .slice(0, 100);
  if (q.length < 2) return [];

  const supabase = await createClient();
  const { data: hits, error } = await supabase.rpc("search_directory", { p_query: q, p_limit: 30 });
  if (error) {
    console.error("[action] findClientsForBooking failed", { code: error.code });
    return [];
  }
  const ids = [...new Set(hits.map((h) => h.client_id).filter((id): id is string => Boolean(id)))].slice(
    0,
    10,
  );
  const orphanIds = hits
    .filter((h) => h.kind === "pet" && !h.client_id)
    .map((h) => h.id)
    .slice(0, 10);
  const matched = new Set(hits.filter((h) => h.kind === "pet").map((h) => h.id));
  const [options, orphans] = await Promise.all([loadClientOptions(ids), loadOwnerlessPets(orphanIds)]);
  return [
    ...orphans.map((o) => ({ ...o, matchedPetIds: o.pets.map((p) => p.id) })),
    ...options.map((o) => ({
      ...o,
      matchedPetIds: o.pets.filter((p) => matched.has(p.id)).map((p) => p.id),
    })),
  ];
}

/** A pet for the booking sheet (from a pet page): its owner with all pets, or the pet alone. */
export async function getPetForBooking(petId: string): Promise<BookingClientOption | null> {
  await requireUser();
  if (!uuid.safeParse(petId).success) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("pets").select("client_id").eq("id", petId).maybeSingle();
  if (!data) return null;
  if (data.client_id) return (await loadClientOptions([data.client_id]))[0] ?? null;
  return (await loadOwnerlessPets([petId]))[0] ?? null;
}

const PET_FIELDS =
  "id, name, species, breed, archived_at, pet_services(service_id, duration_min, price, position, created_at, services(archived_at))";

type PetRow = {
  id: string;
  name: string;
  species: "dog" | "cat";
  breed: string;
  archived_at: string | null;
  pet_services: {
    service_id: string;
    duration_min: number;
    price: number;
    position: number;
    created_at: string;
    services: { archived_at: string | null } | null;
  }[];
};

function toPetOption(p: PetRow): BookingPetOption {
  return {
    id: p.id,
    name: p.name,
    species: p.species,
    breed: p.breed,
    services: [...p.pet_services]
      .filter((ps) => !ps.services?.archived_at)
      .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
      .map((ps) => ({ serviceId: ps.service_id, durationMin: ps.duration_min, price: Number(ps.price) })),
  };
}

/** Pets without an owner, each as its own option (id null). */
async function loadOwnerlessPets(ids: string[]): Promise<BookingClientOption[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pets")
    .select(PET_FIELDS)
    .in("id", ids)
    .is("client_id", null)
    .is("archived_at", null)
    .order("name");
  if (error) {
    console.error("[action] loadOwnerlessPets failed", { code: error.code });
    return [];
  }
  return (data as PetRow[]).map((p) => ({
    id: null,
    fullName: "",
    phone: null,
    phoneDisplay: "",
    pets: [toPetOption(p)],
  }));
}

/** One client with active pets, for opening the sheet from a client page. */
export async function getClientForBooking(id: string): Promise<BookingClientOption | null> {
  await requireUser();
  if (!uuid.safeParse(id).success) return null;
  const [client] = await loadClientOptions([id]);
  return client ?? null;
}

async function loadClientOptions(ids: string[]): Promise<BookingClientOption[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, full_name, phone_e164, email, pets(id, name, species, breed, archived_at, pet_services(service_id, duration_min, price, position, created_at, services(archived_at))), client_services(service_id, duration_min, price, position, created_at, services(archived_at))",
    )
    .in("id", ids)
    .is("archived_at", null)
    .is("anonymized_at", null)
    .order("full_name");
  if (error) {
    console.error("[action] loadClientOptions failed", { code: error.code });
    return [];
  }
  return data.map((c) => ({
    id: c.id,
    fullName: contactLabel(c),
    phone: c.phone_e164,
    phoneDisplay: formatPhone(c.phone_e164),
    pets: (c.pets as PetRow[])
      .filter((p) => !p.archived_at)
      .sort((a, b) => a.name.localeCompare(b.name, "lt"))
      .map(toPetOption),
    familyServices: [...c.client_services]
      .filter((cs) => !cs.services?.archived_at)
      .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
      .map((cs) => ({ serviceId: cs.service_id, durationMin: cs.duration_min, price: Number(cs.price) })),
  }));
}

/** US-08: last completed actual price for this pet + service, else the service default. */
export async function getPricePrefill(petId: string, serviceId: string): Promise<number | null> {
  await requireUser();
  if (!uuid.safeParse(petId).success || !uuid.safeParse(serviceId).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_price_prefill", {
    p_pet_id: petId,
    p_service_id: serviceId,
  });
  if (error) return null;
  return data === null ? null : Number(data);
}

export type CreateBookingResult = ActionState & {
  summary?: { range: string };
  /**
   * The time is taken by other visits only (not blocked time): the owner may confirm
   * and save it again with `allowOverlap: true`. Lines like "10:00–12:00 · Maksas".
   */
  overlap?: { visits: string[] };
};

/** US-05/06/07/09: create client (optional) + new pets + booking + items in one transaction. */
export async function createBooking(input: BookingInput): Promise<CreateBookingResult> {
  await requireUser();
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error.issues);

  const b = parsed.data;
  const start = vilniusToUtc(b.date, b.startTime);
  const end = new Date(start.getTime() + b.durationMin * 60_000);

  const items = toRpcItems(b.items);

  const supabase = await createClient();
  const { data: bookingId, error } = await supabase.rpc("create_booking_with_items", {
    p_groomer_id: b.groomerId,
    p_start_at: start.toISOString(),
    p_end_at: end.toISOString(),
    p_items: items,
    // "none": no client — the database takes the owner of an existing pet, if it has one
    p_client_id: b.client.mode === "existing" ? b.client.id : undefined,
    p_new_client:
      b.client.mode === "new"
        ? { full_name: b.client.fullName, phone_e164: b.client.phone ?? "", email: b.client.email ?? "" }
        : undefined,
    p_notes: b.notes,
    // Sent only when confirmed: an ordinary save still matches the function before the
    // overlap migration is approved on production.
    ...(b.allowOverlap ? { p_allow_overlap: true } : {}),
  });

  if (error) {
    const t = await getTranslations("errors");
    if (error.code === "23P01") {
      return conflictResult({ groomerId: b.groomerId, start, end, confirmed: b.allowOverlap });
    }
    if (error.code === "23505") {
      return { ok: false, error: t("checkFields"), fieldErrors: { "client.phone": t("phoneTaken") } };
    }
    return dbFailed(error, "createBooking");
  }

  if (b.client.mode === "existing") await rememberFamily(b.client.id, b.rememberFamily);

  revalidatePath("/calendar", "layout");
  revalidatePath("/upcoming");
  revalidatePath("/clients", "layout");
  revalidatePath("/pets", "layout");
  const range = `${toVilniusTime(start)}–${toVilniusTime(end)}`;
  return { ok: true, savedAt: Date.now(), id: bookingId, summary: { range } };
}

type ParsedItems = ReturnType<typeof bookingSchema.parse>["items"];

/** Booking rows as the database functions take them. */
function toRpcItems(items: ParsedItems) {
  return items.map((item) => ({
    pet_id: item.pet.mode === "existing" ? item.pet.id : null,
    new_pet:
      item.pet.mode === "new"
        ? { name: item.pet.name, species: item.pet.species, breed: item.pet.breed }
        : null,
    service_id: item.serviceId,
    duration_min: item.durationMin,
    planned_price: item.plannedPrice,
    remember: item.remember,
    shared_group: item.sharedGroup ?? null,
  }));
}

/** "Įsiminti kaip šeimos paslaugą": the shared totals become the family's usual price. */
async function rememberFamily(
  clientId: string,
  list: { serviceId: string; durationMin: number; price: number }[],
) {
  if (list.length === 0) return;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("client_services")
    .select("id, service_id")
    .eq("client_id", clientId);
  for (const f of list) {
    const same = existing?.find((r) => r.service_id === f.serviceId);
    const { error: e } = same
      ? await supabase
          .from("client_services")
          .update({ duration_min: f.durationMin, price: f.price })
          .eq("id", same.id)
      : await supabase.from("client_services").insert({
          client_id: clientId,
          service_id: f.serviceId,
          duration_min: f.durationMin,
          price: f.price,
          position: existing?.length ?? 0,
        });
    // The booking is saved either way; a failed "remember" is only logged.
    if (e) console.error("[action] rememberFamily failed", { code: e.code });
  }
  revalidatePath(`/clients/${clientId}`);
}

/**
 * Change a scheduled or completed visit (owner feedback 2026-10-19): its services
 * (another service or price, one pet ↔ several, shared ↔ per pet), groomer, time and
 * notes — one transaction. The client stays. A completed visit stays completed with
 * the new prices as its actual prices. Moving to a past day is not allowed.
 */
export async function updateBooking(input: UpdateBookingInput): Promise<CreateBookingResult> {
  await requireUser();
  const parsed = updateBookingSchema.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error.issues);

  const b = parsed.data;
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("bookings")
    .select("*") // "*": also works before the overlap_ok migration is applied
    .eq("id", b.id)
    .maybeSingle();
  if (!current) return dbFailed({ code: "P0002" }, "updateBooking");
  if (b.date !== toVilniusDate(current.start_at) && b.date < todayInVilnius()) {
    return validationFailed([{ code: "custom", message: "pastDate", path: ["date"], input: b.date }]);
  }

  const start = vilniusToUtc(b.date, b.startTime);
  const end = new Date(start.getTime() + b.durationMin * 60_000);
  // Only the services changed: a visit already confirmed on top of another stays so.
  const samePlace =
    b.groomerId === current.groomer_id &&
    start.getTime() === new Date(current.start_at).getTime() &&
    end.getTime() === new Date(current.end_at).getTime();
  const allowOverlap = b.allowOverlap || (samePlace && current.overlap_ok === true);
  const { error } = await supabase.rpc("update_booking_with_items", {
    p_booking_id: b.id,
    p_groomer_id: b.groomerId,
    p_start_at: start.toISOString(),
    p_end_at: end.toISOString(),
    p_items: toRpcItems(b.items),
    p_notes: b.notes,
    ...(allowOverlap ? { p_allow_overlap: true } : {}),
  });

  if (error) {
    if (error.code === "23P01") {
      return conflictResult({ groomerId: b.groomerId, start, end, excludeId: b.id, confirmed: allowOverlap });
    }
    return dbFailed(error, "updateBooking");
  }

  if (current.client_id) await rememberFamily(current.client_id, b.rememberFamily);

  revalidatePath("/calendar", "layout");
  revalidatePath("/upcoming");
  if (current.client_id) revalidatePath(`/clients/${current.client_id}`);
  revalidatePath("/pets", "layout");
  const range = `${toVilniusTime(start)}–${toVilniusTime(end)}`;
  return { ok: true, savedAt: Date.now(), id: b.id, summary: { range } };
}

/**
 * US-16: blocked time for one or more groomers (break, holiday, sick day). One row per
 * groomer in a single insert, so it is all or nothing; the exclusion constraint stops it
 * from overlapping a booking or another block, and later bookings from overlapping it.
 */
export async function createBlock(input: BlockInput): Promise<CreateBookingResult> {
  await requireUser();
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error.issues);

  const { groomerIds, date, startTime, endTime, reason } = parsed.data;
  const start = vilniusToUtc(date, startTime);
  const end = vilniusToUtc(date, endTime);
  const supabase = await createClient();
  const { error } = await supabase.from("bookings").insert(
    groomerIds.map((groomerId) => ({
      kind: "block" as const,
      groomer_id: groomerId,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      block_reason: reason,
    })),
  );

  if (error) {
    if (error.code === "23P01") {
      // Name the first thing in the way, for whichever groomer it is.
      for (const groomerId of groomerIds) {
        const message = await findConflict(groomerId, start, end);
        if (!message) continue;
        if (groomerIds.length === 1) return { ok: false, error: message };
        const { data: g } = await supabase.from("groomers").select("name").eq("id", groomerId).maybeSingle();
        return { ok: false, error: g?.name ? `${g.name}. ${message}` : message };
      }
      return { ok: false, error: (await getTranslations("errors"))("slotTakenUnknown") };
    }
    return dbFailed(error, "createBlock");
  }

  revalidatePath("/calendar", "layout");
  revalidatePath("/upcoming");
  const range = `${toVilniusTime(start)}–${toVilniusTime(end)}`;
  return { ok: true, savedAt: Date.now(), summary: { range } };
}

type Conflict = { kind: "booking" | "block"; range: string; pets: string };

/**
 * The time is taken (23P01). Blocked time in the way, or a save that was already
 * confirmed: a plain error ("Šis laikas jau užimtas: 10:00–12:00, Maksas", US-09).
 * Only other visits in the way: the same message plus `overlap`, so the sheet can
 * ask "Vis tiek registruoti?" and send it again with `allowOverlap`.
 */
async function conflictResult(args: {
  groomerId: string;
  start: Date;
  end: Date;
  excludeId?: string;
  /** Overlap already allowed (or the row is blocked time): nothing left to confirm. */
  confirmed: boolean;
}): Promise<CreateBookingResult> {
  const t = await getTranslations("errors");
  const conflicts = await findConflicts(args.groomerId, args.start, args.end, args.excludeId);
  const block = conflicts.find((c) => c.kind === "block");
  if (block) return { ok: false, error: t("slotTakenBlock", { range: block.range }) };
  if (conflicts.length === 0) return { ok: false, error: t("slotTakenUnknown") };
  const first = conflicts[0];
  const error = t("slotTaken", { range: first.range, pets: first.pets });
  if (args.confirmed) return { ok: false, error };
  return {
    ok: false,
    error,
    overlap: { visits: conflicts.map((c) => (c.pets ? `${c.range} · ${c.pets}` : c.range)) },
  };
}

/** The message for the first booking or block of this groomer in [start, end), or null. */
async function findConflict(groomerId: string, start: Date, end: Date): Promise<string | null> {
  const t = await getTranslations("errors");
  const [first] = await findConflicts(groomerId, start, end);
  if (!first) return null;
  if (first.kind === "block") return t("slotTakenBlock", { range: first.range });
  return t("slotTaken", { range: first.range, pets: first.pets });
}

/** Active bookings and blocks of this groomer overlapping [start, end), earliest first. */
async function findConflicts(
  groomerId: string,
  start: Date,
  end: Date,
  excludeId?: string,
): Promise<Conflict[]> {
  const supabase = await createClient();
  let query = supabase
    .from("bookings")
    .select("kind, start_at, end_at, booking_items(position, pets(name))")
    .eq("groomer_id", groomerId)
    .neq("status", "cancelled")
    .lt("start_at", end.toISOString())
    .gt("end_at", start.toISOString())
    .order("start_at")
    .limit(10);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query;

  return (data ?? []).map((row) => ({
    kind: row.kind,
    range: `${toVilniusTime(row.start_at)}–${toVilniusTime(row.end_at)}`,
    pets: [...row.booking_items]
      .sort((a, b) => a.position - b.position)
      .map((i) => i.pets?.name)
      .filter((n, i, all): n is string => Boolean(n) && all.indexOf(n) === i)
      .join(", "),
  }));
}

/** US-10 (cancel part): status → cancelled; the slot frees up, the visit stays in history. */
export async function cancelBooking(id: string): Promise<ActionState> {
  await requireUser();
  if (!uuid.safeParse(id).success) return dbFailed({ code: "22023" }, "cancelBooking");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "scheduled")
    .select("id, client_id")
    .maybeSingle();
  if (error) return dbFailed(error, "cancelBooking");
  if (!data) return dbFailed({ code: "P0002" }, "cancelBooking");

  revalidatePath("/calendar", "layout");

  revalidatePath("/upcoming");
  if (data.client_id) revalidatePath(`/clients/${data.client_id}`);
  revalidatePath("/pets", "layout");
  return { ok: true, savedAt: Date.now(), id };
}

/**
 * US-10 (reschedule): new groomer / date / start / duration for a scheduled booking or a block.
 * Same rules as creating: not on a past day, 15-min grid, overlap checked by the database.
 */
export async function rescheduleBooking(input: RescheduleInput): Promise<CreateBookingResult> {
  await requireUser();
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error.issues);

  const { id, groomerId, date, startTime, durationMin, allowOverlap } = parsed.data;
  const start = vilniusToUtc(date, startTime);
  const end = new Date(start.getTime() + durationMin * 60_000);
  const supabase = await createClient();
  const { data: current } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
  if (!current) return dbFailed({ code: "P0002" }, "rescheduleBooking");
  // Blocked time never goes on top of anything.
  const isBlock = current.kind === "block";
  const { data, error } = await supabase
    .from("bookings")
    .update({
      groomer_id: groomerId,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      // Moving clears the flag unless confirmed again (only sent when there is one to clear or set).
      ...(current.overlap_ok || (!isBlock && allowOverlap) ? { overlap_ok: !isBlock && allowOverlap } : {}),
    })
    .eq("id", id)
    .eq("status", "scheduled")
    .select("id, client_id")
    .maybeSingle();

  if (error) {
    if (error.code === "23P01") {
      return conflictResult({
        groomerId,
        start,
        end,
        excludeId: id,
        confirmed: isBlock || allowOverlap,
      });
    }
    return dbFailed(error, "rescheduleBooking");
  }
  if (!data) return dbFailed({ code: "P0002" }, "rescheduleBooking");

  revalidatePath("/calendar", "layout");

  revalidatePath("/upcoming");
  if (data.client_id) revalidatePath(`/clients/${data.client_id}`);
  revalidatePath("/pets", "layout");
  const range = `${toVilniusTime(start)}–${toVilniusTime(end)}`;
  return { ok: true, savedAt: Date.now(), id, summary: { range } };
}

/**
 * Delete a booking made by mistake, or a block (requirements A6): only while still
 * `scheduled`, items go with it (on delete cascade). A real cancellation should use
 * cancelBooking so it stays in history and in the client's "Atšaukta" counter.
 */
export async function deleteBooking(id: string): Promise<ActionState> {
  await requireUser();
  if (!uuid.safeParse(id).success) return dbFailed({ code: "22023" }, "deleteBooking");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .delete()
    .eq("id", id)
    .eq("status", "scheduled")
    .select("id, client_id")
    .maybeSingle();
  if (error) return dbFailed(error, "deleteBooking");
  if (!data) return dbFailed({ code: "P0002" }, "deleteBooking");

  revalidatePath("/calendar", "layout");

  revalidatePath("/upcoming");
  if (data.client_id) revalidatePath(`/clients/${data.client_id}`);
  revalidatePath("/pets", "layout");
  return { ok: true, savedAt: Date.now(), id };
}

/**
 * US-11: record or correct a visit's result — completed / no-show / cancelled, actual
 * price and visit notes per item. Visits complete themselves after their end time
 * (database job); this is for the exceptions: a no-show, another price, notes.
 */
export async function completeVisit(input: CompleteVisitInput): Promise<ActionState> {
  await requireUser();
  const parsed = completeVisitSchema.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error.issues);

  const { id, status, items } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_visit", {
    p_booking_id: id,
    p_status: status,
    p_items: items.map((i) => ({ id: i.id, actual_price: i.actualPrice, visit_notes: i.visitNotes })),
  });
  if (error) {
    const t = await getTranslations("errors");
    return dbFailed(error, "completeVisit", { "22008": t("visitInFuture") });
  }

  const { data } = await supabase.from("bookings").select("client_id").eq("id", id).maybeSingle();
  revalidatePath("/calendar", "layout");
  revalidatePath("/upcoming");
  if (data?.client_id) revalidatePath(`/clients/${data.client_id}`);
  revalidatePath("/clients", "layout");
  revalidatePath("/pets", "layout");
  return { ok: true, savedAt: Date.now(), id };
}
