"use client";

import { useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { updateBillNotifications } from "@/app/actions/settings";
import { cn } from "@/lib/utils";

export function BillNotificationsToggle({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      try {
        await updateBillNotifications(next);
      } catch {
        setEnabled(!next);
      }
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={
        enabled ? "Disable bill notifications" : "Enable bill notifications"
      }
      disabled={pending}
      onClick={toggle}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 disabled:opacity-60",
        enabled
          ? "border-primary/30 bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {enabled ? (
        <Bell className="h-4 w-4" aria-hidden />
      ) : (
        <BellOff className="h-4 w-4" aria-hidden />
      )}
      {enabled ? "On" : "Off"}
    </button>
  );
}
