"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type InsightOk = {
  status: "ok";
  insight: string;
  monthLabel: string;
  model: string;
  month: string;
  generatedAt: string;
};

type InsightFail = {
  status: "unavailable" | "error";
  reason: string;
  monthLabel: string;
};

type InsightResponse = InsightOk | InsightFail;

function cacheKey(month: string) {
  return `monthly-insight:${month}`;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function readCache(month: string): InsightOk | null {
  try {
    const raw = localStorage.getItem(cacheKey(month));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InsightOk;
    if (parsed?.status === "ok" && parsed.insight && parsed.month === month) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeCache(result: InsightOk) {
  try {
    localStorage.setItem(cacheKey(result.month), JSON.stringify(result));
  } catch {
    /* ignore */
  }
}

export function MonthlyInsightCard() {
  const month = currentMonth();
  const [data, setData] = useState<InsightResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setData(readCache(month));
  }, [month]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const generate = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    try {
      const res = await fetch("/api/ai/monthly-insight", {
        method: "POST",
        cache: "no-store",
        signal: controller.signal,
      });
      const json = (await res.json()) as InsightResponse & { month?: string };

      if (json.status === "ok") {
        const cached: InsightOk = {
          ...json,
          month: json.month ?? month,
          generatedAt: new Date().toISOString(),
        };
        writeCache(cached);
        setData(cached);
      } else {
        setData(json);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setData({
        status: "error",
        monthLabel: "This month",
        reason: "Could not reach the insight service.",
      });
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  }, [month]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  const hasInsight = data?.status === "ok";

  return (
    <section className="mb-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground/90">
              Monthly insight
            </h2>
            <p className="text-xs text-muted-foreground">
              {data && "monthLabel" in data && data.monthLabel
                ? `Local AI · ${data.monthLabel}`
                : "On-demand summary via Ollama (not auto-run)"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {loading ? (
            <button
              type="button"
              onClick={cancel}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void generate()}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
                hasInsight
                  ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                  : "bg-primary text-primary-foreground hover:opacity-90",
              )}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {hasInsight ? "Regenerate" : "Generate"}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-3">
          <p className="text-sm text-muted-foreground">
            Generating with your local model… The first run can take up to about
            1–2 minutes while the model loads. You can cancel if needed.
          </p>
        </div>
      ) : hasInsight ? (
        <div>
          <p className="text-sm leading-relaxed text-foreground/90">
            {data.insight}
          </p>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Generated with {data.model} via Ollama
            {"generatedAt" in data && data.generatedAt
              ? ` · ${new Date(data.generatedAt).toLocaleString()}`
              : ""}
          </p>
        </div>
      ) : data?.status === "unavailable" || data?.status === "error" ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-3">
          <p className="text-sm text-muted-foreground">{data.reason}</p>
          {data.status === "unavailable" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Make sure Ollama is running and{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                llama3.2:3b
              </code>{" "}
              is pulled, then try Generate again.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-3">
          <p className="text-sm text-muted-foreground">
            Insights are generated only when you ask — opening the dashboard no
            longer starts the model automatically (that was freezing some Macs).
          </p>
        </div>
      )}
    </section>
  );
}
