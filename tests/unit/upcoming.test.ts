import { describe, expect, it } from "vitest";
import { UPCOMING_DAYS, groupUpcoming } from "@/lib/upcoming";

type B = { id: string; kind: "booking" | "block"; status: string; date: string; startTime: string };
const b = (id: string, date: string, startTime: string, extra: Partial<B> = {}): B => ({
  id,
  kind: "booking",
  status: "scheduled",
  date,
  startTime,
  ...extra,
});

describe("groupUpcoming", () => {
  it("covers 14 days", () => {
    expect(UPCOMING_DAYS).toBe(14);
  });

  it("groups by date ascending and sorts by start time", () => {
    const groups = groupUpcoming(
      [
        b("c", "2026-10-17", "09:00"),
        b("a", "2026-10-16", "14:00"),
        b("b", "2026-10-16", "08:30"),
        b("d", "2026-10-17", "08:00"),
      ],
      "2026-10-16",
    );
    expect(groups.map((g) => g.date)).toEqual(["2026-10-16", "2026-10-17"]);
    expect(groups[0].bookings.map((x) => x.id)).toEqual(["b", "a"]);
    expect(groups[1].bookings.map((x) => x.id)).toEqual(["d", "c"]);
  });

  it("leaves out blocked time, cancelled bookings and empty days", () => {
    const groups = groupUpcoming(
      [
        b("block", "2026-10-16", "12:00", { kind: "block" }),
        b("cancelled", "2026-10-18", "10:00", { status: "cancelled" }),
        b("done", "2026-10-16", "08:00", { status: "completed" }),
        b("noshow", "2026-10-16", "09:00", { status: "no_show" }),
      ],
      "2026-10-16",
    );
    expect(groups).toEqual([
      {
        date: "2026-10-16",
        bookings: [expect.objectContaining({ id: "done" }), expect.objectContaining({ id: "noshow" })],
      },
    ]);
  });

  it("keeps only [from, from + 14 days), across the DST change", () => {
    const groups = groupUpcoming(
      [
        b("before", "2026-10-15", "10:00"),
        b("first", "2026-10-16", "10:00"),
        b("dst", "2026-10-25", "10:00"),
        b("last", "2026-10-29", "18:00"),
        b("after", "2026-10-30", "08:00"),
      ],
      "2026-10-16",
    );
    expect(groups.flatMap((g) => g.bookings.map((x) => x.id))).toEqual(["first", "dst", "last"]);
  });
});
