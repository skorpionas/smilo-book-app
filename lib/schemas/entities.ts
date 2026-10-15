import { z } from "zod";
import { SIZES, SPECIES } from "@/lib/pets";
import { todayInVilnius } from "@/lib/time";
import {
  checkbox,
  duration,
  optionalEmail,
  optionalPhone,
  optionalText,
  price,
  requiredText,
  uuid,
  workDays,
} from "./common";

const optionalId = z.preprocess((v) => (v === "" || v === null ? undefined : v), uuid.optional());

// ---------------------------------------------------------------------------
// Services (US-15)
// ---------------------------------------------------------------------------
export const serviceSchema = z.object({
  id: optionalId,
  name: requiredText(80),
  defaultDurationMin: duration,
  defaultPrice: price,
});
export type ServiceInput = z.output<typeof serviceSchema>;

// ---------------------------------------------------------------------------
// Groomers (issue #14)
// ---------------------------------------------------------------------------
export const groomerSchema = z.object({
  id: optionalId,
  name: requiredText(50),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { error: "invalidColor" })
    .transform((c) => c.toLowerCase()),
  isActive: checkbox,
  workDays,
});
export type GroomerInput = z.output<typeof groomerSchema>;

// ---------------------------------------------------------------------------
// Clients (issue #15)
// ---------------------------------------------------------------------------
export const clientSchema = z.object({
  id: optionalId,
  fullName: requiredText(100, 2),
  phone: optionalPhone,
  email: optionalEmail,
  notes: optionalText(2000),
});
export type ClientInput = z.output<typeof clientSchema>;

// ---------------------------------------------------------------------------
// Pets (issue #16)
// ---------------------------------------------------------------------------
export { SIZES, SPECIES } from "@/lib/pets";

const emptyToNull = (v: unknown) => (v === "" || v === null || v === undefined ? null : v);

export const petSchema = z.object({
  id: optionalId,
  clientId: uuid,
  name: requiredText(50),
  species: z.enum(SPECIES, { error: "required" }),
  breed: optionalText(80),
  size: z.preprocess(emptyToNull, z.enum(SIZES, { error: "invalid" }).nullable()),
  weightKg: z.preprocess(
    (v) => {
      const e = emptyToNull(v);
      return typeof e === "string" ? Number(e.replace(",", ".")) : e;
    },
    z
      .number({ error: "invalidWeight" })
      .min(0.5, { error: "invalidWeight" })
      .max(120, { error: "invalidWeight" })
      .transform((n) => Math.round(n * 10) / 10)
      .nullable(),
  ),
  birthDate: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "invalidDate" })
      .refine((d) => d <= todayInVilnius(), { error: "futureDate" })
      .nullable(),
  ),
  notes: optionalText(2000),
});
export type PetInput = z.output<typeof petSchema>;
