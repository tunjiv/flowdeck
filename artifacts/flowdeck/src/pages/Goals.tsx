import { useState, useMemo } from "react";
import { useLocation, Link } from "wouter";
import {
  useListGoals, useCreateGoal, useUpdateGoal, useDeleteGoal,
  useListCategories,
  getListGoalsQueryKey,
} from "@workspace/api-client-react";
import type { Goal, Category } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";
import {
  Plus, Target, Trash2, MoreHorizontal,
  CheckCircle2, Circle, Filter, X, Search, ChevronDown, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useGoalMilestoneTracker, checkGoalMilestone } from "@/lib/goalMilestones";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { DateRangeFilter } from "@/components/DateRangeFilter";

// ── Constants ─────────────────────────────────────────────────────────────────
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

const priorityColors: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function toggleMulti(current: string[], value: string): string[] {
  if (value === "all") return ["all"];
  const without = current.filter(v => v !== "all");
  if (without.includes(value)) {
    const next = without.filter(v => v !== value);
    return next.length === 0 ? ["all"] : next;
  }
  return [...without, value];
}

function Chip({
  label, active, onClick, variant = "default",
}: {
  label: string; active: boolean; onClick: () => void; variant?: "default" | "red";
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
        active
          ? variant === "red"
            ? "bg-red-500 text-white"
            : "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/70"
      }`}
    >
      {label}
    </button>
  );
}

type GoalFilters = {
  search: string;
  statuses: string[];
  priorities: string[];
  categoryId: string;   // "all" or numeric id as string
  dateFrom: string;     // ISO yyyy-mm-dd
  dateTo: string;       // ISO yyyy-mm-dd
};

const DEFAULT_FILTERS: GoalFilters = {
  search: "",
  statuses: ["all"],
  priorities: ["all"],
  categoryId: "all",
  dateFrom: "",
  dateTo: "",
};

function strToDate(s: string): Date | undefined {
  if (!s) return undefined;
  // Parse as local date to avoid timezone drift.
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}
function dateToStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ── GoalSection ───────────────────────────────────────────────────────────────
function GoalSection({
  label, count, collapsible = false, open, onToggle, children,
}: {
  label: string;
  count: number;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  const isOpen = !collapsible || open;

  return (
    <div className="space-y-2">
      <button
        className={`flex items-center gap-2 w-full text-left ${collapsible ? "cursor-pointer" : "cursor-default"}`}
        onClick={collapsible ? onToggle : undefined}
        disabled={!collapsible}
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
          {count}
        </span>
        {collapsible && (
          <ChevronDown
            className={`w-3.5 h-3.5 text-muted-foreground ml-auto transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        )}
      </button>
      {isOpen && <div className="space-y-2">{children}</div>}
    </div>
  );
}

// ── GoalForm ──────────────────────────────────────────────────────────────────
function GoalForm({
  open, onClose, initial, categories, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  initial?: {
    id: number; title: string; description?: string | null; goalType: string;
    priority: string; status: string; targetValue?: number | null;
    currentValue?: number | null; targetEndDate?: string | null;
    startDate?: string | null;
    categoryId?: number | null;
  };
  categories: Category[] | undefined;
  onCreated?: (goal: Goal) => void;
}) {
  const qc = useQueryClient();
  const create = useCreateGoal();
  const update = useUpdateGoal();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? "medium");
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [targetEndDate, setTargetEndDate] = useState(initial?.targetEndDate ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId != null ? String(initial.categoryId) : "none"
  );

  const handleSubmit = () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      // Type, target & current value are no longer editable; default to milestone
      // (preserve existing goalType on update so old quantitative/habit goals keep working).
      goalType: (initial?.goalType ?? "milestone") as "quantitative" | "milestone" | "habit",
      priority: priority as "high" | "medium" | "low",
      status: status as "not_started" | "active" | "completed" | "paused" | "archived",
      startDate: startDate || undefined,
      targetEndDate: targetEndDate || undefined,
      // Send explicit null when uncategorising so the server clears it,
      // rather than dropping the field and leaving the prior value in place.
      categoryId: categoryId === "none" ? null : Number(categoryId),
    };
    if (initial) {
      update.mutate({ id: initial.id, data: payload }, {
        onSuccess: (updated) => {
          qc.invalidateQueries({ queryKey: getListGoalsQueryKey() });
          checkGoalMilestone(updated);
          toast.success("Goal updated");
          onClose();
        },
        onError: () => toast.error("Failed to update goal"),
      });
    } else {
      create.mutate({ data: payload }, {
        onSuccess: (created) => {
          qc.invalidateQueries({ queryKey: getListGoalsQueryKey() });
          toast.success("Goal created");
          onClose();
          if (created) onCreated?.(created);
        },
        onError: () => toast.error("Failed to create goal"),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit goal" : "New goal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="goal-title">Title</Label>
            <Input id="goal-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Run 100km" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="goal-desc">Description</Label>
            <Textarea id="goal-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Why does this matter?" className="mt-1 resize-none" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not started</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(categories ?? []).map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.icon} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="start-date">Start date</Label>
              <Input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="end-date">Target date</Label>
              <Input id="end-date" type="date" value={targetEndDate} onChange={e => setTargetEndDate(e.target.value)} className="mt-1" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>
            {initial ? "Save" : "Create goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── GoalCard ──────────────────────────────────────────────────────────────────
function GoalCard({
  goal, overdue, category, onToggleComplete, onEdit, onDelete, isPending,
}: {
  goal: Goal;
  overdue: boolean;
  category?: Category;
  onToggleComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const isCompleted = goal.status === "completed";

  return (
    <Card
      data-testid={`goal-${goal.id}`}
      className={`border-border hover:shadow-sm transition-shadow ${isCompleted ? "opacity-60" : ""} ${overdue ? "border-l-4 border-l-red-400" : ""}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Completion toggle */}
          <button
            onClick={onToggleComplete}
            className="mt-0.5 flex-shrink-0 transition-colors"
            title={isCompleted ? "Mark as active" : "Mark as complete"}
            disabled={isPending}
          >
            {isCompleted
              ? <CheckCircle2 className="w-5 h-5 text-primary" />
              : <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />}
          </button>

          {/* Body */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-semibold text-foreground ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                {goal.title}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[goal.priority]}`}>
                {goal.priority}
              </span>
              {category && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1"
                  style={{ backgroundColor: `${category.color}20`, color: category.color }}
                >
                  <span>{category.icon}</span>
                  <span>{category.name}</span>
                </span>
              )}
            </div>

            {goal.targetEndDate && (
              <p className={`text-xs mt-1.5 ${overdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                {overdue ? "Was due" : "Due"} {goal.targetEndDate}
              </p>
            )}

          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Link href={`/goals/view/${goal.id}`}>
              <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`goal-drilldown-${goal.id}`} title="View details">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`goal-menu-${goal.id}`}>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Goals() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const { data: goals, isLoading } = useListGoals();
  const { data: categories } = useListCategories();
  const deleteGoal = useDeleteGoal();
  const updateGoal = useUpdateGoal();

  const [formOpen, setFormOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<typeof goals extends Array<infer T> ? T : any | null>(null);
  const [formNonce, setFormNonce] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [filters, setFilters] = useLocalStorage<GoalFilters>("goals_filters_v3", DEFAULT_FILTERS);

  // Post-create habit prompt
  const [habitPromptGoal, setHabitPromptGoal] = useState<Goal | null>(null);

  useGoalMilestoneTracker(goals);

  const today = dateToStr(new Date());
  const thisWeekEnd = dateToStr(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  const categoriesById = useMemo(() => {
    const map = new Map<number, Category>();
    (categories ?? []).forEach(c => map.set(c.id, c));
    return map;
  }, [categories]);

  const dateRange: DateRange | null = (filters.dateFrom || filters.dateTo)
    ? { from: strToDate(filters.dateFrom), to: strToDate(filters.dateTo) }
    : null;

  const setDateRange = (r: DateRange | null) => {
    setF({
      dateFrom: r?.from ? dateToStr(r.from) : "",
      dateTo:   r?.to   ? dateToStr(r.to)   : "",
    });
  };

  const isGoalOverdue = (g: NonNullable<typeof goals>[number]) =>
    !!(g.targetEndDate && g.targetEndDate < today && g.status !== "completed" && g.status !== "archived");

  const filtered = useMemo(() => {
    const f = filters;
    return (goals ?? []).filter(g => {
      if (f.search) {
        const q = f.search.toLowerCase();
        if (!g.title.toLowerCase().includes(q) && !(g.description ?? "").toLowerCase().includes(q))
          return false;
      }
      if (!f.statuses.includes("all")) {
        const overdue = isGoalOverdue(g);
        const match = (f.statuses.includes("overdue") && overdue) || f.statuses.includes(g.status);
        if (!match) return false;
      }
      if (!f.priorities.includes("all") && !f.priorities.includes(g.priority)) return false;
      if (f.categoryId !== "all") {
        if (f.categoryId === "none") {
          if (g.categoryId != null) return false;
        } else if (String(g.categoryId ?? "") !== f.categoryId) {
          return false;
        }
      }
      if (f.dateFrom || f.dateTo) {
        const due = g.targetEndDate ?? "";
        if (!due) return false;
        if (f.dateFrom && due < f.dateFrom) return false;
        if (f.dateTo   && due > f.dateTo)   return false;
      }
      return true;
    });
  }, [goals, filters]);

  // Fixed default sort: due date ascending, then by priority, then by creation.
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aDue = a.targetEndDate ?? "";
      const bDue = b.targetEndDate ?? "";
      if (aDue && bDue && aDue !== bDue) return aDue.localeCompare(bDue);
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;
      const ap = PRIORITY_RANK[a.priority] ?? 99;
      const bp = PRIORITY_RANK[b.priority] ?? 99;
      if (ap !== bp) return ap - bp;
      return ((b as any).createdAt ?? "").localeCompare((a as any).createdAt ?? "");
    });
  }, [filtered]);

  const overdueGoals = sorted.filter(g => isGoalOverdue(g));
  const dueThisWeekGoals = sorted.filter(g =>
    !isGoalOverdue(g) &&
    g.status === "active" &&
    !!(g.targetEndDate && g.targetEndDate >= today && g.targetEndDate <= thisWeekEnd)
  );
  const completedGoals = sorted.filter(g => g.status === "completed");
  const activeGoals = sorted.filter(g =>
    !isGoalOverdue(g) &&
    (g.status === "active" || g.status === "paused") &&
    !(g.status === "active" && g.targetEndDate && g.targetEndDate >= today && g.targetEndDate <= thisWeekEnd)
  );

  const isFiltered =
    filters.search !== "" || !filters.statuses.includes("all") ||
    !filters.priorities.includes("all") || filters.categoryId !== "all" ||
    !!filters.dateFrom || !!filters.dateTo;

  const activeFilterCount = [
    filters.search !== "",
    !filters.statuses.includes("all"),
    !filters.priorities.includes("all"),
    filters.categoryId !== "all",
    !!(filters.dateFrom || filters.dateTo),
  ].filter(Boolean).length;

  const clearFilters = () => setFilters(DEFAULT_FILTERS);
  function setF(patch: Partial<GoalFilters>) { setFilters({ ...filters, ...patch }); }

  const handleDelete = (id: number) => {
    if (!confirm("Delete this goal?")) return;
    deleteGoal.mutate({ id }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListGoalsQueryKey() }); toast.success("Goal deleted"); },
    });
  };

  const handleToggleComplete = (goal: NonNullable<typeof goals>[number]) => {
    const newStatus = goal.status === "completed" ? "active" : "completed";
    updateGoal.mutate({ id: goal.id, data: { status: newStatus } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListGoalsQueryKey() });
        toast.success(newStatus === "completed" ? "Goal marked complete 🎉" : "Goal reopened");
      },
      onError: () => toast.error("Failed to update goal"),
    });
  };

  const goalCardProps = (goal: NonNullable<typeof goals>[number], overdue: boolean) => ({
    goal,
    overdue,
    category: goal.categoryId != null ? categoriesById.get(goal.categoryId) : undefined,
    onToggleComplete: () => handleToggleComplete(goal),
    onEdit: () => { setEditGoal(goal); setFormNonce(n => n + 1); setFormOpen(true); },
    onDelete: () => handleDelete(goal.id),
    isPending: updateGoal.isPending,
  });

  const hasAnyGoals = sorted.length > 0;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Goals</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track progress toward your biggest ambitions</p>
        </div>
        <Button onClick={() => { setEditGoal(null); setFormNonce(n => n + 1); setFormOpen(true); }} data-testid="create-goal">
          <Plus className="w-4 h-4 mr-1.5" /> New goal
        </Button>
      </div>

      {/* Search + Filter toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={filters.search}
            onChange={e => setF({ search: e.target.value })}
            placeholder="Search goals…"
            className="pl-9"
          />
          {filters.search && (
            <button
              onClick={() => setF({ search: "" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="relative">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setFiltersOpen(v => !v)}
            className={filtersOpen ? "bg-muted" : ""}
            title="Toggle filters"
          >
            <Filter className="w-4 h-4" />
          </Button>
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold pointer-events-none">
              {activeFilterCount}
            </span>
          )}
        </div>
      </div>

      {/* Collapsible filter panel */}
      {filtersOpen && (
        <div className="space-y-3 p-4 bg-muted/30 rounded-xl border border-border">
          {/* Status chips */}
          <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
            <span className="text-xs font-medium text-muted-foreground pt-0.5 w-16 flex-shrink-0">Status</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: "all", label: "All" },
                { value: "not_started", label: "Not started" },
                { value: "active", label: "Active" },
                { value: "completed", label: "Completed" },
                { value: "paused", label: "Paused" },
                { value: "archived", label: "Archived" },
                { value: "overdue", label: "Overdue" },
              ].map(s => (
                <Chip key={s.value} label={s.label}
                  active={filters.statuses.includes(s.value)}
                  onClick={() => setF({ statuses: toggleMulti(filters.statuses, s.value) })}
                  variant={s.value === "overdue" ? "red" : "default"}
                />
              ))}
            </div>
          </div>

          {/* Priority chips */}
          <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
            <span className="text-xs font-medium text-muted-foreground pt-0.5 w-16 flex-shrink-0">Priority</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: "all", label: "All" },
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
              ].map(p => (
                <Chip key={p.value} label={p.label}
                  active={filters.priorities.includes(p.value)}
                  onClick={() => setF({ priorities: toggleMulti(filters.priorities, p.value) })}
                />
              ))}
            </div>
          </div>

          {/* Category + Date row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground w-16 flex-shrink-0">Category</span>
              <Select value={filters.categoryId} onValueChange={v => setF({ categoryId: v })}>
                <SelectTrigger className="h-8 text-xs w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="none">Uncategorised</SelectItem>
                  {(categories ?? []).map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground w-12 flex-shrink-0">Due</span>
              <DateRangeFilter value={dateRange} onChange={setDateRange} allTimeLabel="Any date" />
            </div>
          </div>
        </div>
      )}

      {/* Result count + clear */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Loading…" : (
            <>
              <span className="font-medium text-foreground">{sorted.length}</span>
              {" "}goal{sorted.length !== 1 ? "s" : ""}
              {isFiltered && goals && ` of ${goals.length}`}
            </>
          )}
        </p>
        {isFiltered && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-3 h-3" /> Clear filters
          </button>
        )}
      </div>

      {/* Goal list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : !hasAnyGoals ? (
        <div className="text-center py-16">
          <Target className="w-12 h-12 text-muted mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">
            {isFiltered ? "No goals match your filters" : "No goals yet"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {isFiltered
              ? "Try adjusting or clearing your filters."
              : "Set your first goal and start making progress."}
          </p>
          {isFiltered ? (
            <Button variant="outline" onClick={clearFilters}><X className="w-4 h-4 mr-1.5" /> Clear filters</Button>
          ) : (
            <Button onClick={() => setFormOpen(true)}><Plus className="w-4 h-4 mr-1.5" /> Create your first goal</Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <GoalSection label="Overdue" count={overdueGoals.length}>
            {overdueGoals.map(g => <GoalCard key={g.id} {...goalCardProps(g, true)} />)}
          </GoalSection>

          <GoalSection label="Due this week" count={dueThisWeekGoals.length}>
            {dueThisWeekGoals.map(g => <GoalCard key={g.id} {...goalCardProps(g, false)} />)}
          </GoalSection>

          <GoalSection label="Active" count={activeGoals.length}>
            {activeGoals.map(g => <GoalCard key={g.id} {...goalCardProps(g, false)} />)}
          </GoalSection>

          <GoalSection
            label="Completed"
            count={completedGoals.length}
            collapsible
            open={completedOpen}
            onToggle={() => setCompletedOpen(v => !v)}
          >
            {completedGoals.map(g => <GoalCard key={g.id} {...goalCardProps(g, false)} />)}
          </GoalSection>
        </div>
      )}

      <GoalForm
        key={`${editGoal?.id ?? "new"}-${formNonce}`}
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditGoal(null); }}
        initial={editGoal ?? undefined}
        categories={categories}
        onCreated={(g) => setHabitPromptGoal(g)}
      />

      {/* Post-create: prompt to make a linked habit */}
      <Dialog open={!!habitPromptGoal} onOpenChange={(o) => { if (!o) setHabitPromptGoal(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add a habit for this goal?</DialogTitle>
            <DialogDescription>
              Habits help you make steady progress toward "{habitPromptGoal?.title}".
              You can always add one later from the Habits page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHabitPromptGoal(null)}>
              Not now
            </Button>
            <Button onClick={() => {
              const g = habitPromptGoal;
              setHabitPromptGoal(null);
              if (g) navigate(`/habits?goalId=${g.id}`);
            }}>
              Create habit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
