import { describe, expect, it } from "vitest";
import { ageParts, DURATION_OPTIONS, formatAge, formatDuration } from "@/lib/format";
import { matchesClient, searchDigits, searchNorm } from "@/lib/search";
import lt from "@/messages/lt.json";

// Minimal ICU-free translator over the real `units` messages.
const tu = (key: keyof typeof lt.units, values: Record<string, number> = {}) =>
  lt.units[key].replace(/\{(\w+)\}/g, (_, k: string) => String(values[k]));

describe("formatDuration", () => {
  it.each([
    [45, "45 min."],
    [60, "1 val."],
    [90, "1 val. 30 min."],
    [120, "2 val."],
    [600, "10 val."],
  ])("%i -> %s", (min, text) => {
    expect(formatDuration(tu, min)).toBe(text);
  });

  it("offers 15 min … 10 h in 15-min steps", () => {
    expect(DURATION_OPTIONS[0]).toBe(15);
    expect(DURATION_OPTIONS.at(-1)).toBe(600);
    expect(DURATION_OPTIONS.every((m) => m % 15 === 0)).toBe(true);
  });
});

describe("pet age", () => {
  it("counts whole months and years", () => {
    expect(ageParts(2020, 5, "2026-10-15")).toEqual({ years: 6, months: 77 });
    expect(ageParts(2026, 5, "2026-10-15")).toEqual({ years: 0, months: 5 });
    expect(ageParts(2020, 11, "2026-10-15")).toEqual({ years: 5, months: 71 });
    expect(ageParts(2026, 11, "2026-10-15")).toBeNull();
    expect(ageParts(2020, null, "2026-10-15")).toEqual({ years: 6, months: null });
    expect(ageParts(2027, null, "2026-10-15")).toBeNull();
    expect(ageParts(2020, null, "bad")).toBeNull();
  });

  it("formats years or months", () => {
    expect(formatAge(tu, 2020, 5, "2026-10-15")).toBe("6 m.");
    expect(formatAge(tu, 2020, null, "2026-10-15")).toBe("6 m.");
    expect(formatAge(tu, 2026, 5, "2026-10-15")).toBe("5 mėn.");
    expect(formatAge(tu, 2026, null, "2026-10-15")).toBe("iki 1 m.");
    expect(formatAge(tu, 2027, 1, "2026-10-15")).toBe("");
  });
});

describe("local client search", () => {
  const rasa = { fullName: "Rasa Petrauskienė", phone: "+37061234567", petNames: ["Žuikis", "Maksas"] };

  it("normalises accents and case", () => {
    expect(searchNorm("  Žuikis ")).toBe("zuikis");
    expect(searchDigits("+370 612-34")).toBe("37061234");
  });

  it.each([
    ["", true],
    ["r", true], // under 2 characters shows everything
    ["petrausk", true],
    ["PETRAUSKIENE", true],
    ["zuikis", true],
    ["maks", true],
    ["612 34", true],
    ["+370 612", true],
    ["999", false],
    ["Jonas", false],
  ])("%j -> %s", (q, expected) => {
    expect(matchesClient(rasa, q)).toBe(expected);
  });

  it("does not match digits against a client without a phone", () => {
    expect(matchesClient({ ...rasa, phone: null }, "612")).toBe(false);
  });
});
