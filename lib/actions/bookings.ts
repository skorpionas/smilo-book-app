"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { dbFailed, validationFailed, type ActionState } from "@/lib/action-helpers";
import { requireUser } from "@/lib/auth";
import { bookingSchema, type BookingInput } from "@/lib/schemas/booking";
import { uuid } from "@/lib/schemas/common";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { toVilniusTime, vilniusToUtc } from "@/lib/time";

export type BookingClientOption = {
  id: string;
  fullName: string;
  phone: string | null;
  phoneDisplay: string;
  pets: { id: string; name: string; species: "dog" | "cat" }[];
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
  const ids = [...new Set(hits.map((h) => h.client_id))].slice(0, 10);
  return loadClientOptions(ids);
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
    .select("id, full_name, phone_e164, pets(id, name, species, archived_at)")
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
    fullName: c.full_name,
    phone: c.phone_e164,
    phoneDisplay: formatPhone(c.phone_e164),
    pets: c.pets
      .filter((p) => !p.archived_at)
      .sort((a, b) => a.name.localeCompare(b.name, "lt"))
      .map((p) => ({ id: p.id, name: p.name, species: p.species })),
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

export type CreateBookingResult = ActionState & { summary?: { range: string } };

/** US-05/06/07/09: create client (optional) + new pets + booking + items in one transaction. */
export async function createBooking(input: BookingInput): Promise<CreateBookingResult> {
  await requireUser();
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error.issues);

  const b = parsed.data;
  const start = vilniusToUtc(b.date, b.startTime);
  const end = new Date(start.getTime() + b.durationMin * 60_000);

  const items = b.items.map((item) => ({
    pet_id: item.pet.mode === "existing" ? item.pet.id : null,
    new_pet:
      item.pet.mode === "new"
        ? { name: item.pet.name, species: item.pet.species, breed: item.pet.breed }
        : null,
    service_id: item.serviceId,
    duration_min: item.durationMin,
    planned_price: item.plannedPrice,
  }));

  const supabase = await createClient();
  const { data: bookingId, error } = await supabase.rpc("create_booking_with_items", {
    p_groomer_id: b.groomerId,
    p_start_at: start.toISOString(),
    p_end_at: end.toISOString(),
    p_items: items,
    p_client_id: b.client.mode === "existing" ? b.client.id : undefined,
    p_new_client:
      b.client.mode === "new"
        ? { full_name: b.client.fullName, phone_e164: b.client.phone ?? "", email: b.client.email ?? "" }
        : undefined,
    p_notes: b.notes,
  });

  if (error) {
    const t = await getTranslations("errors");
    if (error.code === "23P01") {
      return { ok: false, error: await describeConflict(b.groomerId, start, end) };
    }
    if (error.code === "23505") {
      return { ok: false, error: t("checkFields"), fieldErrors: { "client.phone": t("phoneTaken") } };
    }
    return dbFailed(error, "createBooking");
  }

  revalidatePath("/calendar", "layout");
  revalidatePath("/clients", "layout");
  const range = `${toVilniusTime(start)}–${toVilniusTime(end)}`;
  return { ok: true, savedAt: Date.now(), id: bookingId, summary: { range } };
}

/** "Šis laikas jau užimtas: 10:00–12:00, Maksas" — names the booking (or block) in the way (US-09). */
async function describeConflict(groomerId: string, start: Date, end: Date): Promise<string> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("kind, start_at, end_at, block_reason, booking_items(position, pets(name))")
    .eq("groomer_id", groomerId)
    .neq("status", "cancelled")
    .lt("start_at", end.toISOString())
    .gt("end_at", start.toISOString())
    .order("start_at")
    .limit(1)
    .maybeSingle();

  if (!data) return t("slotTakenUnknown");
  const range = `${toVilniusTime(data.start_at)}–${toVilniusTime(data.end_at)}`;
  if (data.kind === "block") return t("slotTakenBlock", { range });
  const pets = [...data.booking_items]
    .sort((a, b) => a.position - b.position)
    .map((i) => i.pets?.name)
    .filter(Boolean)
    .join(", ");
  return t("slotTaken", { range, pets });
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
  if (data.client_id) revalidatePath(`/clients/${data.client_id}`);
  return { ok: true, savedAt: Date.now(), id };
}
