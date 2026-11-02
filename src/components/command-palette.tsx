"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  FileText,
  Plus,
  Receipt,
  Search,
  Wallet,
} from "lucide-react";
import { searchGlobalAction } from "@/app/actions/search";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/lib/command-palette";
import { displayTransactionTitle, formatMoney } from "@/lib/format";
import type { GlobalSearchResult } from "@/lib/global-search";
import { cn } from "@/lib/utils";

type PaletteItem = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: typeof Search;
  run: () => void;
};

const GO_TO: { href: string; label: string }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/accounts", label: "Accounts" },
  { href: "/expenses", label: "Expenses" },
  { href: "/bills", label: "Bills" },
  { href: "/goals", label: "Budgets" },
  { href: "/savings", label: "Savings" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/crypto", label: "Crypto" },
  { href: "/settings", label: "Settings" },
];

function matchesQuery(label: string, query: string): boolean {
  if (!query.trim()) return true;
  return label.toLowerCase().includes(query.trim().toLowerCase());
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState<GlobalSearchResult>({
    operations: [],
    accounts: [],
    bills: [],
  });
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    setQuery("");
    setResults({ operations: [], accounts: [], bills: [] });
    setActiveIndex(0);
  }

  function openPalette() {
    setOpen(true);
    setQuery("");
    setResults({ operations: [], accounts: [], bills: [] });
    setActiveIndex(0);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!(mod && e.key.toLowerCase() === "k")) return;
      // Always allow ⌘/Ctrl+K, including while typing in fields.
      e.preventDefault();
      if (open) close();
      else openPalette();
    }

    function onOpenEvent() {
      openPalette();
    }

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults({ operations: [], accounts: [], bills: [] });
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const next = await searchGlobalAction(trimmed);
        setResults(next);
        setActiveIndex(0);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open]);

  const items: PaletteItem[] = useMemo(() => {
    const list: PaletteItem[] = [];
    const q = query.trim();

    const actions = [
      {
        id: "action-new-operation",
        label: "New operation",
        hint: "Expenses",
        run: () => {
          close();
          router.push("/expenses?new=1");
        },
      },
      {
        id: "action-add-bill",
        label: "Add bill",
        hint: "Bills",
        run: () => {
          close();
          router.push("/bills?new=1");
        },
      },
    ].filter((a) => matchesQuery(a.label, q));

    for (const action of actions) {
      list.push({
        id: action.id,
        group: "Actions",
        label: action.label,
        hint: action.hint,
        icon: Plus,
        run: action.run,
      });
    }

    const pages = GO_TO.filter((p) => matchesQuery(p.label, q));
    for (const page of pages) {
      list.push({
        id: `goto-${page.href}`,
        group: "Go to",
        label: page.label,
        icon: ArrowRight,
        run: () => {
          close();
          router.push(page.href);
        },
      });
    }

    for (const op of results.operations) {
      const title = displayTransactionTitle(op.description, op.categoryName);
      list.push({
        id: `op-${op.id}`,
        group: "Operations",
        label: title,
        hint: `${op.date} · ${formatMoney(op.amount, op.currency)} · ${op.accountName}`,
        icon: Receipt,
        run: () => {
          close();
          router.push("/expenses");
        },
      });
    }

    for (const account of results.accounts) {
      list.push({
        id: `account-${account.id}`,
        group: "Accounts",
        label: account.name,
        hint: `${account.type} · ${account.currency}`,
        icon: Wallet,
        run: () => {
          close();
          router.push("/accounts");
        },
      });
    }

    for (const bill of results.bills) {
      list.push({
        id: `bill-${bill.id}`,
        group: "Bills",
        label: bill.name,
        hint: `${formatMoney(bill.amount, bill.currency)}${
          bill.nextDueDate ? ` · due ${bill.nextDueDate}` : ""
        }`,
        icon: FileText,
        run: () => {
          close();
          router.push("/bills");
        },
      });
    }

    return list;
  }, [query, results, router]);

  useEffect(() => {
    setActiveIndex(0);
  }, [items.length, query]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-palette-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  if (!open) return null;

  const groups = items.reduce<Array<{ name: string; items: PaletteItem[] }>>(
    (acc, item) => {
      const last = acc[acc.length - 1];
      if (last && last.name === item.group) {
        last.items.push(item);
      } else {
        acc.push({ name: item.group, items: [item] });
      }
      return acc;
    },
    [],
  );

  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[min(20vh,8rem)]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <button
        type="button"
        className="modal-backdrop-in absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={close}
        aria-label="Close command palette"
      />
      <div className="modal-panel-in relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl [border-width:0.5px]">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Search
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or jump to…"
            aria-label="Search"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                close();
                return;
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) =>
                  items.length === 0 ? 0 : Math.min(i + 1, items.length - 1),
                );
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                const item = items[activeIndex];
                if (item) item.run();
              }
            }}
          />
          {pending && (
            <span className="text-[11px] text-muted-foreground">Searching…</span>
          )}
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[min(60vh,28rem)] overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {query.trim() ? "No matches" : "Type to search"}
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.name} className="mb-2">
                <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {group.name}
                </p>
                <ul>
                  {group.items.map((item) => {
                    flatIndex += 1;
                    const index = flatIndex;
                    const Icon = item.icon;
                    const active = index === activeIndex;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          data-palette-index={index}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition",
                            active
                              ? "bg-muted text-foreground"
                              : "text-foreground hover:bg-muted/70",
                          )}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => item.run()}
                        >
                          <Icon
                            className="h-4 w-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">
                              {item.label}
                            </span>
                            {item.hint && (
                              <span className="block truncate text-xs text-muted-foreground">
                                {item.hint}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
