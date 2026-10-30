"use client";

import { useState, useTransition } from "react";
import {
  clearAiApiKey,
  testAiCategorizationSettings,
  updateAiCategorizationSettings,
} from "@/app/actions/settings";
import { Button, Input, Label, Select } from "@/components/ui";
import type { AiProvider } from "@/lib/settings";
import { cn } from "@/lib/utils";

const PROVIDERS: { value: AiProvider; label: string }[] = [
  { value: "ollama", label: "Ollama (local)" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "gemini", label: "Gemini" },
];

const DEFAULT_MODELS: Record<AiProvider, string> = {
  ollama: "llama3.2:3b",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  gemini: "gemini-2.0-flash",
};

export function AiCategorizationSettings({
  initial,
}: {
  initial: {
    enabled: boolean;
    provider: AiProvider;
    model: string;
    hasApiKey: boolean;
    ollamaBaseUrl: string;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [provider, setProvider] = useState<AiProvider>(initial.provider);
  const [model, setModel] = useState(initial.model);
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(initial.ollamaBaseUrl);
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(initial.hasApiKey);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setMessage(null);
    setError(null);
    const formData = new FormData();
    formData.set("enabled", enabled ? "1" : "0");
    formData.set("provider", provider);
    formData.set("model", model);
    formData.set("ollamaBaseUrl", ollamaBaseUrl);
    if (apiKey.trim()) formData.set("apiKey", apiKey.trim());

    startTransition(async () => {
      try {
        await updateAiCategorizationSettings(formData);
        if (apiKey.trim()) {
          setHasApiKey(true);
          setApiKey("");
        }
        setMessage("AI settings saved");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save");
      }
    });
  }

  function clearKey() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        await clearAiApiKey();
        setHasApiKey(false);
        setApiKey("");
        setMessage("API key cleared");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not clear key");
      }
    });
  }

  function testConnection() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await testAiCategorizationSettings();
      if (result.ok) setMessage(result.message);
      else setError(result.message);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        When no rule matches, your chosen model can suggest a category. You
        confirm before it is applied. Rules always run first. Remote providers
        receive only the description and your category names—not balances.
      </p>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={pending}
        onClick={() => setEnabled((v) => !v)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition",
          enabled
            ? "border-primary/30 bg-primary text-primary-foreground"
            : "border-border bg-card text-muted-foreground hover:text-foreground",
        )}
      >
        {enabled ? "Suggestions on" : "Suggestions off"}
      </button>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="ai-provider">Provider</Label>
          <Select
            id="ai-provider"
            value={provider}
            onChange={(e) => {
              const next = e.target.value as AiProvider;
              setProvider(next);
              setModel((current) =>
                current.trim() ? current : DEFAULT_MODELS[next],
              );
            }}
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="ai-model">Model</Label>
          <Input
            id="ai-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={DEFAULT_MODELS[provider]}
          />
        </div>
      </div>

      {provider === "ollama" ? (
        <div>
          <Label htmlFor="ai-ollama-url">Ollama URL</Label>
          <Input
            id="ai-ollama-url"
            value={ollamaBaseUrl}
            onChange={(e) => setOllamaBaseUrl(e.target.value)}
            placeholder="http://127.0.0.1:11434"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Must be a loopback address on this computer.
          </p>
        </div>
      ) : (
        <div>
          <Label htmlFor="ai-api-key">API key</Label>
          <Input
            id="ai-api-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              hasApiKey ? "Key saved — leave blank to keep" : "Paste API key"
            }
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Stored only in your local database. Database backups also include
            this key.
          </p>
          {hasApiKey && (
            <button
              type="button"
              className="mt-2 text-xs font-medium text-loss hover:underline"
              disabled={pending}
              onClick={clearKey}
            >
              Clear saved key
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={save}>
          Save AI settings
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={testConnection}
        >
          Test connection
        </Button>
      </div>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      {error && <p className="text-xs text-loss">{error}</p>}
    </div>
  );
}
