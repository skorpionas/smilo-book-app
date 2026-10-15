import { cn } from "@/lib/utils";

// Six warm tints that work on both themes (text uses the matching *-foreground token).
const TONES = [
  "bg-primary-soft text-primary-soft-foreground",
  "bg-info-soft text-info-foreground",
  "bg-success-soft text-success-foreground",
  "bg-warning-soft text-warning-foreground",
  "bg-danger-soft text-danger-soft-foreground",
  "bg-neutral-soft text-neutral-foreground",
] as const;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toLocaleUpperCase("lt");
}

function toneFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return TONES[h % TONES.length];
}

const SIZES = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-12 text-base" } as const;

/**
 * Initials avatar for clients and pets. Decorative by default (the name is
 * always shown next to it); pass `label` when it stands alone.
 */
export function Avatar({
  name,
  size = "md",
  icon,
  label,
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  /** Optional icon instead of initials, e.g. a paw for pets. */
  icon?: React.ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none [&_svg]:size-[55%]",
        SIZES[size],
        toneFor(name),
        className,
      )}
    >
      {icon ?? initials(name)}
    </span>
  );
}
