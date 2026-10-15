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

export const petSchema = z
  .object({
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
    birthYear: z.preprocess(
      (v) => {
        const e = emptyToNull(v);
        return typeof e === "string" ? Number(e) : e;
      },
      z.number({ error: "invalid" }).int({ error: "invalid" }).min(1990, { error: "invalid" }).nullable(),
    ),
    birthMonth: z.preprocess(
      (v) => {
        const e = emptyToNull(v);
        return typeof e === "string" ? Number(e) : e;
      },
      z
        .number({ error: "invalid" })
        .int({ error: "invalid" })
        .min(1, { error: "invalid" })
        .max(12, { error: "invalid" })
        .nullable(),
    ),
    notes: optionalText(2000),
  })
  .superRefine((pet, ctx) => {
    // Birth: year optional, month optional but only with a year, never in the future.
    const [y, m] = todayInVilnius().split("-").map(Number);
    if (pet.birthMonth != null && pet.birthYear == null) {
      ctx.addIssue({ code: "custom", path: ["birthYear"], message: "required" });
    } else if (pet.birthYear != null && pet.birthYear > y) {
      ctx.addIssue({ code: "custom", path: ["birthYear"], message: "futureDate" });
    } else if (pet.birthYear === y && pet.birthMonth != null && pet.birthMonth > m) {
      ctx.addIssue({ code: "custom", path: ["birthMonth"], message: "futureDate" });
    }
  });
export type PetInput = z.output<typeof petSchema>;
