"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFailed, formToObject, validationFailed, type FormState } from "@/lib/action-helpers";
import { requireUser } from "@/lib/auth";
import { uuid } from "@/lib/schemas/common";
import { groomerSchema, serviceSchema } from "@/lib/schemas/entities";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Services (US-15, issue #13)
// ---------------------------------------------------------------------------

export async function saveService(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = serviceSchema.safeParse(formToObject(formData));
  if (!parsed.success) return validationFailed(parsed.error.issues);

  const { id, name, defaultDurationMin, defaultPrice } = parsed.data;
  const row = { name, default_duration_min: defaultDurationMin, default_price: defaultPrice };
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("services").update(row).eq("id", id).select("id").single()
    : await supabase.from("services").insert(row).select("id").single();
  if (error) return dbFailed(error, "saveService");

  revalidatePath("/settings");
  revalidatePath("/calendar", "layout");
  return { ok: true, savedAt: Date.now(), id: data.id };
}

export async function setServiceArchived(id: string, archived: boolean): Promise<FormState> {
  await requireUser();
  if (!uuid.safeParse(id).success) return dbFailed({ code: "22023" }, "setServiceArchived");
  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return dbFailed(error, "setServiceArchived");
  revalidatePath("/settings");
  revalidatePath("/calendar", "layout");
  return { ok: true, savedAt: Date.now(), id };
}

// ---------------------------------------------------------------------------
// Groomers (issue #14)
// ---------------------------------------------------------------------------

export async function saveGroomer(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = groomerSchema.safeParse(formToObject(formData));
  if (!parsed.success) return validationFailed(parsed.error.issues);

  const { id, name, color, isActive, workDays } = parsed.data;
  const supabase = await createClient();

  let result;
  if (id) {
    result = await supabase
      .from("groomers")
      .update({ name, color, is_active: isActive, work_days: workDays })
      .eq("id", id)
      .select("id")
      .single();
  } else {
    // New groomers go to the right of the existing columns.
    const { data: last } = await supabase
      .from("groomers")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    result = await supabase
      .from("groomers")
      .insert({
        name,
        color,
        is_active: isActive,
        work_days: workDays,
        sort_order: (last?.sort_order ?? 0) + 1,
      })
      .select("id")
      .single();
  }
  if (result.error) return dbFailed(result.error, "saveGroomer");

  revalidatePath("/settings");
  revalidatePath("/calendar", "layout");
  return { ok: true, savedAt: Date.now(), id: result.data.id };
}

const moveSchema = z.object({ id: uuid, direction: z.enum(["up", "down"]) });

/** Swap a groomer with its neighbour; the order is the column order in the calendar. */
export async function moveGroomer(id: string, direction: "up" | "down"): Promise<FormState> {
  await requireUser();
  const parsed = moveSchema.safeParse({ id, direction });
  if (!parsed.success) return validationFailed(parsed.error.issues);

  const supabase = await createClient();
  const { data: list, error } = await supabase.from("groomers").select("id, sort_order").order("sort_order");
  if (error) return dbFailed(error, "moveGroomer");

  const i = list.findIndex((g) => g.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true, savedAt: Date.now() };

  // Re-number everything so equal sort_order values can't get stuck.
  const ordered = [...list];
  [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  for (const [index, g] of ordered.entries()) {
    const { error: e } = await supabase
      .from("groomers")
      .update({ sort_order: index + 1 })
      .eq("id", g.id);
    if (e) return dbFailed(e, "moveGroomer");
  }
  revalidatePath("/settings");
  revalidatePath("/calendar", "layout");
  return { ok: true, savedAt: Date.now() };
}
