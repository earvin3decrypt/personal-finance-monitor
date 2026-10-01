"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { updateBlurAmounts } from "@/app/actions/settings";
import { applyBlurAmounts } from "@/lib/privacy";

const PrivacyContext = createContext<{
  blurAmounts: boolean;
  setBlurAmounts: (enabled: boolean) => void;
} | null>(null);

export function PrivacyProvider({
  blurAmounts,
  children,
}: {
  blurAmounts: boolean;
  children: ReactNode;
}) {
  const [enabled, setEnabled] = useState(blurAmounts);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setEnabled(blurAmounts);
  }, [blurAmounts]);

  useEffect(() => {
    applyBlurAmounts(enabled);
  }, [enabled]);

  function setBlurAmounts(next: boolean) {
    setEnabled(next);
    applyBlurAmounts(next);
    startTransition(() => {
      void updateBlurAmounts(next);
    });
  }

  return (
    <PrivacyContext.Provider value={{ blurAmounts: enabled, setBlurAmounts }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext);
  if (!ctx) {
    throw new Error("usePrivacy must be used within PrivacyProvider");
  }
  return ctx;
}
