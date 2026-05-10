import { useState } from "react";
import {
  useListCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  getListCategoriesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Tag, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const ICONS = ["folder", "briefcase", "heart", "book", "code", "dumbbell", "music", "star", "home", "leaf", "trophy", "rocket"];
const COLORS = [
  "#14b8a6", "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#8b5cf6", "#ef4444", "#f97316", "#06b6d4",
];

function CategoryForm({ open, onClose, initial }: {
  open: boolean;
  onClose: () => void;
  initial?: { id: number; name: string; icon: string; color: string; description?: string | null };
}) {
  const qc = useQueryClient();
  const create = useCreateCategory();
  const update = useUpdateCategory();

  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "folder");
  const [color, setColor] = useState(initial?.color ?? "#14b8a6");
  const [description, setDescription] = useState(initial?.description ?? "");

  const handleSubmit = () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    const payload = { name: name.trim(), icon, color, description: description.trim() || undefined };
    if (initial) {
      update.mutate({ id: initial.id, data: payload }, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          toast.success("Category updated");
          onClose();
        },
      });
    } else {
      create.mutate({ data: payload }, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          toast.success("Category created");
          onClose();
        },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit category" : "New category"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="cat-name">Name</Label>
            <Input id="cat-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Health, Work" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="cat-desc">Description</Label>
            <Input id="cat-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional" className="mt-1" />
          </div>
          <div>
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {ICONS.map(ic => (
                <button
                  key={ic}
                  onClick={() => setIcon(ic)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    icon === ic ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-muted-foreground"
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Color</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? "scale-125 ring-2 ring-offset-1 ring-foreground" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>
            {initial ? "Save" : "Create"}
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
  const [editCat, setEditCat] = useState<any>(null);

  const handleDelete = (id: number) => {
    if (!confirm("Delete this category?")) return;
    deleteCategory.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
        toast.success("Category deleted");
      },
    });
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categories</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Organize your goals, tasks, and habits</p>
        </div>
        <Button onClick={() => { setEditCat(null); setFormOpen(true); }} data-testid="create-category">
          <Plus className="w-4 h-4 mr-1.5" /> New category
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : !categories || categories.length === 0 ? (
        <div className="text-center py-16">
          <Tag className="w-12 h-12 text-muted mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">No categories yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Group your activities for better clarity.</p>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Create your first category
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {categories.map(cat => (
            <Card key={cat.id} data-testid={`category-${cat.id}`} className="border-border hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0"
                    style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                  >
                    {cat.icon === "folder" ? "📁" : cat.icon === "briefcase" ? "💼" : cat.icon === "heart" ? "❤️" : cat.icon === "book" ? "📚" : cat.icon === "code" ? "💻" : cat.icon === "dumbbell" ? "🏋️" : cat.icon === "music" ? "🎵" : cat.icon === "star" ? "⭐" : cat.icon === "home" ? "🏠" : cat.icon === "leaf" ? "🌿" : cat.icon === "trophy" ? "🏆" : "🚀"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{cat.name}</p>
                    {cat.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{cat.description}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      data-testid={`edit-cat-${cat.id}`}
                      onClick={() => { setEditCat(cat); setFormOpen(true); }}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      data-testid={`delete-cat-${cat.id}`}
                      onClick={() => handleDelete(cat.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CategoryForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditCat(null); }}
        initial={editCat ?? undefined}
      />
    </div>
  );
}
