"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { refreshMarketData } from "@/app/actions/settings";
import { Button } from "@/components/ui/motion-button";
import { cn } from "@/lib/utils";

export function DashboardRefreshButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      ripple
      disabled={pending}
      aria-label="Refresh prices and FX rates"
      onClick={() => {
        startTransition(async () => {
          await refreshMarketData();
        });
      }}
      className="gap-1.5"
    >
      <RefreshCw
        className={cn("h-3.5 w-3.5", pending && "animate-spin")}
        strokeWidth={2.25}
      />
      {pending ? "Refreshing…" : "Refresh"}
    </Button>
  );
}
