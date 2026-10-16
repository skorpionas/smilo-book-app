"use client";

import * as React from "react";
import { DEFAULT_WINDOW, windowRows, windowSlots, type GridWindow } from "@/lib/clock";

type GridWindowValue = GridWindow & { rows: number; slots: string[] };

const Ctx = React.createContext<GridWindowValue>(withRows(DEFAULT_WINDOW));

function withRows(w: GridWindow): GridWindowValue {
  return { ...w, rows: windowRows(w), slots: windowSlots(w) };
}

/** Hours shown by the day / week grid below (widened for early or late bookings). */
export function GridWindowProvider({ hours, children }: { hours: GridWindow; children: React.ReactNode }) {
  const value = React.useMemo(() => withRows(hours), [hours]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGridWindow(): GridWindowValue {
  return React.useContext(Ctx);
}

export { withRows as gridWindowValue };
