"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { updateTheme } from "@/app/actions/settings";
import {
  applyThemeClass,
  type ThemePreference,
} from "@/lib/theme";

const ThemeContext = createContext<{
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
} | null>(null);

export function ThemeProvider({
  theme,
  children,
}: {
  theme: ThemePreference;
  children: ReactNode;
}) {
  const [preference, setPreference] = useState(theme);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setPreference(theme);
  }, [theme]);

  useEffect(() => {
    applyThemeClass(preference);
  }, [preference]);

  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeClass("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  function setTheme(next: ThemePreference) {
    setPreference(next);
    applyThemeClass(next);
    startTransition(() => {
      void updateTheme(next);
    });
  }

  return (
    <ThemeContext.Provider value={{ theme: preference, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
