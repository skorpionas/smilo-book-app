import { z } from "zod";
import {
  dateStr,
  duration,
  gridTime,
  optionalEmail,
  optionalName,
  optionalPhone,
  optionalText,
  price,
  requireContact,
  requiredText,
  uuid,
} from "./common";
import { SPECIES } from "@/lib/pets";
import { isTimeStr, timeToMinutes } from "@/lib/clock";
import { BLOCK_MAX_DAYS, datesBetween } from "@/lib/schedule";
import { isDateStr, todayInVilnius } from "@/lib/time";

/** Bookings can be made for today (any time) or later, never for a past day. */
export const bookingDate = dateStr.refine((d) => d >= todayInVilnius(), { error: "pastDate" });

/**
 * createBooking input (US-05, US-06, US-07). Sent as a plain object from the
 * booking sheet; the same schema validates on the server.
 */
const existingClient = z.object({ mode: z.literal("existing"), id: uuid });
/** New contact card: name, phone, e-mail each optional, at least one (else use "none"). */
const newClient = z
  .object({
    mode: z.literal("new"),
    fullName: optionalName(100),
    phone: optionalPhone,
    email: optionalEmail,
  })
  .superRefine((v, ctx) => requireContact(v, ctx));
/** Pet first: a booking can have no client at all. */
const noClient = z.object({ mode: z.literal("none") });

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
  /** Rows with the same number were one shared service for several pets (time and price split). */
  sharedGroup: z.number().int().min(1).max(6).optional(),
});

/** The same existing pet with the same service twice in one booking makes no sense. */
function noDuplicateItems(
  items: { pet: { mode: string; id?: string }; serviceId: string }[],
  ctx: z.core.$RefinementCtx,
) {
  const seen = new Set<string>();
  items.forEach((item, i) => {
    if (item.pet.mode !== "existing") return;
    const key = `${item.pet.id}:${item.serviceId}`;
    if (seen.has(key)) ctx.addIssue({ code: "custom", message: "invalid", path: ["items", i, "serviceId"] });
    seen.add(key);
  });
}

export const bookingSchema = z
  .object({
    groomerId: uuid,
    date: bookingDate,
    startTime: gridTime,
    durationMin: duration,
    client: z.discriminatedUnion("mode", [existingClient, newClient, noClient], { error: "required" }),
    items: z.array(bookingItemSchema).min(1, { error: "itemsRequired" }).max(6, { error: "invalid" }),
    notes: optionalText(2000),
    /** Shared services to save as the family's usual price (totals for all pets). */
    rememberFamily: z
      .array(z.object({ serviceId: uuid, durationMin: duration, price }))
      .max(6)
      .optional()
      .default([]),
    /** The owner confirmed saving on top of another visit ("Vis tiek registruoti"). */
    allowOverlap: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => noDuplicateItems(value.items, ctx));

export type BookingInput = z.input<typeof bookingSchema>;
export type BookingData = z.output<typeof bookingSchema>;

/**
 * Change an existing visit (owner feedback 2026-10-19): its services — another service,
 * another price, one pet ↔ several, one shared service ↔ a row per pet — and its time.
 * The client stays. The date may be in the past only if it is not changed (checked in
 * the action, which knows the booking's current date).
 */
export const updateBookingSchema = z
  .object({
    id: uuid,
    groomerId: uuid,
    date: dateStr,
    startTime: gridTime,
    durationMin: duration,
    items: z.array(bookingItemSchema).min(1, { error: "itemsRequired" }).max(6, { error: "invalid" }),
    notes: optionalText(2000),
    rememberFamily: z
      .array(z.object({ serviceId: uuid, durationMin: duration, price }))
      .max(6)
      .optional()
      .default([]),
    /** The owner confirmed saving on top of another visit ("Vis tiek registruoti"). */
    allowOverlap: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => noDuplicateItems(value.items, ctx));
export type UpdateBookingInput = z.input<typeof updateBookingSchema>;

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
  /** The owner confirmed saving on top of another visit ("Vis tiek registruoti"). */
  allowOverlap: z.boolean().optional().default(false),
});
export type RescheduleInput = z.input<typeof rescheduleSchema>;

/**
 * US-16: blocked time ("Nedarbo laikas") for one or both groomers, on one date or over
 * several days (`date` … `dateTo`, e.g. a vacation). One row per groomer and day, all
 * or nothing; the same exclusion constraint as bookings keeps it from overlapping.
 */
export const blockSchema = z
  .object({
    groomerIds: z
      .array(uuid)
      .min(1, { error: "required" })
      .max(10, { error: "invalid" })
      .refine((ids) => new Set(ids).size === ids.length, { error: "invalid" }),
    date: bookingDate,
    /** Last day of the period; empty or missing = the same day as `date`. */
    dateTo: z.preprocess((v) => (v === "" || v === null ? undefined : v), dateStr.optional()),
    startTime: gridTime,
    endTime: gridTime,
    reason: optionalText(200),
  })
  .superRefine((v, ctx) => {
    if (isTimeStr(v.startTime) && isTimeStr(v.endTime)) {
      if (timeToMinutes(v.endTime) <= timeToMinutes(v.startTime))
        ctx.addIssue({ code: "custom", message: "endBeforeStart", path: ["endTime"] });
    }
    if (v.dateTo !== undefined && isDateStr(v.date) && isDateStr(v.dateTo)) {
      if (v.dateTo < v.date) ctx.addIssue({ code: "custom", message: "dateToBeforeFrom", path: ["dateTo"] });
      else if (datesBetween(v.date, v.dateTo).length > BLOCK_MAX_DAYS)
        ctx.addIssue({ code: "custom", message: "periodTooLong", path: ["dateTo"] });
    }
  })
  .transform(({ dateTo, ...v }) => ({ ...v, dateTo: dateTo ?? v.date }));
export type BlockInput = z.input<typeof blockSchema>;

/** Visit results the owner can record (US-11). */
export const VISIT_RESULTS = ["completed", "no_show", "cancelled"] as const;
export type VisitResult = (typeof VISIT_RESULTS)[number];

/**
 * US-11: result of a visit — status, actual price and notes per item. The actual
 * price is required when the visit took place; for no-show / cancelled it is cleared.
 */
export const completeVisitSchema = z
  .object({
    id: uuid,
    status: z.enum(VISIT_RESULTS, { error: "required" }),
    items: z
      .array(
        z.object({
          id: uuid,
          actualPrice: z.union([price, z.null()]).optional().default(null),
          visitNotes: optionalText(2000),
        }),
      )
      .max(12, { error: "invalid" }),
  })
  .superRefine((value, ctx) => {
    if (value.status !== "completed") return;
    value.items.forEach((item, i) => {
      if (item.actualPrice === null)
        ctx.addIssue({ code: "custom", message: "required", path: ["items", i, "actualPrice"] });
    });
  });
export type CompleteVisitInput = z.input<typeof completeVisitSchema>;
