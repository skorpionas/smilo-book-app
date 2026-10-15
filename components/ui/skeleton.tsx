import { cn } from "@/lib/utils";

/** Placeholder block with a slow, calm pulse (static when reduced motion is on). */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div aria-hidden className={cn("bg-surface-muted animate-shimmer rounded-md", className)} {...props} />
  );
}
