"use client";

import { useEffect, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { saveExpense, deleteExpense } from "@/app/actions/expenses";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import type { CategoryWithChildren } from "@/lib/categories";
import type { ExpenseOperation } from "@/lib/expense-stats";
import { Button, Input, Label, Modal, Select } from "@/components/ui";

type AccountOption = { id: number; name: string; currency: string };

export function ExpenseEditModal({
  operation,
  categories,
  accounts,
  open,
  onClose,
}: {
  operation: ExpenseOperation | null;
  categories: CategoryWithChildren[];
  accounts: AccountOption[];
  open: boolean;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [categoryId, setCategoryId] = useState<number>(
    operation?.categoryId ?? categories[0]?.id ?? 0,
  );
  const [subcategoryId, setSubcategoryId] = useState<string>(
    operation?.subcategoryId != null ? String(operation.subcategoryId) : "",
  );
  const [currency, setCurrency] = useState(operation?.currency ?? "EUR");

  useEffect(() => {
    if (!operation) return;
    setCategoryId(operation.categoryId);
    setSubcategoryId(
      operation.subcategoryId != null ? String(operation.subcategoryId) : "",
    );
    setCurrency(operation.currency);
  }, [operation]);

  if (!operation) return null;

  const selectedCategory =
    categories.find((c) => c.id === categoryId) ?? categories[0];

  function handleCategoryChange(nextId: number) {
    setCategoryId(nextId);
    setSubcategoryId("");
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await saveExpense(formData);
      onClose();
    });
  }

  function handleDelete(formData: FormData) {
    if (!confirm("Delete this operation?")) return;
    startTransition(async () => {
      await deleteExpense(formData);
      onClose();
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit operation"
      footer={
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="edit-expense-form"
              variant="primary"
              disabled={pending}
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
          <form action={handleDelete}>
            <input type="hidden" name="id" value={operation.id} />
            <button
              type="submit"
              disabled={pending}
              className="text-xs font-medium text-loss/80 transition hover:text-loss disabled:opacity-50"
            >
              <Trash2 className="mr-1 inline h-3.5 w-3.5" />
              Delete operation
            </button>
          </form>
        </div>
      }
    >
      <form
        id="edit-expense-form"
        key={operation.id}
        action={handleSubmit}
        className="space-y-4"
      >
        <input type="hidden" name="id" value={operation.id} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="expense-amount">Amount</Label>
            <Input
              id="expense-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={operation.amount}
              required
            />
          </div>
          <div>
            <Label htmlFor="expense-currency">Currency</Label>
            <Select
              id="expense-currency"
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="expense-type">Type</Label>
          <Select
            id="expense-type"
            name="type"
            defaultValue={operation.type}
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="expense-category">Category</Label>
            <Select
              id="expense-category"
              name="categoryId"
              value={categoryId}
              onChange={(e) => handleCategoryChange(Number(e.target.value))}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="expense-account">Account</Label>
            <Select
              id="expense-account"
              name="accountId"
              defaultValue={operation.accountId}
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.currency})
                </option>
              ))}
            </Select>
          </div>
        </div>

        {selectedCategory && selectedCategory.children.length > 0 && (
          <div>
            <Label htmlFor="expense-subcategory">Subcategory</Label>
            <Select
              id="expense-subcategory"
              name="subcategoryId"
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
            >
              <option value="">None</option>
              {selectedCategory.children.map((sub) => (
                <option key={sub.id} value={String(sub.id)}>
                  {sub.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <Label htmlFor="expense-date">Date</Label>
          <Input
            id="expense-date"
            name="date"
            type="date"
            defaultValue={operation.date}
            required
          />
        </div>

        <div>
          <Label htmlFor="expense-description">Description</Label>
          <Input
            id="expense-description"
            name="description"
            defaultValue={operation.description ?? ""}
            placeholder="Coffee, groceries…"
          />
        </div>
      </form>
    </Modal>
  );
}
