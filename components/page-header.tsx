import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  children,
  className,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "border-border bg-background/95 sticky top-0 z-20 flex min-h-14 items-center gap-2 border-b px-4 backdrop-blur",
        className,
      )}
    >
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
      {children}
    </header>
  );
}

export function ComingSoon({ text }: { text: string }) {
  return (
    <div className="border-border bg-surface text-muted m-4 rounded-2xl border border-dashed p-6 text-center">
      {text}
    </div>
  );
}
