import { db } from "@/db";
import { settings } from "@/db/schema";
import {
  isThemePreference,
  type ThemePreference,
} from "@/lib/theme";

export type AiProvider = "ollama" | "openai" | "anthropic" | "gemini";

const AI_PROVIDERS: AiProvider[] = ["ollama", "openai", "anthropic", "gemini"];

export function isAiProvider(value: string): value is AiProvider {
  return AI_PROVIDERS.includes(value as AiProvider);
}

export type AiCategorizationSettings = {
  enabled: boolean;
  provider: AiProvider;
  model: string;
  /** Full key for server-side use only; never send to the client. */
  apiKey: string | null;
  hasApiKey: boolean;
  ollamaBaseUrl: string;
};

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

/** Whether Electron should show bill OS notifications and the dock badge. */
export function getBillNotificationsEnabled(): boolean {
  const row = db.select().from(settings).limit(1).all()[0];
  // Default on when the column is missing from an older row shape.
  return (row?.billNotifications ?? 1) === 1;
}

export function getAiCategorizationSettings(): AiCategorizationSettings {
  const row = db.select().from(settings).limit(1).all()[0];
  const providerRaw = row?.aiProvider ?? "ollama";
  const provider = isAiProvider(providerRaw) ? providerRaw : "ollama";
  const apiKey = row?.aiApiKey?.trim() ? row.aiApiKey.trim() : null;
  return {
    enabled: (row?.aiCategorizationEnabled ?? 0) === 1,
    provider,
    model: row?.aiModel?.trim() || "llama3.2:3b",
    apiKey,
    hasApiKey: apiKey != null,
    ollamaBaseUrl:
      row?.aiOllamaBaseUrl?.trim() || "http://127.0.0.1:11434",
  };
}

/** Safe subset for Settings UI — never includes the raw API key. */
export function getAiCategorizationPublicSettings(): Omit<
  AiCategorizationSettings,
  "apiKey"
> {
  const full = getAiCategorizationSettings();
  return {
    enabled: full.enabled,
    provider: full.provider,
    model: full.model,
    hasApiKey: full.hasApiKey,
    ollamaBaseUrl: full.ollamaBaseUrl,
  };
}
