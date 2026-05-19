import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  useListGoals, useCreateGoal, useUpdateGoal, useDeleteGoal, useListCategories,
  getListGoalsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Target, ChevronRight, Trash2, MoreHorizontal, TrendingUp,
  CheckCircle2, Circle, Filter, X, Search, Check, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useGoalMilestoneTracker, checkGoalMilestone } from "@/lib/goalMilestones";
import { useLocalStorage } from "@/lib/useLocalStorage";

// ── Constants ─────────────────────────────────────────────────────────────────
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

const priorityColors: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const SORT_OPTIONS = [
  { label: "Due date — soonest", sortBy: "dueDate" as const, sortDir: "asc" as const },
  { label: "Due date — latest",  sortBy: "dueDate" as const, sortDir: "desc" as const },
  { label: "Priority — highest", sortBy: "priority" as const, sortDir: "asc" as const },
  { label: "Alphabetical",       sortBy: "title" as const,   sortDir: "asc" as const },
  { label: "Recently created",   sortBy: "createdAt" as const, sortDir: "desc" as const },
] as const;

type SortBy = (typeof SORT_OPTIONS)[number]["sortBy"];
type SortDir = "asc" | "desc";

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
  categoryId: string;
  dateMode: "none" | "range" | "exact";
  dateStart: string;
  dateEnd: string;
  dateExact: string;
  sortBy: SortBy | "status";
  sortDir: SortDir;
};

const DEFAULT_FILTERS: GoalFilters = {
  search: "",
  statuses: ["all"],
  priorities: ["all"],
  categoryId: "",
  dateMode: "none",
  dateStart: "",
  dateEnd: "",
  dateExact: "",
  sortBy: "dueDate",
  sortDir: "asc",
};

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
  open, onClose, initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: {
    id: number; title: string; description?: string | null; goalType: string;
    priority: string; status: string; targetValue?: number | null;
    currentValue?: number | null; categoryId?: number | null; targetEndDate?: string | null;
  };
}) {
  const qc = useQueryClient();
  const { data: categories } = useListCategories();
  const create = useCreateGoal();
  const update = useUpdateGoal();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [goalType, setGoalType] = useState(initial?.goalType ?? "quantitative");
  const [priority, setPriority] = useState(initial?.priority ?? "medium");
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [targetValue, setTargetValue] = useState(String(initial?.targetValue ?? ""));
  const [currentValue, setCurrentValue] = useState(String(initial?.currentValue ?? "0"));
  const [categoryId, setCategoryId] = useState(String(initial?.categoryId ?? ""));
  const [targetEndDate, setTargetEndDate] = useState(initial?.targetEndDate ?? "");

  const handleSubmit = () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      goalType: goalType as "quantitative" | "milestone" | "habit",
      priority: priority as "high" | "medium" | "low",
      status: status as "active" | "completed" | "paused" | "archived",
      targetValue: targetValue ? Number(targetValue) : undefined,
      currentValue: currentValue ? Number(currentValue) : 0,
      categoryId: categoryId ? Number(categoryId) : undefined,
      targetEndDate: targetEndDate || undefined,
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
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListGoalsQueryKey() });
          toast.success("Goal created");
          onClose();
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
              <Label>Type</Label>
              <Select value={goalType} onValueChange={setGoalType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quantitative">Quantitative</SelectItem>
                  <SelectItem value="milestone">Milestone</SelectItem>
                  <SelectItem value="habit">Habit</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {goalType === "quantitative" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="target-val">Target value</Label>
                <Input id="target-val" type="number" value={targetValue} onChange={e => setTargetValue(e.target.value)} className="mt-1" placeholder="100" />
              </div>
              <div>
                <Label htmlFor="current-val">Current value</Label>
                <Input id="current-val" type="number" value={currentValue} onChange={e => setCurrentValue(e.target.value)} className="mt-1" placeholder="0" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={categoryId || "none"} onValueChange={v => setCategoryId(v === "none" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
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

// ── Quick progress input ───────────────────────────────────────────────────────
function QuickProgressInput({ goal }: {
  goal: {
    id: number; currentValue?: number | null; targetValue?: number | null;
    title: string; goalType: string; priority: string; status: string;
    description?: string | null; categoryId?: number | null; targetEndDate?: string | null;
  }
}) {
  const qc = useQueryClient();
  const update = useUpdateGoal();
  const [delta, setDelta] = useState("");
  const [open, setOpen] = useState(false);

  const handleLog = () => {
    const n = Number(delta);
    if (!delta || isNaN(n)) return;
    const newValue = (goal.currentValue ?? 0) + n;
    update.mutate({ id: goal.id, data: { currentValue: newValue } }, {
      onSuccess: (updated) => {
        qc.invalidateQueries({ queryKey: getListGoalsQueryKey() });
        checkGoalMilestone(updated);
        setDelta(""); setOpen(false);
      },
      onError: () => toast.error("Failed to log progress"),
    });
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors mt-2"
        title="Log progress">
        <TrendingUp className="w-3.5 h-3.5" />Log progress
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
      <span className="text-xs text-muted-foreground">Add</span>
      <Input type="number" value={delta} onChange={e => setDelta(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") handleLog(); if (e.key === "Escape") setOpen(false); }}
        className="h-7 w-24 text-xs" placeholder="e.g. 5" autoFocus />
      <Button size="sm" className="h-7 text-xs px-3" onClick={handleLog} disabled={update.isPending}>Save</Button>
      <button onClick={() => { setDelta(""); setOpen(false); }} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
    </div>
  );
}

// ── GoalCard ──────────────────────────────────────────────────────────────────
function GoalCard({
  goal, overdue, onToggleComplete, onEdit, onDelete, isPending,
}: {
  goal: any;
  overdue: boolean;
  onToggleComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const isCompleted = goal.status === "completed";
  const pct = goal.targetValue && goal.targetValue > 0
    ? Math.min(100, Math.round(((goal.currentValue ?? 0) / goal.targetValue) * 100))
    : 0;

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
            {/* Title + badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-semibold text-foreground ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
                {goal.title}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[goal.priority]}`}>
                {goal.priority}
              </span>
            </div>

            {/* Progress (quantitative goals) */}
            {goal.goalType === "quantitative" && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{goal.currentValue ?? 0} / {goal.targetValue ?? "—"}</span>
                  <span className="font-medium">{pct}%</span>
                </div>
                <Progress value={pct} className="h-1.5" />
                {goal.status === "active" && <QuickProgressInput goal={goal} />}
              </div>
            )}

            {/* Due date */}
            {goal.targetEndDate && (
              <p className={`text-xs mt-1.5 ${overdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                {overdue ? "Was due" : "Due"} {goal.targetEndDate}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Link href={`/goals/${goal.id}`}>
              <Button variant="ghost" size="icon" className="h-7 w-7">
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
                <DropdownMenuItem onClick={onToggleComplete}>
                  {isCompleted ? "Reopen goal" : "Mark complete"}
                </DropdownMenuItem>
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
  const { data: goals, isLoading } = useListGoals();
  const { data: categories = [] } = useListCategories();
  const deleteGoal = useDeleteGoal();
  const updateGoal = useUpdateGoal();

  const [formOpen, setFormOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<typeof goals extends Array<infer T> ? T : any | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [filters, setFilters] = useLocalStorage<GoalFilters>("goals_filters_v2", DEFAULT_FILTERS);

  useGoalMilestoneTracker(goals);

  const today = new Date().toISOString().split("T")[0];
  const thisWeekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

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
      if (f.categoryId && String(g.categoryId ?? "") !== f.categoryId) return false;
      if (f.dateMode === "exact" && f.dateExact && g.targetEndDate !== f.dateExact) return false;
      if (f.dateMode === "range") {
        if (f.dateStart && (g.targetEndDate ?? "") < f.dateStart) return false;
        if (f.dateEnd && (g.targetEndDate ?? "") > f.dateEnd) return false;
      }
      return true;
    });
  }, [goals, filters]);

  const sorted = useMemo(() => {
    const dir = filters.sortDir === "asc" ? 1 : -1;
    const sb = filters.sortBy === "status" ? "dueDate" : filters.sortBy;
    return [...filtered].sort((a, b) => {
      switch (sb) {
        case "dueDate":
          if (!a.targetEndDate && !b.targetEndDate) return 0;
          if (!a.targetEndDate) return dir; if (!b.targetEndDate) return -dir;
          return a.targetEndDate.localeCompare(b.targetEndDate) * dir;
        case "createdAt":
          return ((a as any).createdAt ?? "").localeCompare((b as any).createdAt ?? "") * dir;
        case "priority":
          return ((PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99)) * dir;
        case "title":
          return a.title.localeCompare(b.title) * dir;
        default: return 0;
      }
    });
  }, [filtered, filters.sortBy, filters.sortDir]);

  // ── Section grouping ─────────────────────────────────────────────────────
  const overdueGoals     = sorted.filter(g => isGoalOverdue(g));
  const dueThisWeekGoals = sorted.filter(g =>
    !isGoalOverdue(g) &&
    g.status !== "completed" && g.status !== "archived" &&
    g.targetEndDate && g.targetEndDate >= today && g.targetEndDate <= thisWeekEnd
  );
  const activeGoals      = sorted.filter(g =>
    !isGoalOverdue(g) &&
    g.status !== "completed" && g.status !== "archived" &&
    !(g.targetEndDate && g.targetEndDate >= today && g.targetEndDate <= thisWeekEnd)
  );
  const completedGoals   = sorted.filter(g => g.status === "completed");

  const isFiltered =
    filters.search !== "" || !filters.statuses.includes("all") ||
    !filters.priorities.includes("all") || filters.categoryId !== "" || filters.dateMode !== "none";

  const activeFilterCount = [
    filters.search !== "",
    !filters.statuses.includes("all"),
    !filters.priorities.includes("all"),
    filters.categoryId !== "",
    filters.dateMode !== "none",
  ].filter(Boolean).length;

  const clearFilters = () => setFilters(DEFAULT_FILTERS);
  const setF = (patch: Partial<GoalFilters>) => setFilters({ ...filters, ...patch });

  const activeSortLabel = SORT_OPTIONS.find(
    o => o.sortBy === filters.sortBy && o.sortDir === filters.sortDir
  )?.label ?? "Due date — soonest";

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
    onToggleComplete: () => handleToggleComplete(goal),
    onEdit: () => { setEditGoal(goal); setFormOpen(true); },
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
        <Button onClick={() => { setEditGoal(null); setFormOpen(true); }} data-testid="create-goal">
          <Plus className="w-4 h-4 mr-1.5" /> New goal
        </Button>
      </div>

      {/* Search + Sort (always visible) + Filter toggle */}
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

        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-1.5 text-sm">
              Sort
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {SORT_OPTIONS.map(opt => (
              <DropdownMenuItem
                key={`${opt.sortBy}:${opt.sortDir}`}
                onClick={() => setF({ sortBy: opt.sortBy, sortDir: opt.sortDir })}
                className="flex items-center justify-between"
              >
                {opt.label}
                {activeSortLabel === opt.label && <Check className="w-3.5 h-3.5 text-primary ml-2" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Filter toggle */}
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
            <span className="text-xs font-medium text-muted-foreground pt-0.5 w-14 flex-shrink-0">Status</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: "all", label: "All" },
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
            <span className="text-xs font-medium text-muted-foreground pt-0.5 w-14 flex-shrink-0">Priority</span>
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

          {/* Category + Date */}
          <div className="flex flex-wrap gap-2 items-center">
            {categories.length > 0 && (
              <Select value={filters.categoryId || "all"} onValueChange={v => setF({ categoryId: v === "all" ? "" : v })}>
                <SelectTrigger className="h-8 text-xs w-[150px]">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            <Select value={filters.dateMode} onValueChange={v => setF({ dateMode: v as GoalFilters["dateMode"] })}>
              <SelectTrigger className="h-8 text-xs w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any due date</SelectItem>
                <SelectItem value="exact">Specific date</SelectItem>
                <SelectItem value="range">Date range</SelectItem>
              </SelectContent>
            </Select>

            {filters.dateMode === "exact" && (
              <Input type="date" value={filters.dateExact} onChange={e => setF({ dateExact: e.target.value })}
                className="h-8 text-xs w-[150px]" />
            )}
            {filters.dateMode === "range" && (
              <>
                <Input type="date" value={filters.dateStart} onChange={e => setF({ dateStart: e.target.value })}
                  className="h-8 text-xs w-[140px]" placeholder="From" />
                <span className="text-xs text-muted-foreground">—</span>
                <Input type="date" value={filters.dateEnd} onChange={e => setF({ dateEnd: e.target.value })}
                  className="h-8 text-xs w-[140px]" placeholder="To" />
              </>
            )}
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
        key={editGoal?.id ?? "new"}
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditGoal(null); }}
        initial={editGoal ?? undefined}
      />
    </div>
  );
}
