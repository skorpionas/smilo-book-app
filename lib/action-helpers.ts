import "server-only";
import * as Sentry from "@sentry/nextjs";
import { getTranslations } from "next-intl/server";
import type { z } from "zod";
import { classifyDbError } from "@/lib/db-errors";
import { issuesToFieldErrors } from "@/lib/schemas/common";

/**
 * State returned by every form Server Action used with useActionState.
 * `savedAt` changes on each success so the sheet can close and toast once.
 */
export type ActionState = {
  ok?: boolean;
  savedAt?: number;
  id?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};
export type FormState = ActionState | null;

/** Translate zod issues into Lithuanian field errors. */
export async function validationFailed(issues: readonly z.core.$ZodIssue[]): Promise<ActionState> {
  const t = await getTranslations("errors");
  const keys = issuesToFieldErrors(issues);
  const fieldErrors: Record<string, string> = {};
  for (const [field, key] of Object.entries(keys)) fieldErrors[field] = t(key);
  return { ok: false, error: t("checkFields"), fieldErrors };
}

/** Map a Supabase / Postgres error to a Lithuanian message; logs metadata only (no personal data). */
export async function dbFailed(
  error: { code?: string | null; message?: string } | null | undefined,
  context: string,
  overrides: Partial<Record<string, string>> = {},
): Promise<ActionState> {
  const t = await getTranslations("errors");
  console.error(`[action] ${context} failed`, { code: error?.code });
  if (error?.code && overrides[error.code]) return { ok: false, error: overrides[error.code] };
  const kind = classifyDbError(error);
  // Expected outcomes (slot taken, invalid input, not found) are not bugs; the rest goes
  // to Sentry with the error code only — never the message, which can quote data.
  if (kind === "unknown") {
    Sentry.captureMessage(`[action] ${context} failed`, {
      level: "error",
      tags: { code: error?.code ?? "none" },
    });
  }
  const key = kind === "slotTaken" ? "unknown" : kind;
  return { ok: false, error: t(key) };
}

/** Read a FormData into a plain object (single values only). */
export function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  }
  return out;
}
