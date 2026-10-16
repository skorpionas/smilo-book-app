"use client";

import * as React from "react";
import { FieldError, FieldHint, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ControlProps = {
  id: string;
  name?: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

/**
 * Label + control + hint + error, wired with ids so screen readers read the
 * hint and the error with the field. `children` receives the control props.
 */
export function Field({
  id,
  name,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  id: string;
  name?: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  optional?: string;
  className?: string;
  children: (props: ControlProps) => React.ReactNode;
}) {
  const hintId = hint && !error ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <Label htmlFor={id}>
        {label}
        {optional ? <span className="text-muted ml-1 font-normal">({optional})</span> : null}
      </Label>
      {children({
        id,
        name: name ?? id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {hint && !error ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/** Small section title inside a sheet or card. */
export function FormSection({
  title,
  className,
  children,
  action,
}: {
  title: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex min-h-11 items-center justify-between gap-2">
        <h3 className="text-foreground-soft text-[0.9375rem] font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
