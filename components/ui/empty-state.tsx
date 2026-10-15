import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Friendly "nothing here yet" block: icon, serif title, one sentence, optional action. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  headingLevel = 2,
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  headingLevel?: 1 | 2 | 3;
}) {
  const Heading = (["h1", "h2", "h3"] as const)[headingLevel - 1];
  return (
    <div
      className={cn(
        "mx-auto flex max-w-sm flex-col items-center px-6 py-12 text-center sm:py-16",
        "motion-safe:animate-fade-in",
        className,
      )}
    >
      <div className="bg-primary-soft text-primary-soft-foreground mb-5 flex size-14 items-center justify-center rounded-full">
        <Icon aria-hidden className="size-6" strokeWidth={1.75} />
      </div>
      <Heading className="font-display text-foreground text-xl font-semibold tracking-tight text-balance">
        {title}
      </Heading>
      {description ? (
        <p className="text-muted mt-2 text-base leading-relaxed text-pretty">{description}</p>
      ) : null}
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
