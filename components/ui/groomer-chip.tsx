import { cn } from "@/lib/utils";

/**
 * Groomer colours come from the DB and can be any hex. They are only used as a
 * dot, a stripe or a light tint behind normal foreground text, so the name
 * stays readable on both themes whatever colour the owner picks.
 */
export function GroomerDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("ring-surface inline-block size-2.5 shrink-0 rounded-full ring-2", className)}
      style={{ backgroundColor: color }}
    />
  );
}

export function GroomerChip({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span
      className={cn(
        "text-foreground inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-2 text-sm font-medium",
        className,
      )}
      style={{ backgroundColor: `color-mix(in oklab, ${color} 16%, var(--surface))` }}
    >
      <GroomerDot color={color} className="ring-border-strong ring-1" />
      {name}
    </span>
  );
}
