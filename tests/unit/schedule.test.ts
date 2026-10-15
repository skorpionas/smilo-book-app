import { describe, expect, it } from "vitest";
import { formatWorkDays } from "@/lib/clock";
import { isoWeekdayOf, lanesForDate, worksOn } from "@/lib/schedule";
import { addMonths, isoWeekNumber, monthTitle, monthWeeks, startOfMonth } from "@/lib/time";
import lt from "@/messages/lt.json";

const A = { id: "a", name: "Rasa", workDays: [1, 2, 3, 4, 5, 6] };
const B = { id: "b", name: "Ieva", workDays: [1] };
const short = (d: number) => lt.weekdays.short[String(d) as keyof typeof lt.weekdays.short];

describe("working days", () => {
  it("reads the ISO weekday of a date", () => {
    expect(isoWeekdayOf("2026-10-19")).toBe(1); // Monday
    expect(isoWeekdayOf("2026-10-24")).toBe(6);
    expect(isoWeekdayOf("2026-10-25")).toBe(7); // Sunday, DST change day
  });

  it("knows whether a groomer works on a date", () => {
    expect(worksOn(B, "2026-10-19")).toBe(true);
    expect(worksOn(B, "2026-10-20")).toBe(false);
  });

  it("shows only the groomers working that weekday, in order", () => {
    expect(lanesForDate([A, B], "2026-10-19", []).map((l) => [l.id, l.offDay])).toEqual([
      ["a", false],
      ["b", false],
    ]);
    expect(lanesForDate([A, B], "2026-10-20", []).map((l) => l.id)).toEqual(["a"]);
    expect(lanesForDate([A, B], "2026-10-25", [])).toEqual([]);
  });

  it("keeps an off-day lane when something is booked for that groomer", () => {
    const lanes = lanesForDate([A, B], "2026-10-21", new Set(["b"]));
    expect(lanes.map((l) => [l.id, l.offDay])).toEqual([
      ["a", false],
      ["b", true],
    ]);
    expect(lanesForDate([A, B], "2026-10-25", ["a"]).map((l) => [l.id, l.offDay])).toEqual([["a", true]]);
  });

  it("formats weekday sets compactly", () => {
    expect(formatWorkDays([1, 2, 3, 4, 5, 6], short)).toBe("Pr–Št");
    expect(formatWorkDays([5, 1, 3], short)).toBe("Pr, Tr, Pn");
    expect(formatWorkDays([1, 2, 4, 5, 6], short)).toBe("Pr, An, Kt–Št");
    expect(formatWorkDays([6, 7], short)).toBe("Št, Sk");
    expect(formatWorkDays([], short)).toBe("");
  });
});

describe("month helpers", () => {
  it("finds the first of the month and adds months with clamping", () => {
    expect(startOfMonth("2026-10-15")).toBe("2026-10-01");
    expect(addMonths("2026-10-01", 1)).toBe("2026-11-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
    expect(() => startOfMonth("2026-13-01")).toThrow();
  });

  it("covers the month with Monday–Sunday weeks", () => {
    const weeks = monthWeeks("2026-10-15"); // Oct 2026 starts on Thursday
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]).toBe("2026-09-28");
    expect(weeks.at(-1)![6]).toBe("2026-11-01");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(monthWeeks("2027-02-10")).toHaveLength(4); // Feb 2027: Mon 1st … Sun 28th
    expect(monthWeeks("2027-02-10")[0][0]).toBe("2027-02-01");
    expect(monthWeeks("2026-03-01")).toHaveLength(6); // Mar 2026 starts on Sunday
  });

  it("names weeks and months", () => {
    expect(isoWeekNumber("2026-10-15")).toBe(42);
    expect(isoWeekNumber("2027-01-01")).toBe(53);
    expect(monthTitle("2026-10-01")).toBe("2026 m. spalis");
    expect(() => monthTitle("nope")).toThrow();
  });
});
