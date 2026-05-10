import { useState } from "react";
import {
  useListTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useCompleteTask,
  useListGoals,
  useListCategories,
  getListTasksQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, CheckCircle2, Circle, Trash2, MoreHorizontal, CalendarDays, Flag } from "lucide-react";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

const priorityColors: Record<string, string> = {
  urgent: "text-red-500",
  high: "text-orange-500",
  normal: "text-blue-500",
  low: "text-gray-400",
};

const priorityBadge: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  normal: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function TaskForm({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: {
    id: number;
    title: string;
    notes?: string | null;
    priority: string;
    dueDate?: string | null;
    estimatedMinutes?: number | null;
    goalId?: number | null;
    categoryId?: number | null;
    recurrence?: string | null;
  };
}) {
  const qc = useQueryClient();
  const { data: goals } = useListGoals();
  const { data: categories } = useListCategories();
  const create = useCreateTask();
  const update = useUpdateTask();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? "normal");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [estimated, setEstimated] = useState(String(initial?.estimatedMinutes ?? ""));
  const [goalId, setGoalId] = useState(String(initial?.goalId ?? ""));
  const [categoryId, setCategoryId] = useState(String(initial?.categoryId ?? ""));
  const [recurrence, setRecurrence] = useState(initial?.recurrence ?? "none");

  const handleSubmit = () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    const payload: any = {
      title: title.trim(),
      notes: notes.trim() || undefined,
      priority,
      dueDate: dueDate || undefined,
      estimatedMinutes: estimated ? Number(estimated) : undefined,
      goalId: goalId ? Number(goalId) : undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      recurrence: recurrence !== "none" ? recurrence : undefined,
    };
    if (initial) {
      update.mutate({ id: initial.id, data: payload }, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
          toast.success("Task updated");
          onClose();
        },
        onError: () => toast.error("Failed to update task"),
      });
    } else {
      create.mutate({ data: { ...payload, userId: "" } }, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
          toast.success("Task created");
          onClose();
        },
        onError: () => toast.error("Failed to create task"),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be done?" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="task-notes">Notes</Label>
            <Textarea id="task-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional details..." className="mt-1 resize-none" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="due-date">Due date</Label>
              <Input id="due-date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Goal</Label>
              <Select value={goalId || "none"} onValueChange={v => setGoalId(v === "none" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {goals?.filter(g => g.status === "active").map(g => (
                    <SelectItem key={g.id} value={String(g.id)}>{g.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="estimated">Estimated (min)</Label>
              <Input id="estimated" type="number" value={estimated} onChange={e => setEstimated(e.target.value)} className="mt-1" placeholder="25" />
            </div>
            <div>
              <Label>Recurrence</Label>
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>
            {initial ? "Save" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Tasks() {
  const qc = useQueryClient();
  const { data: tasks, isLoading } = useListTasks();
  const deleteTask = useDeleteTask();
  const completeTask = useCompleteTask();

  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [filterPriority, setFilterPriority] = useState("all");

  const filtered = (tasks ?? [])
    .filter(t => filterStatus === "all" || t.status === filterStatus)
    .filter(t => filterPriority === "all" || t.priority === filterPriority);

  const handleComplete = (id: number) => {
    completeTask.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this task?")) return;
    deleteTask.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
        toast.success("Task deleted");
      },
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your daily to-do list</p>
        </div>
        <Button onClick={() => { setEditTask(null); setFormOpen(true); }} data-testid="create-task">
          <Plus className="w-4 h-4 mr-1.5" /> New task
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1.5">
          {["all", "pending", "completed"].map(s => (
            <button
              key={s}
              data-testid={`status-filter-${s}`}
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
        <div className="w-px h-4 bg-border mx-1" />
        <div className="flex gap-1.5">
          {["all", "urgent", "high", "normal", "low"].map(p => (
            <button
              key={p}
              data-testid={`priority-filter-${p}`}
              onClick={() => setFilterPriority(p)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
                filterPriority === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 className="w-12 h-12 text-muted mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">No tasks</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {filterStatus !== "all" || filterPriority !== "all"
              ? "No tasks match the current filter."
              : "Add your first task to get started."}
          </p>
          {filterStatus === "all" && filterPriority === "all" && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Create your first task
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(task => (
            <div
              key={task.id}
              data-testid={`task-${task.id}`}
              className={`flex items-start gap-3 p-3.5 rounded-xl border border-border bg-card hover:shadow-sm transition-all ${
                task.status === "completed" ? "opacity-60" : ""
              }`}
            >
              <button
                data-testid={`complete-${task.id}`}
                onClick={() => handleComplete(task.id)}
                className="mt-0.5 flex-shrink-0"
              >
                {task.status === "completed"
                  ? <CheckCircle2 className="w-5 h-5 text-primary" />
                  : <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {task.title}
                </p>
                {task.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.notes}</p>}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {task.dueDate && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="w-3 h-3" />
                      {task.dueDate === format(new Date(), "yyyy-MM-dd") ? "Today" : task.dueDate}
                    </span>
                  )}
                  {task.estimatedMinutes && (
                    <span className="text-xs text-muted-foreground">{task.estimatedMinutes}m</span>
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priorityBadge[task.priority]}`}>
                    {task.priority}
                  </span>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" data-testid={`task-menu-${task.id}`}>
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setEditTask(task); setFormOpen(true); }}>Edit</DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => handleDelete(task.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      <TaskForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTask(null); }}
        initial={editTask ?? undefined}
      />
    </div>
  );
}
