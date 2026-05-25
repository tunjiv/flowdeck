import { useState } from "react";
import {
  useListCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
  getListCategoriesQueryKey,
} from "@workspace/api-client-react";
import type { Category } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Tag, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const COLORS = [
  "#14b8a6", "#0ea5e9", "#6366f1", "#a855f7", "#ec4899",
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#64748b",
];

const ICONS = ["🎯", "💼", "📚", "🏋️", "🧘", "💡", "🎨", "🏠", "❤️", "🌱", "💰", "🎵"];

type FormInitial = {
  id: number;
  name: string;
  icon: string;
  color: string;
  description?: string | null;
};

function CategoryForm({
  open, onClose, initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: FormInitial;
}) {
  const qc = useQueryClient();
  const create = useCreateCategory();
  const update = useUpdateCategory();

  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? ICONS[0]!);
  const [color, setColor] = useState(initial?.color ?? COLORS[0]!);
  const [description, setDescription] = useState(initial?.description ?? "");

  const handleSubmit = () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    const payload = {
      name: name.trim(),
      icon,
      color,
      description: description.trim() || undefined,
    };
    if (initial) {
      update.mutate({ id: initial.id, data: payload }, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          toast.success("Category updated");
          onClose();
        },
        onError: () => toast.error("Failed to update category"),
      });
    } else {
      create.mutate({ data: payload }, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          toast.success("Category created");
          onClose();
        },
        onError: () => toast.error("Failed to create category"),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit category" : "New category"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Health, Career"
              className="mt-1"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="cat-desc">Description</Label>
            <Textarea
              id="cat-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional"
              className="mt-1 resize-none"
              rows={2}
            />
          </div>
          <div>
            <Label className="block mb-2">Icon</Label>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`w-9 h-9 rounded-lg text-lg transition-all flex items-center justify-center border ${
                    icon === emoji
                      ? "border-primary bg-primary/10 scale-110"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="block mb-2">Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === c ? "scale-125 ring-2 ring-offset-1 ring-foreground" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>
            {initial ? "Save" : "Create category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Categories() {
  const qc = useQueryClient();
  const { data: categories, isLoading } = useListCategories();
  const deleteCategory = useDeleteCategory();

  const [formOpen, setFormOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);

  const handleDelete = (id: number) => {
    if (!confirm("Delete this category? Goals and tasks using it will be uncategorised.")) return;
    deleteCategory.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
        toast.success("Category deleted");
      },
      onError: () => toast.error("Failed to delete category"),
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categories</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Group goals, tasks and habits with shared themes.
          </p>
        </div>
        <Button onClick={() => { setEditCategory(null); setFormOpen(true); }} data-testid="create-category">
          <Plus className="w-4 h-4 mr-1.5" /> New category
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : !categories || categories.length === 0 ? (
        <div className="text-center py-16">
          <Tag className="w-12 h-12 text-muted mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">No categories yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first category to start organising goals.
          </p>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Create your first category
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map(cat => (
            <Card key={cat.id} className="border-border hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                  >
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{cat.name}</span>
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                    </div>
                    {cat.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {cat.description}
                      </p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditCategory(cat); setFormOpen(true); }}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDelete(cat.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CategoryForm
        key={editCategory?.id ?? "new"}
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditCategory(null); }}
        initial={editCategory ?? undefined}
      />
    </div>
  );
}
