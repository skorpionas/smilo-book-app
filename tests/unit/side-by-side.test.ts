import { describe, expect, it } from "vitest";
import { sideBySide } from "@/lib/side-by-side";

const layout = (cards: { id: string; row: number; span: number }[]) =>
  Object.fromEntries(sideBySide(cards).map(({ item, col, cols }) => [item.id, [col, cols]]));

describe("sideBySide", () => {
  it("leaves cards that do not overlap full width", () => {
    expect(
      layout([
        { id: "a", row: 0, span: 8 },
        { id: "b", row: 8, span: 4 }, // starts where a ends: [) ranges
      ]),
    ).toEqual({ a: [0, 1], b: [0, 1] });
  });

  it("puts a short visit inside a long one next to it", () => {
    expect(
      layout([
        { id: "long", row: 0, span: 8 },
        { id: "nails", row: 2, span: 1 },
      ]),
    ).toEqual({ long: [0, 2], nails: [1, 2] });
  });

  it("reuses a free column and gives the whole cluster the same width", () => {
    expect(
      layout([
        { id: "a", row: 0, span: 8 },
        { id: "b", row: 1, span: 2 },
        { id: "c", row: 4, span: 2 }, // b has ended: takes column 1 again
        { id: "d", row: 4, span: 1 },
        { id: "later", row: 10, span: 2 },
      ]),
    ).toEqual({ a: [0, 3], b: [1, 3], c: [1, 3], d: [2, 3], later: [0, 1] });
  });

  it("is independent of input order", () => {
    const cards = [
      { id: "x", row: 3, span: 2 },
      { id: "y", row: 0, span: 6 },
    ];
    expect(layout(cards)).toEqual(layout([...cards].reverse()));
    expect(layout(cards)).toEqual({ y: [0, 2], x: [1, 2] });
  });
});
