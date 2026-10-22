const STORAGE_KEY = "expenses:last-used";

export type LastUsedOperation = {
  categoryId: number | null;
  accountId: number | null;
};

/** Category/account of the last saved operation (browser only). */
export function readLastUsed(): LastUsedOperation {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { categoryId: null, accountId: null };
    const parsed = JSON.parse(raw) as Partial<LastUsedOperation>;
    return {
      categoryId: typeof parsed.categoryId === "number" ? parsed.categoryId : null,
      accountId: typeof parsed.accountId === "number" ? parsed.accountId : null,
    };
  } catch {
    return { categoryId: null, accountId: null };
  }
}

export function writeLastUsed(value: LastUsedOperation): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode); remembering is best-effort.
  }
}
