const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.2:3b";

/** Prevent overlapping Ollama runs (double-clicks / Strict Mode). */
let ollamaInFlight: Promise<string> | null = null;

export function getOllamaBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
}

export function getOllamaModel(): string {
  return process.env.OLLAMA_MODEL ?? DEFAULT_MODEL;
}

export async function isOllamaAvailable(timeoutMs = 1500): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${getOllamaBaseUrl()}/api/tags`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export type OllamaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function ollamaChat(
  messages: OllamaChatMessage[],
  options?: { model?: string; timeoutMs?: number },
): Promise<string> {

  if (ollamaInFlight) {
    throw new Error(
      "A local model request is already running. Wait for it to finish or cancel it.",
    );
  }

  const model = options?.model ?? getOllamaModel();
  const timeoutMs = options?.timeoutMs ?? 120_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const run = (async () => {
    try {

      const res = await fetch(`${getOllamaBaseUrl()}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          // Keep model loaded briefly so the next Generate is not a full cold start.
          keep_alive: "10m",
          options: {
            temperature: 0.3,
            num_predict: 160,
          },
        }),
        signal: controller.signal,
        cache: "no-store",
      });


      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `Ollama error ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
        );
      }

      const data = (await res.json()) as {
        message?: { content?: string };
        total_duration?: number;
        load_duration?: number;
      };
      const content = data.message?.content?.trim();
      if (!content) throw new Error("Ollama returned an empty response");
      return content;
    } catch (error) {
      throw error;
    } finally {
      clearTimeout(timer);
    }
  })();

  ollamaInFlight = run;
  try {
    return await run;
  } finally {
    if (ollamaInFlight === run) {
      ollamaInFlight = null;
    }
  }
}
