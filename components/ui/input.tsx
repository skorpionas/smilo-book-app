import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        // text-base (16 px) prevents iOS Safari from zooming on focus
        "border-border bg-surface text-foreground placeholder:text-muted focus:border-ring focus:outline-ring/40 aria-invalid:border-danger block min-h-11 w-full rounded-xl border px-3 py-2 text-base focus:outline-2",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-foreground mb-1 block text-sm font-medium", className)} {...props} />;
}

export function FieldError({ id, message }: { id: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-danger mt-1 text-sm">
      {message}
    </p>
  );
}
