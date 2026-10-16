"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { dbFailed, formToObject, validationFailed, type FormState } from "@/lib/action-helpers";
import { requireUser } from "@/lib/auth";
import { uuid } from "@/lib/schemas/common";
import { clientServiceSchema, petServiceSchema } from "@/lib/schemas/entities";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Own services with a custom duration and price (owner feedback 2026-10-16):
//  - pet_services:    one pet's own time and price
//  - client_services: a family's shared service — total time and price for all of
//                     the client's pets together ("Maudymas abiem, 2 h, 50 €")
// Position 0 = the usual service, filled in automatically when booking.
// ---------------------------------------------------------------------------

type Kind = "pet" | "client";
const TABLE = { pet: "pet_services", client: "client_services" } as const;
const OWNER = { pet: "pet_id", client: "client_id" } as const;

function revalidateOwner(kind: Kind, ownerId: string) {
  revalidatePath(kind === "pet" ? `/pets/${ownerId}` : `/clients/${ownerId}`);
  revalidatePath("/pets", "layout");
  revalidatePath("/clients", "layout");
  revalidatePath("/calendar", "layout");
}

async function saveOwned(kind: Kind, ownerId: string, serviceId: string, durationMin: number, price: number) {
  const supabase = await createClient();
  const table = TABLE[kind];
  const ownerCol = OWNER[kind];
  // Typed per table below; the two tables share their columns apart from the owner.
  const { data: existing } = await supabase
    .from(table)
    .select("id, service_id")
    .eq(ownerCol as never, ownerId);
  const same = existing?.find((r) => r.service_id === serviceId);
  const res = same
    ? await supabase
        .from(table)
        .update({ duration_min: durationMin, price })
        .eq("id", same.id)
        .select("id")
        .single()
    : await supabase
        .from(table)
        .insert({
          [ownerCol]: ownerId,
          service_id: serviceId,
          duration_min: durationMin,
          price,
          position: existing?.length ?? 0,
        } as never)
        .select("id")
        .single();
  return res;
}

async function saveResult(
  kind: Kind,
  ownerId: string,
  res: Awaited<ReturnType<typeof saveOwned>>,
  context: string,
) {
  if (res.error) {
    if (res.error.code === "42501") {
      const t = await getTranslations("errors");
      return { ok: false, error: t("notFound") } satisfies FormState;
    }
    return dbFailed(res.error, context);
  }
  revalidateOwner(kind, ownerId);
  return { ok: true, savedAt: Date.now(), id: res.data.id } satisfies FormState;
}

/** Add or change one service of a pet (unique per pet + service: saving again updates it). */
export async function savePetService(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = petServiceSchema.safeParse(formToObject(formData));
  if (!parsed.success) return validationFailed(parsed.error.issues);
  const { petId, serviceId, durationMin, price } = parsed.data;
  return saveResult(
    "pet",
    petId,
    await saveOwned("pet", petId, serviceId, durationMin, price),
    "savePetService",
  );
}

/** Add or change a family's shared service (totals for all of the client's pets). */
export async function saveClientService(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = clientServiceSchema.safeParse(formToObject(formData));
  if (!parsed.success) return validationFailed(parsed.error.issues);
  const { clientId, serviceId, durationMin, price } = parsed.data;
  return saveResult(
    "client",
    clientId,
    await saveOwned("client", clientId, serviceId, durationMin, price),
    "saveClientService",
  );
}

async function deleteOwned(kind: Kind, id: string, ownerId: string): Promise<FormState> {
  if (!uuid.safeParse(id).success || !uuid.safeParse(ownerId).success) {
    return dbFailed({ code: "22023" }, `delete.${kind}`);
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLE[kind])
    .delete()
    .eq("id", id)
    .eq(OWNER[kind] as never, ownerId);
  if (error) return dbFailed(error, `delete.${kind}`);
  revalidateOwner(kind, ownerId);
  return { ok: true, savedAt: Date.now(), id };
}

/** Remove a pet's own price: the service falls back to the last / default price. */
export async function deletePetService(id: string, petId: string): Promise<FormState> {
  await requireUser();
  return deleteOwned("pet", id, petId);
}

/** Remove a family's shared service. */
export async function deleteClientService(id: string, clientId: string): Promise<FormState> {
  await requireUser();
  return deleteOwned("client", id, clientId);
}

async function makeUsualOwned(kind: Kind, id: string, ownerId: string): Promise<FormState> {
  if (!uuid.safeParse(id).success || !uuid.safeParse(ownerId).success) {
    return dbFailed({ code: "22023" }, `makeUsual.${kind}`);
  }
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from(TABLE[kind])
    .select("id, position, created_at")
    .eq(OWNER[kind] as never, ownerId)
    .order("position")
    .order("created_at");
  if (error) return dbFailed(error, `makeUsual.${kind}`);
  if (!rows.some((r) => r.id === id)) return dbFailed({ code: "P0002" }, `makeUsual.${kind}`);

  const ordered = [id, ...rows.map((r) => r.id).filter((x) => x !== id)];
  for (const [position, rowId] of ordered.entries()) {
    const { error: e } = await supabase.from(TABLE[kind]).update({ position }).eq("id", rowId);
    if (e) return dbFailed(e, `makeUsual.${kind}`);
  }
  revalidateOwner(kind, ownerId);
  return { ok: true, savedAt: Date.now(), id };
}

/** Make this the pet's usual service: it is picked automatically when the pet is booked. */
export async function makeUsualPetService(id: string, petId: string): Promise<FormState> {
  await requireUser();
  return makeUsualOwned("pet", id, petId);
}

/** Make this the family's usual shared service ("Kartu" in the booking fills it). */
export async function makeUsualClientService(id: string, clientId: string): Promise<FormState> {
  await requireUser();
  return makeUsualOwned("client", id, clientId);
}
