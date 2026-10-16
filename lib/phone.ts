import { parsePhoneNumberFromString } from "libphonenumber-js/min";

/**
 * Normalise a phone number typed by the owner to E.164, default country LT.
 * Accepts "+370 612 34567", "8 612 34567", "861234567", "612 34567", "0037061234567".
 * Returns null when the number is not valid.
 */
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  let candidate = raw.replace(/[\s\-().]/g, "");
  if (candidate.startsWith("00")) candidate = `+${candidate.slice(2)}`;
  // Lithuanian national trunk prefix "8" (8 6xx xxxxx) -> +370 6xx xxxxx
  if (/^8\d{8}$/.test(candidate)) candidate = `+370${candidate.slice(1)}`;

  const parsed = parsePhoneNumberFromString(candidate, "LT");
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

/** "+37061234567" -> "+370 612 34567" for display. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}

/** Digits only, for `tel:` links and phone search. */
export function phoneDigits(input: string): string {
  return input.replace(/\D/g, "");
}

/**
 * How a family (account) is shown: the owner's name, else the phone, else the
 * e-mail, else its pets' names ("Bim, Bom"). Same order as SQL client_label().
 */
export function contactLabel(c: {
  full_name?: string | null;
  phone_e164?: string | null;
  email?: string | null;
  pets?: { name: string; archived_at?: string | null }[];
}): string {
  return (
    c.full_name?.trim() ||
    formatPhone(c.phone_e164) ||
    c.email?.trim() ||
    (c.pets ?? [])
      .filter((p) => !p.archived_at)
      .map((p) => p.name)
      .sort((a, b) => a.localeCompare(b, "lt"))
      .join(", ")
  );
}
