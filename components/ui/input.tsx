import { ChevronDown, CircleAlert } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

// Shared look for every form control.
// text-base (16 px) prevents iOS Safari from zooming on focus; min-h-11 = 44 px.
export const controlClass = cn(
  "block w-full min-h-11 rounded-md border border-input bg-surface px-3 py-2 text-base text-foreground shadow-xs",
  "placeholder:text-muted transition-[border-color,box-shadow] duration-150",
  "hover:border-foreground-soft focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25",
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70",
  "aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/25",
);

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClass, "min-h-24 resize-y leading-relaxed", className)} {...props} />;
}

/** Native select: best picker on phones, zero JS. */
export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(controlClass, "appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="text-muted pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2"
      />
    </div>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-foreground mb-1.5 block text-sm font-medium", className)} {...props} />;
}

export function FieldHint({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-muted mt-1.5 text-sm", className)} {...props} />;
}

export function FieldError({ id, message }: { id: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-danger mt-1.5 flex items-start gap-1.5 text-sm">
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}
