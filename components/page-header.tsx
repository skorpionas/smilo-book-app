import { cn } from "@/lib/utils";

/**
 * Sticky page header. Translucent page colour + hairline border; the title is
 * the page's only <h1>. `eyebrow` is a small line above the title (e.g. weekday).
 */
export function PageHeader({
  title,
  eyebrow,
  children,
  className,
  wide = false,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  /** Full-width content (calendar) instead of the centred reading column. */
  wide?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "pt-safe border-border bg-background/85 supports-[backdrop-filter]:bg-background/75 sticky top-0 z-20 border-b backdrop-blur-md",
        className,
      )}
    >
      <div
        className={cn("mx-auto flex min-h-16 w-full items-center gap-2 px-4 sm:px-6", !wide && "max-w-5xl")}
      >
        <div className="min-w-0 flex-1">
          {eyebrow ? <div className="text-muted text-sm leading-tight font-medium">{eyebrow}</div> : null}
          <h1 className="font-display truncate text-[1.375rem] leading-tight font-semibold tracking-tight">
            {title}
          </h1>
        </div>
        {children ? <div className="flex shrink-0 items-center gap-1">{children}</div> : null}
      </div>
    </header>
  );
}

/** Centred column for list / settings pages. */
export function PageBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-5xl px-4 py-4 sm:px-6 sm:py-6", className)} {...props} />;
}
