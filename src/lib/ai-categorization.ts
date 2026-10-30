import { getCategoryTree } from "@/lib/categories";
import { isLoopbackAddress, hostnameFromHostHeader } from "@/lib/loopback";
import {
  getAiCategorizationSettings,
  type AiProvider,
} from "@/lib/settings";

const AI_TIMEOUT_MS = 12_000;

export type AiCategorySuggestion = {
  categoryId: number;
  subcategoryId: number | null;
  label: string;
};

function assertLoopbackOllamaUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Ollama URL is invalid");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Ollama URL must use http or https");
  }
  const host = hostnameFromHostHeader(url.host) || url.hostname;
  if (!isLoopbackAddress(host)) {
    throw new Error("Ollama URL must be a loopback address");
  }
  return url;
}

function buildPrompt(
  description: string,
  type: "expense" | "income",
): { system: string; user: string; allowed: Map<string, { categoryId: number; subcategoryId: number | null; label: string }> } {
  const tree = getCategoryTree();
  const lines: string[] = [];
  const allowed = new Map<
    string,
    { categoryId: number; subcategoryId: number | null; label: string }
  >();

  for (const cat of tree) {
    const parentKey = `c:${cat.id}`;
    const parentLabel = cat.name;
    allowed.set(parentKey, {
      categoryId: cat.id,
      subcategoryId: null,
      label: parentLabel,
    });
    lines.push(`- id=${cat.id} name="${cat.name}"`);
    for (const sub of cat.children) {
      const key = `c:${cat.id}:s:${sub.id}`;
      const label = `${cat.name} · ${sub.name}`;
      allowed.set(key, {
        categoryId: cat.id,
        subcategoryId: sub.id,
        label,
      });
      lines.push(
        `  - subcategory id=${sub.id} parent=${cat.id} name="${sub.name}"`,
      );
    }
  }

  const system =
    "You categorize personal finance operations. Reply with JSON only, no markdown. " +
    'Schema: {"categoryId":number,"subcategoryId":number|null}. ' +
    "Pick only IDs from the provided list. Prefer a subcategory when clearly appropriate.";

  const user =
    `Operation type: ${type}\n` +
    `Description: ${description.trim()}\n\n` +
    `Available categories:\n${lines.join("\n")}\n\n` +
    "Return JSON now.";

  return { system, user, allowed };
}

function parseSuggestion(
  raw: string,
  allowed: Map<
    string,
    { categoryId: number; subcategoryId: number | null; label: string }
  >,
): AiCategorySuggestion | null {
  const trimmed = raw.trim();
  const jsonText = trimmed.startsWith("{")
    ? trimmed
    : trimmed.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) return null;

  let parsed: { categoryId?: unknown; subcategoryId?: unknown };
  try {
    parsed = JSON.parse(jsonText) as {
      categoryId?: unknown;
      subcategoryId?: unknown;
    };
  } catch {
    return null;
  }

  const categoryId = Number(parsed.categoryId);
  if (!Number.isFinite(categoryId)) return null;
  const subcategoryId =
    parsed.subcategoryId == null || parsed.subcategoryId === ""
      ? null
      : Number(parsed.subcategoryId);
  if (subcategoryId != null && !Number.isFinite(subcategoryId)) return null;

  const key =
    subcategoryId == null
      ? `c:${categoryId}`
      : `c:${categoryId}:s:${subcategoryId}`;
  return allowed.get(key) ?? null;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callOllama(
  baseUrl: string,
  model: string,
  system: string,
  user: string,
): Promise<string> {
  const origin = assertLoopbackOllamaUrl(baseUrl);
  const endpoint = new URL("/api/chat", origin).toString();
  const res = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    redirect: "error",
  });
  if (!res.ok) {
    throw new Error(`Ollama request failed (${res.status})`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content ?? "";
}

async function callOpenAi(
  apiKey: string,
  model: string,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI request failed (${res.status})`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(
  apiKey: string,
  model: string,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 200,
      temperature: 0,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic request failed (${res.status})`);
  }
  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = data.content?.find((c) => c.type === "text")?.text;
  return text ?? "";
}

async function callGemini(
  apiKey: string,
  model: string,
  system: string,
  user: string,
): Promise<string> {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini request failed (${res.status})`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callProvider(
  provider: AiProvider,
  opts: {
    model: string;
    apiKey: string | null;
    ollamaBaseUrl: string;
    system: string;
    user: string;
  },
): Promise<string> {
  switch (provider) {
    case "ollama":
      return callOllama(opts.ollamaBaseUrl, opts.model, opts.system, opts.user);
    case "openai":
      if (!opts.apiKey) throw new Error("OpenAI API key is required");
      return callOpenAi(opts.apiKey, opts.model, opts.system, opts.user);
    case "anthropic":
      if (!opts.apiKey) throw new Error("Anthropic API key is required");
      return callAnthropic(opts.apiKey, opts.model, opts.system, opts.user);
    case "gemini":
      if (!opts.apiKey) throw new Error("Gemini API key is required");
      return callGemini(opts.apiKey, opts.model, opts.system, opts.user);
    default:
      throw new Error("Unsupported AI provider");
  }
}

/**
 * Suggest a category via the configured provider. Returns null on any failure.
 */
export async function suggestCategoryWithAi(
  description: string,
  type: "expense" | "income",
): Promise<AiCategorySuggestion | null> {
  const settings = getAiCategorizationSettings();
  if (!settings.enabled) return null;
  if (!description.trim()) return null;

  const { system, user, allowed } = buildPrompt(description, type);
  try {
    const raw = await callProvider(settings.provider, {
      model: settings.model,
      apiKey: settings.apiKey,
      ollamaBaseUrl: settings.ollamaBaseUrl,
      system,
      user,
    });
    return parseSuggestion(raw, allowed);
  } catch (err) {
    console.error("[ai-categorization]", err);
    return null;
  }
}

export async function testAiCategorizationConnection(): Promise<{
  ok: boolean;
  message: string;
}> {
  const settings = getAiCategorizationSettings();
  try {
    if (settings.provider === "ollama") {
      const origin = assertLoopbackOllamaUrl(settings.ollamaBaseUrl);
      const res = await fetchWithTimeout(new URL("/api/tags", origin).toString(), {
        method: "GET",
        redirect: "error",
      });
      if (!res.ok) {
        return { ok: false, message: `Ollama responded with ${res.status}` };
      }
      return { ok: true, message: "Connected to Ollama" };
    }

    if (!settings.apiKey) {
      return { ok: false, message: "Save an API key first" };
    }

    const raw = await callProvider(settings.provider, {
      model: settings.model,
      apiKey: settings.apiKey,
      ollamaBaseUrl: settings.ollamaBaseUrl,
      system: 'Reply with JSON only: {"ok":true}',
      user: "Ping",
    });
    if (!raw.trim()) {
      return { ok: false, message: "Empty response from provider" };
    }
    return { ok: true, message: `Connected to ${settings.provider}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return { ok: false, message };
  }
}
