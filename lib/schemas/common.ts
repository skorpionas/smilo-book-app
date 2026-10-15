import { z } from "zod";
import { parseEur } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";
import { isDateStr, isTimeStr, isValidDuration, timeToMinutes } from "@/lib/time";

/**
 * Shared building blocks for the zod schemas. Every error message is a key in
 * the `errors` namespace of messages/lt.json; Server Actions translate them.
 */
export type ErrorKey =
  | "required"
  | "tooLong"
  | "invalidPhone"
  | "invalidEmail"
  | "invalidDate"
  | "invalidTime"
  | "offGrid"
  | "invalidDuration"
  | "invalidPrice"
  | "invalidWeight"
  | "futureDate"
  | "invalidColor"
  | "itemsRequired"
  | "invalid";

const err = (key: ErrorKey) => ({ error: key });

/** Form values arrive as strings (or null when the field is missing). */
const str = z.preprocess((v) => (v === null || v === undefined ? "" : v), z.string(err("invalid")));

export const requiredText = (max: number, min = 1) =>
  str.pipe(z.string().trim().min(min, err("required")).max(max, err("tooLong")));

export const optionalText = (max: number) => str.pipe(z.string().trim().max(max, err("tooLong")));

export const uuid = z.uuid(err("invalid"));

/** "" -> null, otherwise normalised to E.164 (default country LT). */
export const optionalPhone = str.transform((value, ctx) => {
  if (!value.trim()) return null;
  const e164 = normalizePhone(value);
  if (!e164) {
    ctx.addIssue({ code: "custom", message: "invalidPhone" });
    return z.NEVER;
  }
  return e164;
});

export const optionalEmail = str.transform((value, ctx) => {
  const v = value.trim();
  if (!v) return null;
  if (v.length > 254 || !z.email().safeParse(v).success) {
    ctx.addIssue({ code: "custom", message: "invalidEmail" });
    return z.NEVER;
  }
  return v.toLowerCase();
});

/** "40", "40,5", "40,50 €" or a number -> 40.5 (0 … 9 999,99). */
export const price = z.union([z.number(), str]).transform((value, ctx) => {
  const n = typeof value === "number" ? value : parseEur(value);
  if (n === null || !Number.isFinite(n) || n < 0 || n > 9999.99) {
    ctx.addIssue({ code: "custom", message: "invalidPrice" });
    return z.NEVER;
  }
  return Math.round(n * 100) / 100;
});

/** Minutes, 15 … 600, multiple of 15. Accepts "90" or 90. */
export const duration = z.union([z.number(), str]).transform((value, ctx) => {
  const n = typeof value === "number" ? value : Number(value);
  if (!isValidDuration(n)) {
    ctx.addIssue({ code: "custom", message: "invalidDuration" });
    return z.NEVER;
  }
  return n;
});

export const dateStr = str.refine(isDateStr, err("invalidDate"));

export const gridTime = str.superRefine((t, ctx) => {
  if (!isTimeStr(t)) ctx.addIssue({ code: "custom", message: "invalidTime" });
  else if (timeToMinutes(t) % 15 !== 0) ctx.addIssue({ code: "custom", message: "offGrid" });
});

export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

/** Flatten zod issues to { field: errorKey }, first issue per field wins. */
export function issuesToFieldErrors(issues: readonly z.core.$ZodIssue[]): Record<string, ErrorKey> {
  const out: Record<string, ErrorKey> = {};
  for (const issue of issues) {
    const path = issue.path.map(String).join(".") || "_form";
    if (!(path in out)) out[path] = toErrorKey(issue.message);
  }
  return out;
}

const KNOWN = new Set<string>([
  "required",
  "tooLong",
  "invalidPhone",
  "invalidEmail",
  "invalidDate",
  "invalidTime",
  "offGrid",
  "invalidDuration",
  "invalidPrice",
  "invalidWeight",
  "futureDate",
  "invalidColor",
  "itemsRequired",
  "invalid",
]);

function toErrorKey(message: string): ErrorKey {
  return KNOWN.has(message) ? (message as ErrorKey) : "invalid";
}
