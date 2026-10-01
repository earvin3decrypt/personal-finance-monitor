import { db } from "@/db";
import { settings } from "@/db/schema";
import {
  isThemePreference,
  type ThemePreference,
} from "@/lib/theme";

export async function getBaseCurrency(): Promise<string> {
  const row = await db.select().from(settings).limit(1);
  return row[0]?.baseCurrency ?? "EUR";
}

export function getThemePreference(): ThemePreference {
  const row = db.select().from(settings).limit(1).all()[0];
  const theme = row?.theme ?? "system";
  return isThemePreference(theme) ? theme : "system";
}

export function getBlurAmounts(): boolean {
  const row = db.select().from(settings).limit(1).all()[0];
  return (row?.blurAmounts ?? 0) === 1;
}
