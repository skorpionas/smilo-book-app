"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { dbFailed, formToObject, validationFailed, type FormState } from "@/lib/action-helpers";
import { requireUser } from "@/lib/auth";
import { uuid } from "@/lib/schemas/common";
import { petServiceSchema } from "@/lib/schemas/entities";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Per-pet services: the pet's own duration and price (owner feedback 2026-10-16)
// ---------------------------------------------------------------------------

function revalidatePet(petId: string) {
  revalidatePath(`/pets/${petId}`);
  revalidatePath("/clients", "layout");
  revalidatePath("/calendar", "layout");
}

/** Add or change one service of a pet (unique per pet + service: saving again updates it). */
export async function savePetService(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = petServiceSchema.safeParse(formToObject(formData));
  if (!parsed.success) return validationFailed(parsed.error.issues);

  const { petId, serviceId, durationMin, price } = parsed.data;
  const supabase = await createClient();
  const { data: existing } = await supabase.from("pet_services").select("id, service_id").eq("pet_id", petId);
  const same = existing?.find((r) => r.service_id === serviceId);
  const { data, error } = same
    ? await supabase
        .from("pet_services")
        .update({ duration_min: durationMin, price })
        .eq("id", same.id)
        .select("id")
        .single()
    : await supabase
        .from("pet_services")
        .insert({
          pet_id: petId,
          service_id: serviceId,
          duration_min: durationMin,
          price,
          position: existing?.length ?? 0,
        })
        .select("id")
        .single();
  if (error) {
    if (error.code === "42501") {
      const t = await getTranslations("errors");
      return { ok: false, error: t("notFound") };
    }
    return dbFailed(error, "savePetService");
  }
  revalidatePet(petId);
  return { ok: true, savedAt: Date.now(), id: data.id };
}

/** Remove a pet's own price: the service falls back to the last / default price. */
export async function deletePetService(id: string, petId: string): Promise<FormState> {
  await requireUser();
  if (!uuid.safeParse(id).success || !uuid.safeParse(petId).success) {
    return dbFailed({ code: "22023" }, "deletePetService");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("pet_services").delete().eq("id", id).eq("pet_id", petId);
  if (error) return dbFailed(error, "deletePetService");
  revalidatePet(petId);
  return { ok: true, savedAt: Date.now(), id };
}

/** Make this the pet's usual service: it is picked automatically when the pet is booked. */
export async function makeUsualPetService(id: string, petId: string): Promise<FormState> {
  await requireUser();
  if (!uuid.safeParse(id).success || !uuid.safeParse(petId).success) {
    return dbFailed({ code: "22023" }, "makeUsualPetService");
  }
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("pet_services")
    .select("id, position, created_at")
    .eq("pet_id", petId)
    .order("position")
    .order("created_at");
  if (error) return dbFailed(error, "makeUsualPetService");
  if (!rows.some((r) => r.id === id)) return dbFailed({ code: "P0002" }, "makeUsualPetService");

  const ordered = [id, ...rows.map((r) => r.id).filter((x) => x !== id)];
  for (const [position, rowId] of ordered.entries()) {
    const { error: e } = await supabase.from("pet_services").update({ position }).eq("id", rowId);
    if (e) return dbFailed(e, "makeUsualPetService");
  }
  revalidatePet(petId);
  return { ok: true, savedAt: Date.now(), id };
}
