import { z } from "zod";
import {
  dateStr,
  duration,
  gridTime,
  optionalEmail,
  optionalPhone,
  optionalText,
  price,
  requiredText,
  uuid,
} from "./common";
import { SPECIES } from "@/lib/pets";
import { todayInVilnius } from "@/lib/time";

/** Bookings can be made for today (any time) or later, never for a past day. */
export const bookingDate = dateStr.refine((d) => d >= todayInVilnius(), { error: "pastDate" });

/**
 * createBooking input (US-05, US-06, US-07). Sent as a plain object from the
 * booking sheet; the same schema validates on the server.
 */
const existingClient = z.object({ mode: z.literal("existing"), id: uuid });
const newClient = z.object({
  mode: z.literal("new"),
  fullName: requiredText(100, 2),
  phone: optionalPhone,
  email: optionalEmail,
});

const existingPet = z.object({ mode: z.literal("existing"), id: uuid });
const newPet = z.object({
  mode: z.literal("new"),
  name: requiredText(50),
  species: z.enum(SPECIES, { error: "required" }),
  breed: optionalText(80),
});

export const bookingItemSchema = z.object({
  pet: z.discriminatedUnion("mode", [existingPet, newPet], { error: "required" }),
  serviceId: z.string({ error: "required" }).min(1, { error: "required" }).pipe(uuid),
  durationMin: duration,
  plannedPrice: price,
  /** Save this duration + price as the pet's own service (pre-filled next time). */
  remember: z.boolean().optional().default(false),
});

export const bookingSchema = z
  .object({
    groomerId: uuid,
    date: bookingDate,
    startTime: gridTime,
    durationMin: duration,
    client: z.discriminatedUnion("mode", [existingClient, newClient], { error: "required" }),
    items: z.array(bookingItemSchema).min(1, { error: "itemsRequired" }).max(6, { error: "invalid" }),
    notes: optionalText(2000),
  })
  .superRefine((value, ctx) => {
    // A new pet can only be added to a new or existing client of this booking — always true here —
    // but two identical existing pets in one booking make no sense.
    const seen = new Set<string>();
    value.items.forEach((item, i) => {
      if (item.pet.mode !== "existing") return;
      const key = `${item.pet.id}:${item.serviceId}`;
      if (seen.has(key))
        ctx.addIssue({ code: "custom", message: "invalid", path: ["items", i, "serviceId"] });
      seen.add(key);
    });
  });

export type BookingInput = z.input<typeof bookingSchema>;
export type BookingData = z.output<typeof bookingSchema>;

/** Sum of item durations, used as the default booking duration (A14). */
export function sumDurations(items: { durationMin: number }[]): number {
  return items.reduce((sum, item) => sum + item.durationMin, 0);
}

/** US-10: move a booking (or blocked time) to another groomer, date, start or length. */
export const rescheduleSchema = z.object({
  id: uuid,
  groomerId: uuid,
  date: bookingDate,
  startTime: gridTime,
  durationMin: duration,
});
export type RescheduleInput = z.input<typeof rescheduleSchema>;
