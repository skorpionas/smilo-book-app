import { describe, expect, it } from "vitest";
import { formatEur, parseEur } from "@/lib/money";
import { formatPhone, normalizePhone, phoneDigits } from "@/lib/phone";

describe("normalizePhone", () => {
  it.each([
    ["8 612 34567", "+37061234567"],
    ["+37061234567", "+37061234567"],
    ["612 34567", "+37061234567"],
    ["+370 (612) 34-567", "+37061234567"],
    ["0037061234567", "+37061234567"],
    ["861234567", "+37061234567"],
    ["+48 512 345 678", "+48512345678"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "   ", "123", "abc", "+370 1"])("rejects %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("formats for display and extracts digits", () => {
    expect(formatPhone("+37061234567")).toBe("+370 612 34567");
    expect(formatPhone(null)).toBe("");
    expect(formatPhone("garbage")).toBe("garbage");
    expect(phoneDigits("+370 612 34")).toBe("37061234");
  });
});

describe("money", () => {
  it("formats EUR the Lithuanian way", () => {
    expect(formatEur(40)).toBe("40,00 €");
    expect(formatEur("45.5")).toBe("45,50 €");
    expect(formatEur(1234.5)).toBe("1 234,50 €");
    expect(formatEur(null)).toBe("");
    expect(formatEur("x")).toBe("");
  });

  it("parses typed prices", () => {
    expect(parseEur("40")).toBe(40);
    expect(parseEur("40,5")).toBe(40.5);
    expect(parseEur("40.50 €")).toBe(40.5);
    expect(parseEur("-1")).toBeNull();
    expect(parseEur("10000")).toBeNull();
    expect(parseEur("4,555")).toBeNull();
  });
});
