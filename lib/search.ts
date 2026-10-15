/** Lower-case, accent-free form for local matching ("Žuikis" -> "zuikis"), like the DB's f_search_norm. */
export function searchNorm(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/** Digits only ("612 34" -> "61234"), for matching any part of a phone number. */
export function searchDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Local match used by the clients list (US-14 rules): name or pet name contains
 * the accent-free query, or the phone contains the typed digits (≥ 2).
 */
export function matchesClient(
  client: { fullName: string; phone: string | null; petNames: string[] },
  query: string,
): boolean {
  const q = searchNorm(query);
  if (q.length < 2) return true;
  if (searchNorm(client.fullName).includes(q)) return true;
  if (client.petNames.some((n) => searchNorm(n).includes(q))) return true;
  const digits = searchDigits(query);
  return digits.length >= 2 && digits.length === query.replace(/[\s+\-()]/g, "").length
    ? (client.phone ?? "").includes(digits)
    : false;
}
