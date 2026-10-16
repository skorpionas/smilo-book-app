/**
 * One service for several pets (owner feedback 2026-10-16) is stored as one row per
 * pet, so each pet keeps its own history and price memory. These helpers split the
 * total fairly: equal parts, any remainder on the first pet.
 */

/** 50 € for 3 pets → [16.68, 16.66, 16.66] (cents exact, sum unchanged). */
export function splitPrice(total: number, parts: number): number[] {
  if (parts <= 1) return [round2(total)];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / parts);
  const first = cents - base * (parts - 1);
  return [first, ...Array(parts - 1).fill(base)].map((c) => c / 100);
}

/**
 * Split minutes on the 15-minute grid: every part ≥ 15, parts after the first get
 * total / parts rounded down to 15, the first takes the rest.
 * 120 min for 2 → [60, 60]; for 3 → [60, 30, 30]; 30 min for 3 → [15, 15, 15].
 * (The booking's own length is the total either way.)
 */
export function splitDuration(total: number, parts: number): number[] {
  if (parts <= 1) return [total];
  const base = Math.max(15, Math.floor(total / parts / 15) * 15);
  const first = Math.max(15, total - base * (parts - 1));
  return [first, ...Array(parts - 1).fill(base)];
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
