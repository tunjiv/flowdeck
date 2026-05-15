import { useState } from "react";
import { Link } from "wouter";
import {
  useListGoals,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  useListCategories,
  getListGoalsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Target, ChevronRight, Trash2, MoreHorizontal, TrendingUp } from "lucide-react";
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

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  paused: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  abandoned: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const priorityColors: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

// ── Goal form ─────────────────────────────────────────────────────────────────
function GoalForm({
  open, onClose, initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: {
    id: number;
    title: string;
    description?: string | null;
    goalType: string;
    priority: string;
    status: string;
    targetValue?: number | null;
    currentValue?: number | null;
    categoryId?: number | null;
    targetEndDate?: string | null;
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

// ── Quick progress log ────────────────────────────────────────────────────────
function QuickProgressInput({ goal }: {
  goal: {
    id: number;
    title: string;
    goalType: string;
    currentValue?: number | null;
    targetValue?: number | null;
    priority: string;
    status: string;
    description?: string | null;
    categoryId?: number | null;
    targetEndDate?: string | null;
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
    update.mutate(
      {
        id: goal.id,
        data: { currentValue: newValue },
      },
      {
        onSuccess: (updated) => {
          qc.invalidateQueries({ queryKey: getListGoalsQueryKey() });
          checkGoalMilestone(updated);
          setDelta("");
          setOpen(false);
        },
        onError: () => toast.error("Failed to log progress"),
      },
    );
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors mt-2"
        title="Log progress"
      >
        <TrendingUp className="w-3.5 h-3.5" />
        Log progress
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
      <span className="text-xs text-muted-foreground">Add</span>
      <Input
        type="number"
        value={delta}
        onChange={e => setDelta(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") handleLog(); if (e.key === "Escape") setOpen(false); }}
        className="h-7 w-24 text-xs"
        placeholder="e.g. 5"
        autoFocus
      />
      <Button size="sm" className="h-7 text-xs px-3" onClick={handleLog} disabled={update.isPending}>
        Save
      </Button>
      <button onClick={() => { setDelta(""); setOpen(false); }} className="text-xs text-muted-foreground hover:text-foreground">
        Cancel
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Goals() {
  const qc = useQueryClient();
  const { data: goals, isLoading } = useListGoals();
  const deleteGoal = useDeleteGoal();

  const [formOpen, setFormOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<typeof goals extends Array<infer T> ? T : any | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");

  // Milestone notifications — fires toasts when a goal crosses 25/50/75/100%
  useGoalMilestoneTracker(goals);

  const filtered = goals?.filter(g => filterStatus === "all" || g.status === filterStatus) ?? [];

  const handleDelete = (id: number) => {
    if (!confirm("Delete this goal?")) return;
    deleteGoal.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListGoalsQueryKey() });
        toast.success("Goal deleted");
      },
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Goals</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track progress toward your biggest ambitions</p>
        </div>
        <Button onClick={() => { setEditGoal(null); setFormOpen(true); }} data-testid="create-goal">
          <Plus className="w-4 h-4 mr-1.5" /> New goal
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", "active", "completed", "paused"].map(s => (
          <button
            key={s}
            data-testid={`filter-${s}`}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
              filterStatus === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Target className="w-12 h-12 text-muted mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">No goals yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Set your first goal and start making progress.</p>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Create your first goal
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(goal => {
            const pct = goal.targetValue && goal.targetValue > 0
              ? Math.min(100, Math.round(((goal.currentValue ?? 0) / goal.targetValue) * 100))
              : 0;

            // Milestone ring color
            const milestoneColor =
              pct >= 100 ? "text-primary" :
              pct >= 75  ? "text-orange-500" :
              pct >= 50  ? "text-amber-500" :
              pct >= 25  ? "text-blue-500" :
              "text-muted-foreground";

            return (
              <Card key={goal.id} data-testid={`goal-${goal.id}`} className="border-border hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Target className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-semibold text-foreground">{goal.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[goal.status]}`}>
                          {goal.status}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[goal.priority]}`}>
                          {goal.priority}
                        </span>
                        {pct >= 25 && goal.goalType === "quantitative" && (
                          <span className={`text-xs font-semibold ${milestoneColor}`}>
                            {pct >= 100 ? "🏆 Complete" : pct >= 75 ? "🔥 Almost there" : pct >= 50 ? "⚡ Halfway" : "🎯 Started"}
                          </span>
                        )}
                      </div>
                      {goal.description && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-1">{goal.description}</p>
                      )}
                      {goal.goalType === "quantitative" && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>{goal.currentValue ?? 0} / {goal.targetValue ?? "—"}</span>
                            <span className="font-medium">{pct}%</span>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                          {goal.status === "active" && (
                            <QuickProgressInput goal={goal} />
                          )}
                        </div>
                      )}
                      {goal.targetEndDate && (
                        <p className="text-xs text-muted-foreground mt-1.5">Due {goal.targetEndDate}</p>
                      )}
                    </div>
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
                          <DropdownMenuItem onClick={() => { setEditGoal(goal); setFormOpen(true); }}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(goal.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <GoalForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditGoal(null); }}
        initial={editGoal ?? undefined}
      />
    </div>
  );
}
