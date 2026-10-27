"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function inferAccountType(name: string, type?: string): string {
  if (type) return type;
  const lower = name.toLowerCase();
  if (
    lower.includes("espèce") ||
    lower.includes("espece") ||
    lower.includes("liquide") ||
    lower.includes("cash")
  ) {
    return "cash";
  }
  if (
    lower.includes("livret") ||
    lower.includes("épargne") ||
    lower.includes("epargne") ||
    lower.includes("economies") ||
    lower.includes("économies") ||
    lower.includes("savings") ||
    lower.includes("ldds")
  ) {
    return "savings";
  }
  return "checking";
}

export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <p id={`${id}-label`} className="mb-1.5 text-[13px] font-medium text-muted-foreground">
        {label}
      </p>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-loss">
          {error}
        </p>
      )}
    </div>
  );
}

const MENU_GAP = 4;
const MENU_MAX_HEIGHT = 256; // max-h-64

export function Dropdown({
  id,
  open,
  onOpenChange,
  trigger,
  children,
}: {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }

    function update() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
      const spaceAbove = rect.top - MENU_GAP;
      // Prefer below: the menu is portaled, so modal overflow no longer matters.
      const placeAbove = spaceBelow < 140 && spaceAbove > spaceBelow;
      const available = Math.max(0, placeAbove ? spaceAbove : spaceBelow);
      const maxHeight = Math.max(96, Math.min(MENU_MAX_HEIGHT, available));
      setCoords({
        top: placeAbove
          ? rect.top - MENU_GAP - maxHeight
          : rect.bottom + MENU_GAP,
        left: rect.left,
        width: rect.width,
        maxHeight,
      });
    }

    update();
    window.addEventListener("resize", update);
    // Capture scroll from modal body and the page so the menu stays aligned.
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  return (
    <div
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          onOpenChange(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-labelledby={`${id}-label ${id}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-[10px] border border-border bg-card px-3 py-2 text-left transition hover:border-primary/30 hover:bg-muted/30 focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10",
          open && "border-primary/40 ring-4 ring-primary/10",
        )}
      >
        <span className="min-w-0 flex-1">{trigger}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open &&
        coords &&
        createPortal(
          <>
            <button
              type="button"
              tabIndex={-1}
              className="fixed inset-0 z-[60] cursor-default"
              aria-label="Close menu"
              onClick={() => onOpenChange(false)}
            />
            <div
              role="listbox"
              className="fixed z-[61] overflow-y-auto rounded-xl border border-border bg-card shadow-lg"
              style={{
                top: coords.top,
                left: coords.left,
                width: coords.width,
                maxHeight: coords.maxHeight,
              }}
            >
              {children}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

export function TogglePill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
