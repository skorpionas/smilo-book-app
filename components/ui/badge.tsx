import { cva, type VariantProps } from "class-variance-authority";
import { Ban, CalendarClock, CircleCheck, UserX, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-neutral-soft text-neutral-foreground",
        primary: "bg-primary-soft text-primary-soft-foreground",
        info: "bg-info-soft text-info-foreground",
        success: "bg-success-soft text-success-foreground",
        warning: "bg-warning-soft text-warning-foreground",
        danger: "bg-danger-soft text-danger-soft-foreground",
        outline: "border-border-strong text-foreground-soft border",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export type BookingStatus = "scheduled" | "completed" | "cancelled" | "no_show";

// Status is always icon + word + colour, never colour alone (WCAG 1.4.1).
const STATUS: Record<
  BookingStatus,
  { tone: VariantProps<typeof badgeVariants>["tone"]; icon: LucideIcon; strike?: boolean }
> = {
  scheduled: { tone: "info", icon: CalendarClock },
  completed: { tone: "success", icon: CircleCheck },
  cancelled: { tone: "neutral", icon: Ban, strike: true },
  no_show: { tone: "warning", icon: UserX },
};

export function StatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const t = useTranslations("status");
  const { tone, icon: Icon } = STATUS[status];
  return (
    <Badge tone={tone} className={className}>
      <Icon aria-hidden />
      {t(status)}
    </Badge>
  );
}

export { badgeVariants };
