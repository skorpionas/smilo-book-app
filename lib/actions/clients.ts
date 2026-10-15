"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { dbFailed, formToObject, validationFailed, type FormState } from "@/lib/action-helpers";
import { requireUser } from "@/lib/auth";
import { uuid } from "@/lib/schemas/common";
import { clientSchema, petSchema } from "@/lib/schemas/entities";
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
  return { ok: true, savedAt: Date.now(), id };
}

// ---------------------------------------------------------------------------
// Pets (issue #16)
// ---------------------------------------------------------------------------

export async function savePet(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = petSchema.safeParse(formToObject(formData));
  if (!parsed.success) return validationFailed(parsed.error.issues);

  const { id, clientId, name, species, breed, size, weightKg, birthDate, notes } = parsed.data;
  const row = {
    name,
    species,
    breed,
    size,
    weight_kg: weightKg,
    birth_date: birthDate,
    notes,
  };
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("pets").update(row).eq("id", id).eq("client_id", clientId).select("id").single()
    : await supabase
        .from("pets")
        .insert({ ...row, client_id: clientId })
        .select("id")
        .single();
  if (error) return dbFailed(error, "savePet");

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  revalidatePath("/calendar", "layout");
  return { ok: true, savedAt: Date.now(), id: data.id };
}

export async function setPetArchived(id: string, clientId: string, archived: boolean): Promise<FormState> {
  await requireUser();
  if (!uuid.safeParse(id).success || !uuid.safeParse(clientId).success) {
    return dbFailed({ code: "22023" }, "setPetArchived");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("pets")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("client_id", clientId);
  if (error) return dbFailed(error, "setPetArchived");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return { ok: true, savedAt: Date.now(), id };
}
