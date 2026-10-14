/**
 * Map Postgres / PostgREST error codes to message keys in messages/lt.json
 * ("errors.*"). Server Actions use this so the owner never sees raw DB errors.
 */
export type DbErrorKind = "slotTaken" | "invalid" | "notFound" | "unauthorized" | "unknown";

export function classifyDbError(error: { code?: string | null } | null | undefined): DbErrorKind {
  switch (error?.code) {
    case "23P01": // exclusion_violation — groomer double-booked (US-09)
      return "slotTaken";
    case "23514": // check_violation
    case "23505": // unique_violation (e.g. same phone twice)
    case "22023": // invalid_parameter_value (RPC input)
    case "22P02": // invalid_text_representation
      return "invalid";
    case "P0002":
    case "PGRST116": // no rows for .single()
      return "notFound";
    case "42501": // RLS / privilege
    case "PGRST301": // JWT expired
      return "unauthorized";
    default:
      return "unknown";
  }
}

/** Uniform result type for every Server Action (§15). */
export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };
