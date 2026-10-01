"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/motion-tabs";
import type { ThemePreference } from "@/lib/theme";

const OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();

  return (
    <Tabs
      value={theme}
      onValueChange={(v) => setTheme(v as ThemePreference)}
      variant="segment"
      className="w-fit"
    >
      <TabsList
        className="inline-flex w-fit items-center gap-0 rounded-lg bg-muted p-1"
        aria-label="Color theme"
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = theme === value;
          return (
            <TabsTrigger
              key={value}
              value={value}
              title={label}
              indicatorClassName="rounded-md bg-card shadow-sm ring-1 ring-border/60"
              className={
                active
                  ? "min-h-0 gap-1.5 px-2.5 py-1.5 text-xs !text-foreground"
                  : "min-h-0 gap-1.5 px-2.5 py-1.5 text-xs"
              }
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              {!compact && <span>{label}</span>}
              {compact && <span className="sr-only">{label}</span>}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
