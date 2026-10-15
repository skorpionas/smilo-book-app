"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * Controlled search box. The query stays in component state (never in the URL,
 * requirements §16: no client data in URLs); callers filter locally or call a
 * Server Action (POST).
 */
export function SearchField({
  id = "search-field",
  label,
  placeholder,
  value,
  onChange,
  pending,
  autoFocus,
  className,
}: {
  id?: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  pending?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  const tc = useTranslations("common");
  return (
    <div role="search" className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden
        className="text-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
      />
      <Input
        id={id}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="pr-11 pl-10 [&::-webkit-search-cancel-button]:hidden"
      />
      <span className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center">
        {pending ? (
          <span className="flex size-11 items-center justify-center">
            <Spinner />
          </span>
        ) : value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={tc("clear")}
            className="text-muted hover:text-foreground flex size-11 items-center justify-center rounded-full"
          >
            <X aria-hidden className="size-4" />
          </button>
        ) : null}
      </span>
    </div>
  );
}

/** Debounced copy of a value (300 ms by default). */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debounced;
}
