import { describe, expect, it } from "vitest";
import {
  DEFAULT_WINDOW,
  GRID_ROWS,
  edgeLabel,
  gridWindowFor,
  windowRows,
  addDays,
  dayBoundsUtc,
  durationMinutes,
  formatDateTime,
  gridPosition,
  isDateStr,
  isOnGrid,
  isTimeStr,
  isValidDuration,
  isoWeekday,
  minutesToTime,
  parseDateParam,
  snapMinutes,
  snapTime,
  startOfWeek,
  timeToMinutes,
  toVilniusDate,
  toVilniusTime,
  todayInVilnius,
  vilniusMinutesOfDay,
  vilniusToUtc,
  weekDays,
} from "@/lib/time";

const H = 60 * 60 * 1000;

describe("vilniusToUtc / toVilnius*", () => {
  it("converts summer time (EEST, UTC+3)", () => {
    expect(vilniusToUtc("2026-10-20", "10:00").toISOString()).toBe("2026-10-20T07:00:00.000Z");
  });

  it("converts winter time (EET, UTC+2)", () => {
    expect(vilniusToUtc("2026-11-02", "10:00").toISOString()).toBe("2026-11-02T08:00:00.000Z");
  });

  it("round-trips an instant to Vilnius date and time", () => {
    const d = new Date("2026-10-19T21:30:00Z"); // 00:30 next day in Vilnius
    expect(toVilniusDate(d)).toBe("2026-10-20");
    expect(toVilniusTime(d)).toBe("00:30");
    expect(formatDateTime("2026-10-19T21:30:00Z")).toBe("2026-10-20 00:30");
  });

  it("resolves the ambiguous fall-back hour deterministically (winter time)", () => {
    // 2026-10-25: 04:00 EEST -> 03:00 EET, so 03:30 happens twice.
    expect(vilniusToUtc("2026-10-25", "03:30").toISOString()).toBe("2026-10-25T01:30:00.000Z");
  });

  it("shifts a non-existent spring-forward time forward", () => {
    // 2027-03-28: 03:00 EET -> 04:00 EEST, 03:30 does not exist.
    const d = vilniusToUtc("2027-03-28", "03:30");
    expect(toVilniusTime(d)).toBe("04:30");
  });

  it("rejects invalid input", () => {
    expect(() => vilniusToUtc("2026-02-30", "10:00")).toThrow();
    expect(() => vilniusToUtc("2026-10-20", "25:00")).toThrow();
    expect(() => toVilniusDate("nope")).toThrow();
  });
});

describe("day bounds and DST day lengths", () => {
  it("2026-10-25 is a 25-hour day", () => {
    const { start, end } = dayBoundsUtc("2026-10-25");
    expect(end.getTime() - start.getTime()).toBe(25 * H);
  });

  it("2027-03-28 is a 23-hour day", () => {
    const { start, end } = dayBoundsUtc("2027-03-28");
    expect(end.getTime() - start.getTime()).toBe(23 * H);
  });

  it("an ordinary day is 24 hours", () => {
    const { start, end } = dayBoundsUtc("2026-10-20");
    expect(start.toISOString()).toBe("2026-10-19T21:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(24 * H);
  });

  it("measures real elapsed minutes across the DST change", () => {
    expect(durationMinutes("2026-10-24T23:00:00Z", "2026-10-25T01:00:00Z")).toBe(120);
    // wall clock 02:00 -> 03:00 on fall-back day, but 2 real hours
    expect(durationMinutes(vilniusToUtc("2026-10-25", "02:00"), new Date("2026-10-25T01:00:00Z"))).toBe(120);
  });
});

describe("calendar arithmetic", () => {
  it("adds days across month, year and DST boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
    expect(addDays("2026-10-20", -7)).toBe("2026-10-13");
  });

  it("weeks start on Monday", () => {
    expect(startOfWeek("2026-10-25")).toBe("2026-10-19"); // Sunday -> Monday before
    expect(startOfWeek("2026-10-19")).toBe("2026-10-19");
    expect(weekDays("2026-10-21")).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
    expect(isoWeekday("2026-10-19")).toBe(1);
    expect(isoWeekday("2026-10-25")).toBe(7);
  });

  it("today follows Vilnius, not UTC", () => {
    expect(todayInVilnius(new Date("2026-10-19T22:30:00Z"))).toBe("2026-10-20");
    expect(todayInVilnius(new Date("2026-10-19T20:30:00Z"))).toBe("2026-10-19");
  });

  it("parses the ?date= param with a fallback", () => {
    const now = new Date("2026-10-19T08:00:00Z");
    expect(parseDateParam("2026-11-02", now)).toBe("2026-11-02");
    expect(parseDateParam(["2026-11-03"], now)).toBe("2026-11-03");
    expect(parseDateParam("2026-13-01", now)).toBe("2026-10-19");
    expect(parseDateParam(undefined, now)).toBe("2026-10-19");
  });

  it("validates date and time strings", () => {
    expect(isDateStr("2026-10-19")).toBe(true);
    expect(isDateStr("2026-2-1")).toBe(false);
    expect(isDateStr("2027-02-29")).toBe(false);
    expect(isDateStr(20261019)).toBe(false);
    expect(isTimeStr("08:15")).toBe(true);
    expect(isTimeStr("8:15")).toBe(false);
    expect(isTimeStr("24:00")).toBe(false);
  });
});

describe("15-minute grid", () => {
  it("converts between minutes and HH:mm", () => {
    expect(timeToMinutes("08:00")).toBe(480);
    expect(minutesToTime(1425)).toBe("23:45");
    expect(() => minutesToTime(1440)).toThrow();
    expect(() => minutesToTime(7.5)).toThrow();
    expect(() => timeToMinutes("8")).toThrow();
  });

  it("snaps minutes and times", () => {
    expect(snapMinutes(67)).toBe(60);
    expect(snapMinutes(68)).toBe(75);
    expect(snapMinutes(61, "ceil")).toBe(75);
    expect(snapMinutes(74, "floor")).toBe(60);
    expect(snapTime("10:07")).toBe("10:00");
    expect(snapTime("10:08")).toBe("10:15");
    expect(snapTime("23:59")).toBe("23:45");
  });

  it("checks instants and durations against the grid", () => {
    expect(isOnGrid(vilniusToUtc("2026-10-20", "10:15"))).toBe(true);
    expect(isOnGrid("2026-10-20T07:05:00Z")).toBe(false);
    expect(isValidDuration(90)).toBe(true);
    expect(isValidDuration(100)).toBe(false);
    expect(isValidDuration(0)).toBe(false);
    expect(isValidDuration(615)).toBe(false);
  });

  it("has 44 rows for 08:00–19:00", () => {
    expect(GRID_ROWS).toBe(44);
  });

  it("positions bookings in the day grid", () => {
    const pos = gridPosition(
      vilniusToUtc("2026-10-20", "10:00"),
      vilniusToUtc("2026-10-20", "12:00"),
      "2026-10-20",
    );
    expect(pos).toEqual({ row: 8, span: 8 });
  });

  it("clips bookings to the visible window", () => {
    expect(
      gridPosition(vilniusToUtc("2026-10-20", "07:00"), vilniusToUtc("2026-10-20", "09:00"), "2026-10-20"),
    ).toEqual({ row: 0, span: 4 });
    expect(
      gridPosition(vilniusToUtc("2026-10-20", "18:30"), vilniusToUtc("2026-10-20", "20:00"), "2026-10-20"),
    ).toEqual({ row: 42, span: 2 });
    expect(
      gridPosition(vilniusToUtc("2026-10-20", "19:00"), vilniusToUtc("2026-10-20", "20:00"), "2026-10-20"),
    ).toBeNull();
    expect(
      gridPosition(vilniusToUtc("2026-10-21", "10:00"), vilniusToUtc("2026-10-21", "11:00"), "2026-10-20"),
    ).toBeNull();
  });

  it("shows a late booking when the window is widened", () => {
    const late = gridWindowFor([{ from: 20 * 60, to: 21 * 60 + 30 }]);
    expect(late).toEqual({ open: 8 * 60, close: 22 * 60 });
    expect(
      gridPosition(
        vilniusToUtc("2026-10-20", "20:00"),
        vilniusToUtc("2026-10-20", "21:30"),
        "2026-10-20",
        late,
      ),
    ).toEqual({ row: 48, span: 6 });
  });

  it("widens the window to whole hours, never narrower than 08:00–19:00", () => {
    expect(gridWindowFor([])).toEqual(DEFAULT_WINDOW);
    expect(gridWindowFor([{ from: 9 * 60, to: 10 * 60 }])).toEqual(DEFAULT_WINDOW);
    expect(
      gridWindowFor([
        { from: 6 * 60 + 30, to: 8 * 60 },
        { from: 18 * 60, to: 19 * 60 + 15 },
      ]),
    ).toEqual({
      open: 6 * 60,
      close: 20 * 60,
    });
    // a block running past midnight stops at 24:00
    expect(gridWindowFor([{ from: 22 * 60, to: 24 * 60 }]).close).toBe(24 * 60);
    expect(windowRows({ open: 6 * 60, close: 20 * 60 })).toBe(56);
    expect(edgeLabel(24 * 60)).toBe("24:00");
  });

  it("handles multi-day blocks", () => {
    // holiday from previous day to next day covers the full window
    expect(
      gridPosition(vilniusToUtc("2026-10-19", "08:00"), vilniusToUtc("2026-10-21", "19:00"), "2026-10-20"),
    ).toEqual({ row: 0, span: 44 });
  });

  it("renders the DST day by wall clock", () => {
    expect(
      gridPosition(vilniusToUtc("2026-10-25", "09:00"), vilniusToUtc("2026-10-25", "10:30"), "2026-10-25"),
    ).toEqual({ row: 4, span: 6 });
    expect(vilniusMinutesOfDay(vilniusToUtc("2026-10-25", "09:00"))).toBe(540);
  });
});

describe("weekdayName", () => {
  it("names weekdays in Lithuanian", async () => {
    const { weekdayName } = await import("@/lib/time");
    expect(weekdayName("2026-10-19")).toBe("pirmadienis");
    expect(weekdayName("2026-10-25")).toBe("sekmadienis");
    expect(() => weekdayName("x")).toThrow();
  });
});
