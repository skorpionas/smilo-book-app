import { describe, expect, it } from "vitest";
import { splitDuration, splitPrice } from "@/lib/split";

describe("one service for several pets: split per pet", () => {
  it("splits the price in exact cents, remainder on the first pet", () => {
    expect(splitPrice(50, 2)).toEqual([25, 25]);
    expect(splitPrice(50, 3)).toEqual([16.68, 16.66, 16.66]);
    expect(splitPrice(0, 3)).toEqual([0, 0, 0]);
    expect(splitPrice(40, 1)).toEqual([40]);
    const parts = splitPrice(99.99, 4);
    expect(Math.round(parts.reduce((a, b) => a + b, 0) * 100)).toBe(9999);
  });

  it("splits minutes on the 15-minute grid, each part at least 15", () => {
    expect(splitDuration(120, 2)).toEqual([60, 60]);
    expect(splitDuration(120, 3)).toEqual([60, 30, 30]);
    expect(splitDuration(30, 3)).toEqual([15, 15, 15]);
    expect(splitDuration(90, 1)).toEqual([90]);
    for (const n of [2, 3, 4]) for (const m of splitDuration(150, n)) expect(m % 15).toBe(0);
  });
});
