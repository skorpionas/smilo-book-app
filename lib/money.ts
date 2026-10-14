const eur = new Intl.NumberFormat("lt-LT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 40 -> "40,00 €" (Lithuanian format). */
export function formatEur(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "";
  // Intl uses a narrow no-break space before €; normalise to a regular one.
  return eur.format(n).replace(/ | /g, " ");
}

/** Accept "40", "40,5", "40.50", "40,50 €" -> 40.5. Returns null if invalid. */
export function parseEur(input: string): number | null {
  const cleaned = input.replace(/[€\s  ]/g, "").replace(",", ".");
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100) / 100;
}
