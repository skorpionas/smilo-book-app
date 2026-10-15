"use client";

import * as React from "react";
import type { FormState } from "@/lib/action-helpers";

/**
 * useActionState for <form onSubmit>. React 19 resets uncontrolled fields after a
 * `<form action>` submit, which would wipe what the owner typed whenever the
 * server returns a validation error. Submitting via onSubmit keeps the values.
 */
export function useFormAction(action: (prev: FormState, formData: FormData) => Promise<FormState>) {
  const [state, dispatch, pending] = React.useActionState(action, null);
  const onSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      React.startTransition(() => dispatch(formData));
    },
    [dispatch],
  );
  return [state, onSubmit, pending] as const;
}
