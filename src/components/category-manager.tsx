"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  addCategory,
  deleteCategory,
  setCategoryFixed,
  updateCategory,
  updateCategoryParent,
} from "@/app/actions/settings";
import {
  AVAILABLE_ICONS,
  CategoryIcon,
  ICONS,
  safeHexColor,
} from "@/components/category-icon";
import { IconPicker } from "@/components/icon-picker";
import { Button, Input, Label, Select } from "@/components/ui";
import type { CategoryWithChildren } from "@/lib/categories";
import { cn } from "@/lib/utils";

const BASE_PALETTE = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
] as const;

function buildPalette(tree: CategoryWithChildren[]): string[] {
  const seen = new Set<string>(BASE_PALETTE);
  for (const cat of tree) {
    const color = safeHexColor(cat.color).toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(color)) seen.add(color);
  }
  return Array.from(seen);
}

export function CategoryManager({
  categoryTree,
}: {
  categoryTree: CategoryWithChildren[];
}) {
  const [selectedId, setSelectedId] = useState<number | null>(
    () => categoryTree[0]?.id ?? null,
  );
  const [pendingSelectId, setPendingSelectId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (pendingSelectId != null) {
      if (categoryTree.some((c) => c.id === pendingSelectId)) {
        setSelectedId(pendingSelectId);
        setPendingSelectId(null);
      }
      return;
    }
    if (selectedId == null) {
      if (categoryTree[0]) setSelectedId(categoryTree[0].id);
      return;
    }
    if (!categoryTree.some((c) => c.id === selectedId)) {
      setSelectedId(categoryTree[0]?.id ?? null);
    }
  }, [categoryTree, selectedId, pendingSelectId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categoryTree;
    return categoryTree.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      return c.children.some((child) => child.name.toLowerCase().includes(q));
    });
  }, [categoryTree, search]);

  const selected = categoryTree.find((c) => c.id === selectedId) ?? null;
  const palette = useMemo(() => buildPalette(categoryTree), [categoryTree]);

  function handleCreateCategory() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("name", trimmed);
        formData.set("color", "#3b82f6");
        formData.set("icon", "tag");
        const result = await addCategory(formData);
        setNewName("");
        if (result?.id) {
          setPendingSelectId(result.id);
          setSelectedId(result.id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add category");
      }
    });
  }

  function selectByOffset(delta: number) {
    if (filtered.length === 0) return;
    const idx = filtered.findIndex((c) => c.id === selectedId);
    const next =
      idx < 0
        ? filtered[0]
        : filtered[(idx + delta + filtered.length) % filtered.length];
    setSelectedId(next.id);
  }

  return (
    <div
      className={cn(
        "grid md:grid-cols-[minmax(240px,320px)_1fr]",
        pending && "pointer-events-none opacity-60",
      )}
    >
      <div className="flex flex-col border-b border-border/50 md:border-b-0 md:border-r">
        <div className="space-y-3 p-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories…"
              className="pl-9"
              aria-label="Search categories"
            />
          </div>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateCategory();
                }
              }}
              placeholder="New category name"
              aria-label="New category name"
            />
            <Button
              type="button"
              variant="secondary"
              className="shrink-0 px-3"
              onClick={handleCreateCategory}
              disabled={!newName.trim()}
              aria-label="Add category"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {error && <p className="text-xs text-loss">{error}</p>}
        </div>

        <ul
          className="max-h-[420px] flex-1 overflow-y-auto px-2 pb-3"
          role="listbox"
          aria-label="Categories"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              selectByOffset(1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              selectByOffset(-1);
            }
          }}
        >
          {filtered.map((cat) => {
            const isSelected = cat.id === selectedId;
            return (
              <li key={cat.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => setSelectedId(cat.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors",
                    isSelected
                      ? "bg-primary-light text-primary"
                      : "hover:bg-muted/40",
                  )}
                >
                  <CategoryIcon icon={cat.icon} color={cat.color} size={16} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {cat.name}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-xs",
                      isSelected ? "text-primary/70" : "text-muted-foreground",
                    )}
                  >
                    {cat.children.length}
                  </span>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isSelected ? "text-primary/60" : "text-muted-foreground/40",
                    )}
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">
              {categoryTree.length === 0
                ? "No categories yet. Add one above."
                : "No matching categories."}
            </li>
          )}
        </ul>
      </div>

      <div className="min-w-0 p-6">
        {selected ? (
          <CategoryDetail
            key={selected.id}
            category={selected}
            allParents={categoryTree}
            palette={palette}
            onDeleted={() => {
              const remaining = categoryTree.filter((c) => c.id !== selected.id);
              setSelectedId(remaining[0]?.id ?? null);
            }}
          />
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Select a category to edit its details.
          </p>
        )}
      </div>
    </div>
  );
}

function CategoryDetail({
  category,
  allParents,
  palette,
  onDeleted,
}: {
  category: CategoryWithChildren;
  allParents: CategoryWithChildren[];
  palette: string[];
  onDeleted: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(category.name);
  const [subName, setSubName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setName(category.name);
    setEditingName(false);
    setError(null);
    setSubName("");
  }, [category.id, category.name]);

  function saveName() {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(category.name);
      setEditingName(false);
      return;
    }
    if (trimmed === category.name) {
      setEditingName(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("id", String(category.id));
        formData.set("name", trimmed);
        formData.set("icon", category.icon);
        formData.set("color", category.color);
        await updateCategory(formData);
        setEditingName(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to rename");
        setName(category.name);
      }
    });
  }

  function saveColor(color: string) {
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("id", String(category.id));
        formData.set("name", category.name);
        formData.set("icon", category.icon);
        formData.set("color", color);
        await updateCategory(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update color");
      }
    });
  }

  function saveIcon(icon: string) {
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("id", String(category.id));
        formData.set("name", category.name);
        formData.set("icon", icon);
        formData.set("color", category.color);
        await updateCategory(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update icon");
      }
    });
  }

  function toggleFixed() {
    setError(null);
    startTransition(async () => {
      try {
        await setCategoryFixed(category.id, !category.isFixed);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update fixed flag");
      }
    });
  }

  function handleDelete() {
    const childNote =
      category.children.length > 0
        ? ` This will also delete ${category.children.length} subcategor${
            category.children.length === 1 ? "y" : "ies"
          }.`
        : "";
    if (!window.confirm(`Delete “${category.name}”?${childNote}`)) return;
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("id", String(category.id));
        const result = await deleteCategory(formData);
        if (result && "error" in result && result.error) {
          setError(result.error);
          return;
        }
        onDeleted();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete");
      }
    });
  }

  function handleAddSubcategory() {
    const trimmed = subName.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("name", trimmed);
        formData.set("parentId", String(category.id));
        formData.set("icon", "tag");
        formData.set("color", category.color);
        await addCategory(formData);
        setSubName("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add subcategory");
      }
    });
  }

  return (
    <div className={cn("space-y-6", pending && "opacity-60")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <CategoryIcon icon={category.icon} color={category.color} size={22} />
          <div className="min-w-0">
            {editingName ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveName();
                  }
                  if (e.key === "Escape") {
                    setName(category.name);
                    setEditingName(false);
                  }
                }}
                autoFocus
                className="w-full max-w-xs rounded-md border border-border bg-background px-2 py-1 text-lg font-medium outline-none focus:ring-2 focus:ring-primary/20"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="group flex items-center gap-2 text-left"
              >
                <span className="truncate text-lg font-medium">{category.name}</span>
                <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            )}
            <p className="mt-0.5 text-sm text-muted-foreground">
              {category.children.length === 1
                ? "1 subcategory"
                : `${category.children.length} subcategories`}
            </p>
          </div>
        </div>
        <Button type="button" variant="danger" onClick={handleDelete}>
          Delete
        </Button>
      </div>

      {error && <p className="text-sm text-loss">{error}</p>}

      <div>
        <Label>Color</Label>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {palette.map((color) => {
            const selected = safeHexColor(category.color).toLowerCase() === color;
            return (
              <button
                key={color}
                type="button"
                title={color}
                onClick={() => saveColor(color)}
                className={cn(
                  "h-8 w-8 rounded-full border-2 transition-transform",
                  selected
                    ? "scale-110 border-foreground"
                    : "border-transparent hover:scale-105",
                )}
                style={{ backgroundColor: color }}
                aria-label={`Color ${color}`}
                aria-pressed={selected}
              />
            );
          })}
          <label
            className="relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border bg-card"
            title="Custom color"
          >
            <span
              className="absolute inset-1 rounded-full"
              style={{ backgroundColor: safeHexColor(category.color) }}
            />
            <input
              type="color"
              value={safeHexColor(category.color)}
              onChange={(e) => saveColor(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Custom color"
            />
          </label>
        </div>
      </div>

      <div>
        <Label>Icon</Label>
        <div className="mt-1.5 grid max-h-48 grid-cols-8 gap-1 overflow-y-auto sm:grid-cols-10">
          {AVAILABLE_ICONS.map((key) => {
            const ItemIcon = ICONS[key];
            const isSelected = key === category.icon;
            return (
              <button
                key={key}
                type="button"
                title={key.replace(/-/g, " ")}
                onClick={() => saveIcon(key)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted",
                )}
                aria-pressed={isSelected}
              >
                <ItemIcon size={16} />
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <button
          type="button"
          role="switch"
          aria-checked={category.isFixed}
          onClick={toggleFixed}
          className="flex w-full items-start justify-between gap-4 rounded-lg border border-border/60 px-3 py-3 text-left transition-colors hover:bg-muted/30"
        >
          <div>
            <p className="text-sm font-medium">Fixed expense</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Used to split fixed and variable spend on the Expenses page.
            </p>
          </div>
          <span
            className={cn(
              "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors",
              category.isFixed ? "bg-primary" : "bg-muted",
            )}
            aria-hidden
          >
            <span
              className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-card shadow-sm transition-transform",
                category.isFixed ? "translate-x-4" : "translate-x-0.5",
              )}
            />
          </span>
        </button>
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Subcategories
          </h3>
          <span className="text-xs text-muted-foreground">
            {category.children.length}
          </span>
        </div>
        <div className="mb-3 flex gap-2">
          <Input
            value={subName}
            onChange={(e) => setSubName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddSubcategory();
              }
            }}
            placeholder="Add a subcategory"
            aria-label="Add a subcategory"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleAddSubcategory}
            disabled={!subName.trim()}
          >
            Add
          </Button>
        </div>
        <ul className="divide-y divide-border/40 rounded-lg border border-border/60">
          {category.children.map((child) => (
            <SubcategoryRow
              key={child.id}
              child={child}
              parentColor={category.color}
              parentId={category.id}
              otherParents={allParents.filter((p) => p.id !== category.id)}
            />
          ))}
          {category.children.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No subcategories yet.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function SubcategoryRow({
  child,
  parentColor,
  parentId,
  otherParents,
}: {
  child: { id: number; name: string; color: string; icon: string };
  parentColor: string;
  parentId: number;
  otherParents: CategoryWithChildren[];
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(child.name);
  const [icon, setIcon] = useState(child.icon);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setName(child.name);
    setIcon(child.icon);
    setEditing(false);
    setError(null);
  }, [child.id, child.name, child.icon]);

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(child.name);
      setEditing(false);
      return;
    }
    const unchanged = trimmed === child.name && icon === child.icon;
    if (unchanged) {
      setEditing(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("id", String(child.id));
        formData.set("name", trimmed);
        formData.set("icon", icon);
        formData.set("color", parentColor);
        await updateCategory(formData);
        setEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update");
        setName(child.name);
        setIcon(child.icon);
      }
    });
  }

  function handleMove(nextParentId: string) {
    if (!nextParentId || nextParentId === String(parentId)) return;
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("id", String(child.id));
        formData.set("parentId", nextParentId);
        await updateCategoryParent(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to move");
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete subcategory “${child.name}”?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("id", String(child.id));
        const result = await deleteCategory(formData);
        if (result && "error" in result && result.error) {
          setError(result.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete");
      }
    });
  }

  return (
    <li className={cn("px-3 py-2.5", pending && "opacity-60")}>
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
              if (e.key === "Escape") {
                setName(child.name);
                setIcon(child.icon);
                setEditing(false);
              }
            }}
            autoFocus
            className="min-w-[120px] flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
          <IconPicker
            value={icon}
            onChange={setIcon}
            color={parentColor}
            className="w-40"
          />
          {otherParents.length > 0 && (
            <Select
              className="w-36"
              defaultValue=""
              onChange={(e) => handleMove(e.target.value)}
              aria-label="Move to another category"
            >
              <option value="">Move to…</option>
              {otherParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
          <Button
            type="button"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={handleSave}
          >
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => {
              setName(child.name);
              setIcon(child.icon);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <CategoryIcon icon={child.icon} color={parentColor} size={14} />
          <span className="min-w-0 flex-1 truncate text-sm">{child.name}</span>
          <Button
            type="button"
            variant="ghost"
            className="h-7 w-7 px-0"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${child.name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-7 w-7 px-0 text-loss/70 hover:bg-loss/10 hover:text-loss"
            onClick={handleDelete}
            aria-label={`Delete ${child.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-loss">{error}</p>}
    </li>
  );
}
