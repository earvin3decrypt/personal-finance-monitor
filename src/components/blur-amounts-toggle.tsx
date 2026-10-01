"use client";

import { Eye, EyeOff } from "lucide-react";
import { usePrivacy } from "@/components/privacy-provider";
import { cn } from "@/lib/utils";

/**
 * Privacy toggle styled as a single-cell segment so it sits flush next to
 * `ThemeToggle` and reads as part of the same control group.
 */
export function BlurAmountsToggle({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { blurAmounts, setBlurAmounts } = usePrivacy();
  const label = blurAmounts ? "Show amounts" : "Blur amounts";

  return (
    <div
      className={cn(
        "inline-flex w-fit items-center rounded-lg bg-muted p-1",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setBlurAmounts(!blurAmounts)}
        className={cn(
          "inline-flex min-h-0 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium outline-none transition-colors",
          blurAmounts
            ? "bg-card text-foreground shadow-sm ring-1 ring-border/60"
            : "text-muted-foreground hover:text-foreground",
        )}
        title={label}
        aria-pressed={blurAmounts}
        aria-label={label}
      >
        {blurAmounts ? (
          <EyeOff className="h-3.5 w-3.5" strokeWidth={2} />
        ) : (
          <Eye className="h-3.5 w-3.5" strokeWidth={2} />
        )}
        {!compact && <span>{blurAmounts ? "Hidden" : "Blur"}</span>}
      </button>
    </div>
  );
}
