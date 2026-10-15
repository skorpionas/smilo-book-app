"use client";

import * as React from "react";
import type { FormState } from "@/lib/action-helpers";

/** Runs `onSaved` once per successful action result (keyed on `savedAt`). */
export function useOnSaved(state: FormState, onSaved: (state: NonNullable<FormState>) => void) {
  const callback = React.useRef(onSaved);
  const handled = React.useRef<number | undefined>(undefined);
  React.useEffect(() => {
    callback.current = onSaved;
  });
  React.useEffect(() => {
    if (state?.ok && state.savedAt && state.savedAt !== handled.current) {
      handled.current = state.savedAt;
      callback.current(state);
    }
  }, [state]);
}
