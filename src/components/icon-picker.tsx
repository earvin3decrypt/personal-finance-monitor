"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  AVAILABLE_ICONS,
  CategoryIcon,
  ICONS,
} from "@/components/category-icon";
import { cn } from "@/lib/utils";

export function IconPicker({
  name = "icon",
  value,
  defaultValue = "tag",
  onChange,
  color,
  className,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (icon: string) => void;
  color?: string;
  className?: string;
}) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const selected = isControlled ? value : internal;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  function select(icon: string) {
    if (!isControlled) setInternal(icon);
    onChange?.(icon);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input type="hidden" name={name} value={selected} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
      >
        <span className="flex items-center gap-2">
          <CategoryIcon icon={selected} color={color} size={16} />
          <span className="capitalize text-muted-foreground">
            {selected.replace(/-/g, " ")}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-56 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-lg"
        >
          <div className="grid grid-cols-5 gap-1">
            {AVAILABLE_ICONS.map((key) => {
              const ItemIcon = ICONS[key];
              const isSelected = key === selected;
              return (
                <button
                  key={key}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  title={key.replace(/-/g, " ")}
                  onClick={() => select(key)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <ItemIcon size={16} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
