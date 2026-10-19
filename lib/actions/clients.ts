"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { dbFailed, formToObject, validationFailed, type FormState } from "@/lib/action-helpers";
import { requireUser } from "@/lib/auth";
import { uuid } from "@/lib/schemas/common";
import {
  ANONYMIZE_CONFIRM,
  clientSchema,
  newPetsSchema,
  petOwnerContactSchema,
  petSchema,
  type NewPetsInput,
} from "@/lib/schemas/entities";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Clients (issue #15)
// ---------------------------------------------------------------------------

export async function saveClient(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = clientSchema.safeParse(formToObject(formData));
  if (!parsed.success) return validationFailed(parsed.error.issues);

  const { id, fullName, phone, email, notes } = parsed.data;
  const row = { full_name: fullName, phone_e164: phone, email, notes };
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("clients").update(row).eq("id", id).is("anonymized_at", null).select("id").single()
    : await supabase.from("clients").insert(row).select("id").single();

  if (error) {
    const t = await getTranslations("errors");
    if (error.code === "23505") {
      return { ok: false, error: t("checkFields"), fieldErrors: { phone: t("phoneTaken") } };
    }
    return dbFailed(error, "saveClient");
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${data.id}`);
  revalidatePath("/calendar", "layout");
  revalidatePath("/upcoming");
  // Created from the clients list: go straight to the new client's page. A server-side redirect
  // is reliable; a client-side push right after the action can lose the race with the refresh.
  if (!id && formData.get("then") === "open") redirect(`/clients/${data.id}`);
  return { ok: true, savedAt: Date.now(), id: data.id };
}

export async function setClientArchived(id: string, archived: boolean): Promise<FormState> {
  await requireUser();
  if (!uuid.safeParse(id).success) return dbFailed({ code: "22023" }, "setClientArchived");
  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .is("anonymized_at", null);
  if (error) return dbFailed(error, "setClientArchived");
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  revalidatePath("/pets", "layout");
  return { ok: true, savedAt: Date.now(), id };
}

/**
 * US-17 (GDPR erasure): clears name, phone, e-mail and notes, keeps visits without
 * personal data. Refused while the client has future scheduled bookings.
 */
export async function anonymizeClient(id: string, confirm: string): Promise<FormState> {
  await requireUser();
  if (!uuid.safeParse(id).success) return dbFailed({ code: "22023" }, "anonymizeClient");
  const t = await getTranslations("clients");
  if (confirm.trim().toUpperCase() !== ANONYMIZE_CONFIRM) {
    return { ok: false, error: t("anonymizeConfirmWrong") };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("anonymize_client", { p_client_id: id });
  if (error) {
    if (error.code === "P0001") return { ok: false, error: t("anonymizeHasFuture") };
    return dbFailed(error, "anonymizeClient");
  }
  revalidatePath("/clients", "layout");
  revalidatePath("/pets", "layout");
  revalidatePath("/calendar", "layout");
  revalidatePath("/upcoming");
  revalidatePath("/search");
  return { ok: true, savedAt: Date.now(), id };
}

// ---------------------------------------------------------------------------
// Pets (issue #16)
// ---------------------------------------------------------------------------

export async function savePet(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = petSchema.safeParse(formToObject(formData));
  if (!parsed.success) return validationFailed(parsed.error.issues);

  const { id, clientId, ownerName, ownerPhone, ownerEmail } = parsed.data;
  const { name, species, breed, size, weightKg, birthYear, birthMonth, notes } = parsed.data;
  const row = {
    name,
    species,
    breed,
    size,
    weight_kg: weightKg,
    birth_year: birthYear,
    birth_month: birthMonth,
    notes,
  };
  const supabase = await createClient();

  if (id) {
    // Editing never moves a pet to another owner here — that is setPetOwner.
    const { error } = await supabase.from("pets").update(row).eq("id", id);
    if (error) return dbFailed(error, "savePet");
    revalidatePet(id, clientId);
    return { ok: true, savedAt: Date.now(), id };
  }

  // Every pet lives in a family. No family given: a new one, with whatever contact
  // was typed (name / phone / e-mail — all optional).
  let ownerId = clientId ?? null;
  if (!ownerId) {
    const { data: client, error } = await supabase
      .from("clients")
      .insert({ full_name: ownerName, phone_e164: ownerPhone, email: ownerEmail })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") {
        const t = await getTranslations("errors");
        return { ok: false, error: t("checkFields"), fieldErrors: { ownerPhone: t("phoneTaken") } };
      }
      return dbFailed(error, "savePet.owner");
    }
    ownerId = client.id;
  }

  const { data, error } = await supabase
    .from("pets")
    .insert({ ...row, client_id: ownerId })
    .select("id")
    .single();
  if (error) return dbFailed(error, "savePet");

  revalidatePet(data.id, ownerId);
  // Created from the pet list: open the new pet's page (server redirect, see saveClient).
  if (formData.get("then") === "open") redirect(`/pets/${data.id}`);
  return { ok: true, savedAt: Date.now(), id: data.id };
}

export async function setPetArchived(
  id: string,
  archived: boolean,
  clientId?: string | null,
): Promise<FormState> {
  await requireUser();
  if (!uuid.safeParse(id).success) return dbFailed({ code: "22023" }, "setPetArchived");
  const supabase = await createClient();
  const { error } = await supabase
    .from("pets")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return dbFailed(error, "setPetArchived");
  revalidatePet(id, clientId);
  return { ok: true, savedAt: Date.now(), id };
}

export type PetOwnerInput =
  | { mode: "existing"; id: string }
  | { mode: "new"; fullName: string; phone: string; email: string }
  | { mode: "none" };

/** Link a pet to an existing client, to a new contact card, or to nobody. */
export async function setPetOwner(petId: string, input: PetOwnerInput): Promise<FormState> {
  await requireUser();
  if (!uuid.safeParse(petId).success) return dbFailed({ code: "22023" }, "setPetOwner");
  let args: { p_pet_id: string; p_client_id?: string; p_new_client?: Json } = { p_pet_id: petId };
  if (input?.mode === "existing") {
    if (!uuid.safeParse(input.id).success) return dbFailed({ code: "22023" }, "setPetOwner");
    args = { ...args, p_client_id: input.id };
  } else if (input?.mode === "new") {
    const parsed = petOwnerContactSchema.safeParse(input);
    if (!parsed.success) return validationFailed(parsed.error.issues);
    args = {
      ...args,
      p_new_client: {
        full_name: parsed.data.fullName,
        phone_e164: parsed.data.phone,
        email: parsed.data.email,
      },
    };
  }
  const supabase = await createClient();
  const { data: ownerId, error } = await supabase.rpc("set_pet_owner", args);
  if (error) {
    if (error.code === "23505") {
      const t = await getTranslations("errors");
      return { ok: false, error: t("checkFields"), fieldErrors: { phone: t("phoneTaken") } };
    }
    return dbFailed(error, "setPetOwner");
  }
  revalidatePet(petId, ownerId);
  revalidatePath("/calendar", "layout");
  revalidatePath("/upcoming");
  return { ok: true, savedAt: Date.now(), id: petId };
}

function revalidatePet(petId: string, clientId?: string | null) {
  revalidatePath(`/pets/${petId}`);
  if (clientId) revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  revalidatePath("/calendar", "layout");
  revalidatePath("/upcoming");
}

export type CreatePetsResult = FormState & { petIds?: string[]; clientId?: string | null };

/**
 * A household at once: 1–10 pets (name + species), an optional owner contact. Several
 * pets without any contact are kept together on a family card named after them.
 * One transaction (create_pets).
 */
export async function createPets(input: NewPetsInput, open = false): Promise<CreatePetsResult> {
  await requireUser();
  const parsed = newPetsSchema.safeParse(input);
  if (!parsed.success) return validationFailed(parsed.error.issues);
  const { clientId, pets, ownerName, ownerPhone, ownerEmail } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_pets", {
    p_pets: pets.map((p) => ({ name: p.name, species: p.species })),
    p_client_id: clientId,
    p_new_client: clientId ? undefined : { full_name: ownerName, phone_e164: ownerPhone, email: ownerEmail },
  });
  if (error) {
    if (error.code === "23505") {
      const t = await getTranslations("errors");
      return { ok: false, error: t("checkFields"), fieldErrors: { ownerPhone: t("phoneTaken") } };
    }
    return dbFailed(error, "createPets");
  }
  const owner = data[0]?.client_id ?? null;
  for (const row of data) revalidatePath(`/pets/${row.pet_id}`);
  if (owner) revalidatePath(`/clients/${owner}`);
  revalidatePath("/clients");
  revalidatePath("/calendar", "layout");
  // From the pet list: open the new pet — or, for a household, the family card.
  // A server redirect is reliable (a client push can lose to the refresh).
  if (open) redirect(data.length === 1 || !owner ? `/pets/${data[0].pet_id}` : `/clients/${owner}`);
  return { ok: true, savedAt: Date.now(), petIds: data.map((r) => r.pet_id), clientId: owner };
}
