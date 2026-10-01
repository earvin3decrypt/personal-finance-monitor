"use client";

import { useState, useTransition } from "react";
import { GripVertical } from "lucide-react";
import {
  deleteCategory,
  updateCategory,
  updateCategoryParent,
} from "@/app/actions/settings";
import { CategoryIcon } from "@/components/category-icon";
import { IconPicker } from "@/components/icon-picker";
import { Button } from "@/components/ui";
import type { CategoryWithChildren } from "@/lib/categories";
import { cn } from "@/lib/utils";

type FlatCategory = {
  id: number;
  name: string;
  color: string;
  icon: string;
  parentId: number | null;
  isTopLevel: boolean;
};

export function CategoryList({
  categoryTree,
}: {
  categoryTree: CategoryWithChildren[];
}) {
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | "top-level" | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const topLevelIds = new Set(categoryTree.map((c) => c.id));

  function handleDragStart(id: number) {
    setDraggedId(id);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDropTargetId(null);
  }

  function handleDropOnCategory(targetId: number) {
    if (draggedId == null || draggedId === targetId) return;
    if (!topLevelIds.has(targetId)) {
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", String(draggedId));
      formData.set("parentId", String(targetId));
      try {
        await updateCategoryParent(formData);
      } catch (err) {
        console.error("Failed to update category parent:", err);
      }
    });
    handleDragEnd();
  }

  function handleDropOnTopLevel() {
    if (draggedId == null) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", String(draggedId));
      formData.set("parentId", "null");
      await updateCategoryParent(formData);
    });
    handleDragEnd();
  }

  return (
    <div className={cn(pending && "pointer-events-none opacity-60")}>
      <ul className="divide-y divide-border/40 rounded-lg border border-border/60">
        {categoryTree.map((parent) => (
          <li key={parent.id}>
            <CategoryRow
              category={{
                id: parent.id,
                name: parent.name,
                color: parent.color,
                icon: parent.icon,
                parentId: null,
                isTopLevel: true,
              }}
              draggedId={draggedId}
              dropTargetId={dropTargetId}
              isDropTarget={topLevelIds.has(parent.id)}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragEnterTarget={(id) => setDropTargetId(id)}
              onDragLeaveTarget={() => setDropTargetId(null)}
              onDropTarget={handleDropOnCategory}
            />
            {parent.children.length > 0 && (
              <ul className="border-t border-border/30 bg-muted/5">
                {parent.children.map((sub) => (
                  <li key={sub.id} className="border-l-2 border-primary/20 ml-5">
                    <CategoryRow
                      category={{
                        id: sub.id,
                        name: sub.name,
                        color: sub.color,
                        icon: sub.icon,
                        parentId: parent.id,
                        isTopLevel: false,
                      }}
                      draggedId={draggedId}
                      dropTargetId={dropTargetId}
                      isDropTarget={false}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDragEnterTarget={(id) => setDropTargetId(id)}
                      onDragLeaveTarget={() => setDropTargetId(null)}
                      onDropTarget={handleDropOnCategory}
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {draggedId != null && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDropTargetId("top-level");
          }}
          onDragLeave={() => {
            if (dropTargetId === "top-level") setDropTargetId(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            handleDropOnTopLevel();
          }}
          className={cn(
            "mt-3 rounded-lg border border-dashed px-4 py-3 text-center text-sm transition-colors",
            dropTargetId === "top-level"
              ? "border-primary bg-primary-light/30 text-primary"
              : "border-border text-muted-foreground",
          )}
        >
          Drop here to make top-level
        </div>
      )}

      {categoryTree.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No categories yet. Add one above.
        </p>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Drag a category onto another to nest it, drop on the zone above to make
        it top-level, or use Edit to change name, icon, and color.
      </p>
    </div>
  );
}

function CategoryRow({
  category,
  draggedId,
  dropTargetId,
  isDropTarget,
  onDragStart,
  onDragEnd,
  onDragEnterTarget,
  onDragLeaveTarget,
  onDropTarget,
}: {
  category: FlatCategory;
  draggedId: number | null;
  dropTargetId: number | "top-level" | null;
  isDropTarget: boolean;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  onDragEnterTarget: (id: number) => void;
  onDragLeaveTarget: () => void;
  onDropTarget: (targetId: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);
  const [editIcon, setEditIcon] = useState(category.icon);
  const [editColor, setEditColor] = useState(category.color);
  const [pending, startTransition] = useTransition();
  const isDragging = draggedId === category.id;
  const isHighlighted =
    isDropTarget && dropTargetId === category.id && draggedId !== category.id;

  function handleSave() {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditName(category.name);
      return;
    }

    const unchanged =
      trimmed === category.name &&
      editIcon === category.icon &&
      editColor === category.color;
    if (unchanged) {
      setIsEditing(false);
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", String(category.id));
      formData.set("name", trimmed);
      formData.set("icon", editIcon);
      formData.set("color", editColor);
      try {
        await updateCategory(formData);
        setIsEditing(false);
      } catch (err) {
        console.error("Failed to update category:", err);
        setEditName(category.name);
        setEditIcon(category.icon);
        setEditColor(category.color);
      }
    });
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditName(category.name);
    setEditIcon(category.icon);
    setEditColor(category.color);
  }

  function startEditing() {
    setEditName(category.name);
    setEditIcon(category.icon);
    setEditColor(category.color);
    setIsEditing(true);
  }

  return (
    <div
      draggable={!isEditing}
      onDragStart={(e) => {
        if (isEditing) return;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(category.id));
        onDragStart(category.id);
      }}
      onDragEnd={onDragEnd}
      onDragOver={
        isDropTarget
          ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }
          : undefined
      }
      onDragEnter={
        isDropTarget
          ? (e) => {
              e.preventDefault();
              onDragEnterTarget(category.id);
            }
          : undefined
      }
      onDragLeave={
        isDropTarget
          ? () => {
              if (dropTargetId === category.id) onDragLeaveTarget();
            }
          : undefined
      }
      onDrop={
        isDropTarget
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onDropTarget(category.id);
            }
          : undefined
      }
      className={cn(
        "group flex items-center gap-2 px-3 py-2.5 transition-colors",
        !category.isTopLevel && "pl-4",
        isDragging && "opacity-40",
        isHighlighted && "bg-primary-light/40",
        !isDragging && !isEditing && "hover:bg-muted/30",
        pending && "opacity-60",
        isEditing && "flex-wrap sm:flex-nowrap",
      )}
    >
      <GripVertical
        className={cn(
          "h-4 w-4 shrink-0 text-muted-foreground/20 group-hover:text-muted-foreground/60",
          isEditing ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        )}
        aria-hidden
      />
      {!isEditing && (
        <CategoryIcon
          icon={category.icon}
          color={category.color}
          size={category.isTopLevel ? 16 : 14}
        />
      )}
      {isEditing ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
              if (e.key === "Escape") handleCancelEdit();
            }}
            autoFocus
            className="min-w-[120px] flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
          <IconPicker
            value={editIcon}
            onChange={setEditIcon}
            color={editColor}
            className="w-44"
          />
          {category.isTopLevel && (
            <input
              type="color"
              value={editColor}
              onChange={(e) => setEditColor(e.target.value)}
              title="Color"
              className="h-9 w-10 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
            />
          )}
          <Button
            type="button"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={handleSave}
            disabled={pending}
          >
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={handleCancelEdit}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <>
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              category.isTopLevel
                ? "font-medium"
                : "text-sm text-muted-foreground",
            )}
          >
            {category.name}
          </span>
          <div className="flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <Button
              type="button"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={startEditing}
            >
              Edit
            </Button>
            <form action={deleteCategory}>
              <input type="hidden" name="id" value={category.id} />
              <Button
                type="submit"
                variant="ghost"
                className="h-7 px-2 text-xs text-loss/70 hover:bg-loss/10 hover:text-loss"
              >
                Remove
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
