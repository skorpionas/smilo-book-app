import { describe, expect, it } from "vitest";
import { formatVisitDate, mergeVisits, summarizeVisits } from "@/lib/visits";

const now = new Date("2026-10-16T10:00:00Z");

describe("summarizeVisits", () => {
  it("keeps the latest completed and the earliest scheduled visit per pet", () => {
    const map = summarizeVisits(
      [
        { pet_id: "a", bookings: { start_at: "2026-09-01T08:00:00Z", status: "completed" } },
        { pet_id: "a", bookings: { start_at: "2026-10-01T08:00:00Z", status: "completed" } },
        { pet_id: "a", bookings: { start_at: "2026-11-20T08:00:00Z", status: "scheduled" } },
        { pet_id: "a", bookings: { start_at: "2026-10-21T08:00:00Z", status: "scheduled" } },
        { pet_id: "a", bookings: { start_at: "2026-10-10T08:00:00Z", status: "cancelled" } },
        { pet_id: "b", bookings: { start_at: "2026-10-12T08:00:00Z", status: "scheduled" } }, // past, not done
        { pet_id: "c", bookings: null },
      ],
      now,
    );
    expect(map.get("a")).toEqual({ last: "2026-10-01", next: "2026-10-21" });
    expect(map.has("b")).toBe(false);
    expect(map.has("c")).toBe(false);
  });

  it("uses the Vilnius date", () => {
    const map = summarizeVisits(
      [{ pet_id: "a", bookings: { start_at: "2026-10-01T22:30:00Z", status: "completed" } }],
      now,
    );
    expect(map.get("a")?.last).toBe("2026-10-02");
  });
});

describe("mergeVisits", () => {
  it("takes the latest last and the earliest next", () => {
    expect(
      mergeVisits([
        { last: "2026-09-01", next: "2026-11-01" },
        undefined,
        { last: "2026-10-01", next: "2026-10-20" },
        { last: null, next: null },
      ]),
    ).toEqual({ last: "2026-10-01", next: "2026-10-20" });
  });
});

describe("formatVisitDate", () => {
  it("drops the year for this year only", () => {
    expect(formatVisitDate("2026-10-21", "2026-10-16")).toBe("spalio 21 d.");
    expect(formatVisitDate("2025-03-14", "2026-10-16")).toBe("2025-03-14");
  });
});
