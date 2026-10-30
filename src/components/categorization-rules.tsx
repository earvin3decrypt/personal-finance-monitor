"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createCategorizationRule,
  deleteCategorizationRule,
  moveCategorizationRule,
  setCategorizationRuleEnabled,
  updateCategorizationRule,
} from "@/app/actions/settings";
import { Button, Input, Label, Select } from "@/components/ui";
import type { CategorizationRuleRow, RuleOperator } from "@/lib/categorization";
import type { CategoryWithChildren } from "@/lib/categories";
import { cn } from "@/lib/utils";

const OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: "contains", label: "contains" },
  { value: "starts_with", label: "starts with" },
  { value: "exact", label: "exactly matches" },
];

function RuleForm({
  categories,
  initial,
  onCancel,
  onDone,
}: {
  categories: CategoryWithChildren[];
  initial?: CategorizationRuleRow;
  onCancel?: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [pattern, setPattern] = useState(initial?.pattern ?? "");
  const [operator, setOperator] = useState<RuleOperator>(
    initial?.operator ?? "contains",
  );
  const [categoryId, setCategoryId] = useState<number | "">(
    initial?.categoryId ?? "",
  );
  const [subcategoryId, setSubcategoryId] = useState<number | "">(
    initial?.subcategoryId ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId],
  );

  function submit() {
    setError(null);
    if (!pattern.trim()) {
      setError("Enter a description pattern");
      return;
    }
    if (categoryId === "") {
      setError("Choose a category");
      return;
    }

    const formData = new FormData();
    if (initial) formData.set("id", String(initial.id));
    formData.set("pattern", pattern.trim());
    formData.set("operator", operator);
    formData.set("categoryId", String(categoryId));
    if (subcategoryId !== "") {
      formData.set("subcategoryId", String(subcategoryId));
    }

    startTransition(async () => {
      try {
        if (initial) {
          await updateCategorizationRule(formData);
        } else {
          await createCategorizationRule(formData);
        }
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save rule");
      }
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <p className="text-sm font-medium">
        {initial ? "Edit rule" : "New rule"}
      </p>
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <span className="pb-2 text-muted-foreground">Description</span>
        <div className="min-w-[140px]">
          <Label htmlFor="rule-operator" className="sr-only">
            Match
          </Label>
          <Select
            id="rule-operator"
            value={operator}
            onChange={(e) => setOperator(e.target.value as RuleOperator)}
          >
            {OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[160px] flex-1">
          <Label htmlFor="rule-pattern" className="sr-only">
            Pattern
          </Label>
          <Input
            id="rule-pattern"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="e.g. Leclerc"
          />
        </div>
        <span className="pb-2 text-muted-foreground">→</span>
        <div className="min-w-[140px]">
          <Label htmlFor="rule-category" className="sr-only">
            Category
          </Label>
          <Select
            id="rule-category"
            value={categoryId === "" ? "" : String(categoryId)}
            onChange={(e) => {
              const next = e.target.value ? Number(e.target.value) : "";
              setCategoryId(next);
              setSubcategoryId("");
            }}
          >
            <option value="">Category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        {selectedCategory && selectedCategory.children.length > 0 && (
          <div className="min-w-[140px]">
            <Label htmlFor="rule-subcategory" className="sr-only">
              Subcategory
            </Label>
            <Select
              id="rule-subcategory"
              value={subcategoryId === "" ? "" : String(subcategoryId)}
              onChange={(e) =>
                setSubcategoryId(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">Any subcategory</option>
              {selectedCategory.children.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-loss">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={submit}>
          {initial ? "Save rule" : "Add rule"}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

export function CategorizationRules({
  categories,
  rules,
}: {
  categories: CategoryWithChildren[];
  rules: CategorizationRuleRow[];
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        When a description matches a rule, that category is selected
        automatically. Rules are checked in order; the first match wins.
      </p>

      {rules.length > 0 && (
        <ul className="divide-y divide-border border-y border-border">
          {rules.map((rule, index) => {
            if (editingId === rule.id) {
              return (
                <li key={rule.id} className="py-3">
                  <RuleForm
                    categories={categories}
                    initial={rule}
                    onCancel={() => setEditingId(null)}
                    onDone={() => setEditingId(null)}
                  />
                </li>
              );
            }

            const target = rule.subcategoryName
              ? `${rule.categoryName} · ${rule.subcategoryName}`
              : rule.categoryName;
            const operatorLabel =
              OPERATORS.find((o) => o.value === rule.operator)?.label ??
              rule.operator;

            return (
              <li
                key={rule.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 py-3 text-sm",
                  !rule.enabled && "opacity-50",
                )}
              >
                <div className="min-w-0">
                  <p>
                    Description{" "}
                    <span className="text-muted-foreground">
                      {operatorLabel}
                    </span>{" "}
                    <span className="font-medium">{rule.pattern}</span>
                    {" → "}
                    <span className="font-medium">{target}</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={rule.enabled}
                    aria-label={rule.enabled ? "Disable rule" : "Enable rule"}
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await setCategorizationRuleEnabled(
                          rule.id,
                          !rule.enabled,
                        );
                      })
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                      rule.enabled
                        ? "border-primary/30 bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {rule.enabled ? "On" : "Off"}
                  </button>
                  <form action={moveCategorizationRule}>
                    <input type="hidden" name="id" value={rule.id} />
                    <input type="hidden" name="direction" value="up" />
                    <Button
                      type="submit"
                      variant="ghost"
                      className="h-8 w-8 px-0"
                      disabled={pending || index === 0}
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </form>
                  <form action={moveCategorizationRule}>
                    <input type="hidden" name="id" value={rule.id} />
                    <input type="hidden" name="direction" value="down" />
                    <Button
                      type="submit"
                      variant="ghost"
                      className="h-8 w-8 px-0"
                      disabled={pending || index === rules.length - 1}
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </form>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 w-8 px-0"
                    aria-label="Edit rule"
                    onClick={() => setEditingId(rule.id)}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                  <form action={deleteCategorizationRule}>
                    <input type="hidden" name="id" value={rule.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      className="h-8 w-8 px-0 text-loss"
                      aria-label="Delete rule"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <RuleForm
          categories={categories}
          onCancel={() => setAdding(false)}
          onDone={() => setAdding(false)}
        />
      ) : (
        <Button
          type="button"
          variant="secondary"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add rule
        </Button>
      )}
    </div>
  );
}
