"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type ExpenseFilters = {
  categoryId: number | null;
  accountId: number | null;
  setCategoryId: (id: number | null) => void;
  setAccountId: (id: number | null) => void;
};

const ExpenseFilterContext = createContext<ExpenseFilters | null>(null);

export function ExpenseFilterProvider({ children }: { children: ReactNode }) {
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const value = useMemo(
    () => ({ categoryId, accountId, setCategoryId, setAccountId }),
    [categoryId, accountId],
  );
  return (
    <ExpenseFilterContext.Provider value={value}>
      {children}
    </ExpenseFilterContext.Provider>
  );
}

export function useExpenseFilters(): ExpenseFilters {
  const ctx = useContext(ExpenseFilterContext);
  if (!ctx) {
    throw new Error("useExpenseFilters must be used inside ExpenseFilterProvider");
  }
  return ctx;
}
