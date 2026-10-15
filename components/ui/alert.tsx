import { cva, type VariantProps } from "class-variance-authority";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva("flex items-start gap-2.5 rounded-md px-3.5 py-3 text-sm leading-snug", {
  variants: {
    tone: {
      info: "bg-info-soft text-info-foreground",
      success: "bg-primary-soft text-primary-soft-foreground",
      danger: "bg-danger-soft text-danger-soft-foreground",
    },
  },
  defaultVariants: { tone: "info" },
});

const ICONS = { info: Info, success: CircleCheck, danger: CircleAlert } as const;

/** Inline message inside a form or page. Pass role="alert" / "status" as needed. */
export function Alert({
  className,
  tone,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  const Icon = ICONS[tone ?? "info"];
  return (
    <div className={cn(alertVariants({ tone }), className)} {...props}>
      <Icon aria-hidden className="mt-px size-4.5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
