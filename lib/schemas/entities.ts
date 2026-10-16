import { z } from "zod";
import { SIZES, SPECIES } from "@/lib/pets";
import { todayInVilnius } from "@/lib/time";
import {
  checkbox,
  duration,
  optionalEmail,
  optionalName,
  optionalPhone,
  optionalText,
  requireContact,
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
/** Client = contact card: name, phone and e-mail each optional, at least one required. */
export const clientSchema = z
  .object({
    id: optionalId,
    fullName: optionalName(100),
    phone: optionalPhone,
    email: optionalEmail,
    notes: optionalText(2000),
  })
  .superRefine((v, ctx) => requireContact(v, ctx));
export type ClientInput = z.output<typeof clientSchema>;

// ---------------------------------------------------------------------------
// Pets (issue #16)
// ---------------------------------------------------------------------------
export { SIZES, SPECIES } from "@/lib/pets";

const emptyToNull = (v: unknown) => (v === "" || v === null || v === undefined ? null : v);

export const petSchema = z
  .object({
    id: optionalId,
    /** Owner is optional (pet first). */
    clientId: optionalId,
    /** New pet only: an optional contact created together with it (any of the three). */
    ownerName: optionalName(100),
    ownerPhone: optionalPhone,
    ownerEmail: optionalEmail,
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

// ---------------------------------------------------------------------------
// Per-pet services: the pet's own duration and price for a service
// ---------------------------------------------------------------------------
export const petServiceSchema = z.object({
  petId: uuid,
  serviceId: z.string({ error: "required" }).min(1, { error: "required" }).pipe(uuid),
  durationMin: duration,
  price,
});
export type PetServiceInput = z.output<typeof petServiceSchema>;

/** A new owner / contact for an existing pet: at least one of name, phone, e-mail. */
export const petOwnerContactSchema = z
  .object({ fullName: optionalName(100), phone: optionalPhone, email: optionalEmail })
  .superRefine((v, ctx) => requireContact(v, ctx));

/** Several new pets at once (a household): name + species per row, owner optional. */
export const newPetsSchema = z.object({
  clientId: optionalId,
  pets: z
    .array(z.object({ name: requiredText(50), species: z.enum(SPECIES, { error: "required" }) }))
    .min(1, { error: "itemsRequired" })
    .max(10, { error: "invalid" }),
  ownerName: optionalName(100),
  ownerPhone: optionalPhone,
  ownerEmail: optionalEmail,
});
export type NewPetsInput = z.input<typeof newPetsSchema>;
