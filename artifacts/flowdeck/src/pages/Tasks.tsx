import { useState, useRef, useMemo } from "react";
import {
  useListTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useCompleteTask,
  useListGoals,
  useListCategories,
  useListSubtasks,
  useCreateSubtask,
  useToggleSubtask,
  useDeleteSubtask,
  useListTags,
  useCreateTag,
  useListTaskTagAssociations,
  useAddTagToTask,
  useRemoveTagFromTask,
  getListTasksQueryKey,
  getListSubtasksQueryKey,
  getListTaskTagAssociationsQueryKey,
  getListTagsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, CheckCircle2, Circle, Trash2, MoreHorizontal,
  CalendarDays, Repeat2, ChevronDown, ChevronRight, X, Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

const priorityBadge: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  normal: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

// ── Tag picker inline ─────────────────────────────────────────────────────────
const TAG_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899", "#14b8a6", "#8b5cf6"];

function TagPicker({ taskId, assignedTagIds }: { taskId: number; assignedTagIds: number[] }) {
  const qc = useQueryClient();
  const { data: allTags = [] } = useListTags();
  const add = useAddTagToTask();
  const remove = useRemoveTagFromTask();
  const createTag = useCreateTag();
  const [showPicker, setShowPicker] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [showNewForm, setShowNewForm] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListTaskTagAssociationsQueryKey() });
  const invalidateTags = () => qc.invalidateQueries({ queryKey: getListTagsQueryKey() });

  const toggle = (tagId: number) => {
    const has = assignedTagIds.includes(tagId);
    if (has) {
      remove.mutate({ taskId, tagId }, { onSuccess: invalidate, onError: () => toast.error("Failed to remove tag") });
    } else {
      add.mutate({ taskId, tagId }, { onSuccess: invalidate, onError: () => toast.error("Failed to add tag") });
    }
  };

  const handleCreateTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    createTag.mutate(
      { data: { name, color: newTagColor } },
      {
        onSuccess: () => {
          invalidateTags();
          setNewTagName("");
          setNewTagColor(TAG_COLORS[0]);
          setShowNewForm(false);
          toast.success("Tag created");
        },
        onError: () => toast.error("Failed to create tag"),
      },
    );
  };

  return (
    <div className="mt-1" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setShowPicker(v => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Tag className="w-3 h-3" />
        {showPicker ? "Hide tags" : "Manage tags"}
      </button>
      {showPicker && (
        <div className="mt-2 space-y-2">
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {allTags.map(tag => {
                const active = assignedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggle(tag.id)}
                    className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-all ${
                      active
                        ? "border-transparent text-white"
                        : "border-border text-muted-foreground hover:border-foreground/30"
                    }`}
                    style={active ? { backgroundColor: tag.color } : {}}
                  >
                    {active && <X className="w-2.5 h-2.5" />}
                    {tag.name}
                  </button>
                );
              })}
            </div>
          )}
          {!showNewForm ? (
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-3 h-3" /> New tag
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="flex gap-1">
                {TAG_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewTagColor(c)}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${newTagColor === c ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <input
                autoFocus
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreateTag(); if (e.key === "Escape") setShowNewForm(false); }}
                placeholder="Tag name…"
                className="flex-1 text-xs px-2 py-0.5 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button onClick={handleCreateTag} className="text-xs text-primary hover:underline">Add</button>
              <button onClick={() => setShowNewForm(false)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Subtask + tag panel ────────────────────────────────────────────────────────
function TaskPanel({ taskId, assignedTagIds }: { taskId: number; assignedTagIds: number[] }) {
  const qc = useQueryClient();
  const { data: subtasks = [], isLoading } = useListSubtasks(taskId);
  const create = useCreateSubtask();
  const toggle = useToggleSubtask();
  const del = useDeleteSubtask();
  const [newTitle, setNewTitle] = useState("");

  const done = subtasks.filter(s => s.completed).length;
  const total = subtasks.length;

  const invalidate = () => qc.invalidateQueries({ queryKey: getListSubtasksQueryKey(taskId) });

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    create.mutate(
      { taskId, data: { title } },
      { onSuccess: () => { invalidate(); setNewTitle(""); }, onError: () => toast.error("Failed to add subtask") },
    );
  };

  return (
    <div className="pb-3 px-3.5" onClick={e => e.stopPropagation()}>
      {/* Tags section */}
      <div className="pl-8 pt-0.5">
        <TagPicker taskId={taskId} assignedTagIds={assignedTagIds} />
      </div>

      {/* Divider */}
      <div className="pl-8 mt-2">
        <p className="text-xs font-medium text-muted-foreground mb-1.5">Subtasks</p>

        {/* Progress bar */}
        {total > 0 && (
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${total > 0 ? Math.round((done / total) * 100) : 0}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{done}/{total}</span>
          </div>
        )}

        {/* Subtask list */}
        {isLoading ? (
          <div className="space-y-1">{[1, 2].map(i => <Skeleton key={i} className="h-6 rounded" />)}</div>
        ) : (
          <div className="space-y-0.5">
            {subtasks.map(s => (
              <div key={s.id} className="flex items-center gap-2 group/sub py-0.5">
                <button onClick={() => toggle.mutate({ taskId, id: s.id }, { onSuccess: invalidate })} className="flex-shrink-0">
                  {s.completed
                    ? <CheckCircle2 className="w-4 h-4 text-primary" />
                    : <Circle className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />}
                </button>
                <span className={`flex-1 text-xs ${s.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {s.title}
                </span>
                <button
                  onClick={() => del.mutate({ taskId, id: s.id }, { onSuccess: invalidate })}
                  className="opacity-0 group-hover/sub:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add subtask */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
            placeholder="Add subtask…"
            className="flex-1 text-xs bg-transparent border-b border-dashed border-border focus:border-primary outline-none py-0.5 placeholder:text-muted-foreground/50"
          />
          {newTitle.trim() && (
            <button onClick={handleAdd} disabled={create.isPending} className="text-xs text-primary hover:text-primary/80 font-medium">
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Task form ─────────────────────────────────────────────────────────────────
function TaskForm({ open, onClose, initial }: {
  open: boolean;
  onClose: () => void;
  initial?: {
    id: number; title: string; notes?: string | null; priority: string;
    dueDate?: string | null; estimatedMinutes?: number | null;
    goalId?: number | null; categoryId?: number | null; recurrence?: string | null;
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
    const payload = {
      title: title.trim(),
      notes: notes.trim() || undefined,
      priority: priority as "urgent" | "high" | "normal" | "low",
      dueDate: dueDate || undefined,
      estimatedMinutes: estimated ? Number(estimated) : undefined,
      goalId: goalId ? Number(goalId) : undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      recurrence: recurrence !== "none" ? recurrence : undefined,
    };
    if (initial) {
      update.mutate({ id: initial.id, data: payload }, {
        onSuccess: () => { qc.invalidateQueries({ queryKey: getListTasksQueryKey() }); toast.success("Task updated"); onClose(); },
        onError: () => toast.error("Failed to update task"),
      });
    } else {
      create.mutate({ data: payload }, {
        onSuccess: () => { qc.invalidateQueries({ queryKey: getListTasksQueryKey() }); toast.success("Task created"); onClose(); },
        onError: () => toast.error("Failed to create task"),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{initial ? "Edit task" : "New task"}</DialogTitle></DialogHeader>
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Tasks() {
  const qc = useQueryClient();
  const { data: tasks, isLoading } = useListTasks();
  const { data: allTags = [] } = useListTags();
  const { data: taskTagAssociations = [] } = useListTaskTagAssociations();
  const deleteTask = useDeleteTask();
  const completeTask = useCompleteTask();

  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterTagId, setFilterTagId] = useState<number | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());

  // Build a Map<taskId, tagId[]> from the associations list
  const taskTagMap = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const { taskId, tagId } of taskTagAssociations) {
      const list = map.get(taskId) ?? [];
      list.push(tagId);
      map.set(taskId, list);
    }
    return map;
  }, [taskTagAssociations]);

  // Build tag lookup map
  const tagMap = useMemo(() => new Map(allTags.map(t => [t.id, t])), [allTags]);

  // Count tasks per tag (for filter bar badges)
  const tagTaskCount = useMemo(() => {
    const counts = new Map<number, number>();
    for (const [, tagIds] of taskTagMap) {
      for (const tid of tagIds) counts.set(tid, (counts.get(tid) ?? 0) + 1);
    }
    return counts;
  }, [taskTagMap]);

  const toggleExpand = (id: number) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    return (tasks ?? [])
      .filter(t => filterStatus === "all" || t.status === filterStatus)
      .filter(t => filterPriority === "all" || t.priority === filterPriority)
      .filter(t => filterTagId === null || (taskTagMap.get(t.id) ?? []).includes(filterTagId));
  }, [tasks, filterStatus, filterPriority, filterTagId, taskTagMap]);

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
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListTasksQueryKey() }); toast.success("Task deleted"); },
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

      {/* Status + priority filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1.5">
          {["all", "pending", "completed"].map(s => (
            <button key={s} data-testid={`status-filter-${s}`} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${filterStatus === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-border mx-1" />
        <div className="flex gap-1.5">
          {["all", "urgent", "high", "normal", "low"].map(p => (
            <button key={p} data-testid={`priority-filter-${p}`} onClick={() => setFilterPriority(p)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${filterPriority === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Tag className="w-3 h-3" /> Tags:
          </span>
          {allTags.map(tag => {
            const active = filterTagId === tag.id;
            const count = tagTaskCount.get(tag.id) ?? 0;
            return (
              <button
                key={tag.id}
                onClick={() => setFilterTagId(active ? null : tag.id)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
                  active ? "border-transparent text-white shadow-sm" : "border-border text-muted-foreground hover:border-foreground/30"
                }`}
                style={active ? { backgroundColor: tag.color } : {}}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: active ? "rgba(255,255,255,0.6)" : tag.color }}
                />
                {tag.name}
                {count > 0 && <span className="opacity-60">{count}</span>}
              </button>
            );
          })}
          {filterTagId !== null && (
            <button onClick={() => setFilterTagId(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 className="w-12 h-12 text-muted mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">No tasks</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {filterStatus !== "all" || filterPriority !== "all" || filterTagId !== null
              ? "No tasks match the current filter."
              : "Add your first task to get started."}
          </p>
          {filterStatus === "all" && filterPriority === "all" && filterTagId === null && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Create your first task
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(task => {
            const expanded = expandedTasks.has(task.id);
            const taskTagIds = taskTagMap.get(task.id) ?? [];
            const taskTags = taskTagIds.map(tid => tagMap.get(tid)).filter(Boolean) as typeof allTags;

            return (
              <div key={task.id} data-testid={`task-${task.id}`}
                className={`rounded-xl border border-border bg-card hover:shadow-sm transition-all ${task.status === "completed" ? "opacity-60" : ""}`}>
                {/* Task row */}
                <div className="flex items-start gap-3 p-3.5">
                  <button data-testid={`complete-${task.id}`} onClick={() => handleComplete(task.id)} className="mt-0.5 flex-shrink-0">
                    {task.status === "completed"
                      ? <CheckCircle2 className="w-5 h-5 text-primary" />
                      : <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {task.title}
                    </p>
                    {task.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.notes}</p>}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {task.dueDate && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarDays className="w-3 h-3" />
                          {task.dueDate === format(new Date(), "yyyy-MM-dd") ? "Today" : task.dueDate}
                        </span>
                      )}
                      {task.estimatedMinutes && <span className="text-xs text-muted-foreground">{task.estimatedMinutes}m</span>}
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priorityBadge[task.priority]}`}>
                        {task.priority}
                      </span>
                      {task.recurrence && task.recurrence !== "none" && (
                        <span className="flex items-center gap-1 text-xs text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded">
                          <Repeat2 className="w-3 h-3" />{task.recurrence}
                        </span>
                      )}
                      {/* Tag pills */}
                      {taskTags.map(tag => (
                        <span
                          key={tag.id}
                          className="text-xs px-1.5 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => toggleExpand(task.id)}
                    className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                    title={expanded ? "Collapse" : "Subtasks & tags"}>
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" data-testid={`task-menu-${task.id}`}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditTask(task); setFormOpen(true); }}>Edit</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(task.id)}>
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Expanded panel: tags + subtasks */}
                {expanded && <TaskPanel taskId={task.id} assignedTagIds={taskTagIds} />}
              </div>
            );
          })}
        </div>
      )}

      {/* key prop ensures form re-initializes correctly when switching between edit targets */}
      <TaskForm
        key={editTask?.id ?? "new"}
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTask(null); }}
        initial={editTask ?? undefined}
      />
    </div>
  );
}
