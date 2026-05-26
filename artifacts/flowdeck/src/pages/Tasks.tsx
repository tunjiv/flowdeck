import { useState, useMemo } from "react";
import {
  useListTasks, useCreateTask, useUpdateTask, useDeleteTask, useCompleteTask,
  useListGoals, useListSubtasks, useCreateSubtask,
  useToggleSubtask, useDeleteSubtask, useListTags, useCreateTag,
  useListTaskTagAssociations, useAddTagToTask, useRemoveTagFromTask,
  getListTasksQueryKey, getListSubtasksQueryKey, getListTaskTagAssociationsQueryKey,
  getListTagsQueryKey, getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, CheckCircle2, Circle, Trash2, MoreHorizontal, CalendarDays,
  ChevronDown, ChevronRight, X, Tag, Filter, Search, Check, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays, nextMonday } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useLocalStorage } from "@/lib/useLocalStorage";

// ── Date filter button (calendar popover) ─────────────────────────────────────
function DateFilterButton({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const selected = value ? new Date(value + "T00:00:00") : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs font-normal w-[150px] justify-start">
          <CalendarDays className="w-3 h-3 mr-1.5" />
          {selected ? format(selected, "MMM d, yyyy") : <span className="text-muted-foreground">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={d => onChange(d ? format(d, "yyyy-MM-dd") : "")}
        />
      </PopoverContent>
    </Popover>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TASK_PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const TASK_STATUS_RANK: Record<string, number> = { pending: 0, in_progress: 1, completed: 2, archived: 3 };

const priorityBadge: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  normal: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};
const TAG_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899", "#14b8a6", "#8b5cf6"];

const SORT_OPTIONS = [
  { label: "Due date — soonest", sortBy: "dueDate" as const,   sortDir: "asc" as const },
  { label: "Due date — latest",  sortBy: "dueDate" as const,   sortDir: "desc" as const },
  { label: "Priority — highest", sortBy: "priority" as const,  sortDir: "asc" as const },
  { label: "Alphabetical",       sortBy: "title" as const,     sortDir: "asc" as const },
  { label: "Recently created",   sortBy: "createdAt" as const, sortDir: "desc" as const },
] as const;

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
          ? variant === "red" ? "bg-red-500 text-white" : "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/70"
      }`}
    >
      {label}
    </button>
  );
}

type TaskFilters = {
  search: string;
  statuses: string[];
  priorities: string[];
  tagIds: number[];
  dateMode: "none" | "range" | "exact";
  dateStart: string;
  dateEnd: string;
  dateExact: string;
  sortBy: "dueDate" | "createdAt" | "priority" | "title" | "status";
  sortDir: "asc" | "desc";
};

const DEFAULT_FILTERS: TaskFilters = {
  search: "",
  statuses: ["all"],
  priorities: ["all"],
  tagIds: [],
  dateMode: "none",
  dateStart: "",
  dateEnd: "",
  dateExact: "",
  sortBy: "dueDate",
  sortDir: "asc",
};

// ── TaskSection ────────────────────────────────────────────────────────────────
function TaskSection({
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
      {isOpen && <div className="space-y-1.5">{children}</div>}
    </div>
  );
}

// ── Tag picker ────────────────────────────────────────────────────────────────
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
    createTag.mutate({ data: { name, color: newTagColor } }, {
      onSuccess: () => {
        invalidateTags(); setNewTagName(""); setNewTagColor(TAG_COLORS[0]); setShowNewForm(false);
        toast.success("Tag created");
      },
      onError: () => toast.error("Failed to create tag"),
    });
  };

  return (
    <div className="mt-1" onClick={e => e.stopPropagation()}>
      <button onClick={() => setShowPicker(v => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
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
                  <button key={tag.id} onClick={() => toggle(tag.id)}
                    className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-all ${
                      active ? "border-transparent text-white" : "border-border text-muted-foreground hover:border-foreground/30"
                    }`}
                    style={active ? { backgroundColor: tag.color } : {}}>
                    {active && <X className="w-2.5 h-2.5" />}
                    {tag.name}
                  </button>
                );
              })}
            </div>
          )}
          {!showNewForm ? (
            <button onClick={() => setShowNewForm(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="w-3 h-3" /> New tag
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="flex gap-1">
                {TAG_COLORS.map(c => (
                  <button key={c} onClick={() => setNewTagColor(c)}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${newTagColor === c ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <input autoFocus value={newTagName} onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreateTag(); if (e.key === "Escape") setShowNewForm(false); }}
                placeholder="Tag name…"
                className="flex-1 text-xs px-2 py-0.5 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
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
    create.mutate({ taskId, data: { title } }, {
      onSuccess: () => { invalidate(); setNewTitle(""); },
      onError: () => toast.error("Failed to add subtask"),
    });
  };

  return (
    <div className="pb-3 px-3.5" onClick={e => e.stopPropagation()}>
      <div className="pl-8 mt-2">
        <p className="text-xs font-medium text-muted-foreground mb-1.5">Subtasks</p>
        {total > 0 && (
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${total > 0 ? Math.round((done / total) * 100) : 0}%` }} />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{done}/{total}</span>
          </div>
        )}
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
                <button onClick={() => del.mutate({ taskId, id: s.id }, { onSuccess: invalidate })}
                  className="opacity-0 group-hover/sub:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-1.5">
          <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
            placeholder="Add subtask…"
            className="flex-1 text-xs bg-transparent border-b border-dashed border-border focus:border-primary outline-none py-0.5 placeholder:text-muted-foreground/50" />
          {newTitle.trim() && (
            <button onClick={handleAdd} disabled={create.isPending} className="text-xs text-primary hover:text-primary/80 font-medium">Add</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Task form ─────────────────────────────────────────────────────────────────
function TaskForm({ open, onClose, initial }: {
  open: boolean; onClose: () => void;
  initial?: {
    id: number; title: string; notes?: string | null; priority: string;
    dueDate?: string | null; estimatedMinutes?: number | null;
  };
}) {
  const qc = useQueryClient();
  const create = useCreateTask();
  const update = useUpdateTask();
  const createSubtask = useCreateSubtask();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? "normal");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [newSubtask, setNewSubtask] = useState("");

  const addSubtask = () => {
    const t = newSubtask.trim();
    if (!t) return;
    setSubtasks(prev => [...prev, t]);
    setNewSubtask("");
  };
  const removeSubtask = (i: number) => setSubtasks(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    const payload = {
      title: title.trim(),
      notes: notes.trim() || undefined,
      priority: priority as "urgent" | "high" | "normal" | "low",
      dueDate: dueDate || undefined,
    };
    if (initial) {
      update.mutate({ id: initial.id, data: payload }, {
        onSuccess: () => { qc.invalidateQueries({ queryKey: getListTasksQueryKey() }); toast.success("Task updated"); onClose(); },
        onError: () => toast.error("Failed to update task"),
      });
    } else {
      create.mutate({ data: payload }, {
        onSuccess: async (created) => {
          const newId = (created as { id?: number } | undefined)?.id;
          if (newId && subtasks.length > 0) {
            try {
              await Promise.all(subtasks.map(t =>
                createSubtask.mutateAsync({ taskId: newId, data: { title: t } })
              ));
            } catch {
              toast.error("Task created, but some subtasks failed");
            }
          }
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
          {!initial && (
            <div>
              <Label>Subtasks</Label>
              {subtasks.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {subtasks.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm bg-muted/40 rounded px-2 py-1">
                      <span className="flex-1">{t}</span>
                      <button type="button" onClick={() => removeSubtask(i)}
                        className="text-muted-foreground hover:text-destructive">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                <Input
                  value={newSubtask}
                  onChange={e => setNewSubtask(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSubtask(); } }}
                  placeholder="Add a subtask..."
                />
                <Button type="button" variant="outline" size="sm" onClick={addSubtask} disabled={!newSubtask.trim()}>
                  Add
                </Button>
              </div>
            </div>
          )}
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
  const { data: allGoals = [] } = useListGoals();
  const { data: allTags = [] } = useListTags();
  const { data: taskTagAssociations = [] } = useListTaskTagAssociations();
  const deleteTask = useDeleteTask();
  const completeTask = useCompleteTask();
  const update = useUpdateTask();

  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<any>(null);
  const [formNonce, setFormNonce] = useState(0);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [filters, setFilters] = useLocalStorage<TaskFilters>("tasks_filters_v3", DEFAULT_FILTERS);

  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();

  const isTaskOverdue = (t: { status: string; dueDate?: string | null }) =>
    !!(t.dueDate && t.dueDate < today && t.status !== "completed" && t.status !== "archived");

  const taskTagMap = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const { taskId, tagId } of taskTagAssociations) {
      const list = map.get(taskId) ?? [];
      list.push(tagId);
      map.set(taskId, list);
    }
    return map;
  }, [taskTagAssociations]);

  const tagMap = useMemo(() => new Map(allTags.map(t => [t.id, t])), [allTags]);

  const filtered = useMemo(() => {
    const f = filters;
    return (tasks ?? []).filter(t => {
      if (f.search) {
        const q = f.search.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !(t.notes ?? "").toLowerCase().includes(q)) return false;
      }
      if (!f.statuses.includes("all")) {
        const overdue = isTaskOverdue(t);
        const match = (f.statuses.includes("overdue") && overdue) || f.statuses.includes(t.status);
        if (!match) return false;
      }
      if (!f.priorities.includes("all") && !f.priorities.includes(t.priority)) return false;
      if (f.tagIds.length > 0) {
        const taskTagIds = taskTagMap.get(t.id) ?? [];
        if (!f.tagIds.some(tid => taskTagIds.includes(tid))) return false;
      }
      if (f.dateMode === "exact" && f.dateExact && t.dueDate !== f.dateExact) return false;
      if (f.dateMode === "range") {
        if (f.dateStart && (t.dueDate ?? "") < f.dateStart) return false;
        if (f.dateEnd && (t.dueDate ?? "") > f.dateEnd) return false;
      }
      return true;
    });
  }, [tasks, filters, taskTagMap]);

  const sorted = useMemo(() => {
    const dir = filters.sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (filters.sortBy) {
        case "dueDate":
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return dir; if (!b.dueDate) return -dir;
          return a.dueDate.localeCompare(b.dueDate) * dir;
        case "createdAt":
          return ((a as any).createdAt ?? "").localeCompare((b as any).createdAt ?? "") * dir;
        case "priority":
          return ((TASK_PRIORITY_RANK[a.priority] ?? 99) - (TASK_PRIORITY_RANK[b.priority] ?? 99)) * dir;
        case "title":
          return a.title.localeCompare(b.title) * dir;
        case "status":
          return ((TASK_STATUS_RANK[a.status] ?? 99) - (TASK_STATUS_RANK[b.status] ?? 99)) * dir;
        default: return 0;
      }
    });
  }, [filtered, filters.sortBy, filters.sortDir]);

  // ── Section grouping ──────────────────────────────────────────────────────
  const overdueTaskList = sorted.filter(t => isTaskOverdue(t));
  const dueTodayTaskList = sorted.filter(t =>
    !isTaskOverdue(t) &&
    t.status !== "completed" &&
    t.status !== "archived" &&
    t.dueDate === today
  );
  const completedTaskList = sorted.filter(t => t.status === "completed" || t.status === "archived");
  const activeTaskList = sorted.filter(t =>
    !isTaskOverdue(t) &&
    t.status !== "completed" &&
    t.status !== "archived" &&
    t.dueDate !== today
  );

  const isFiltered =
    filters.search !== "" || !filters.statuses.includes("all") ||
    !filters.priorities.includes("all") ||
    filters.tagIds.length > 0 || filters.dateMode !== "none";

  const activeFilterCount = [
    !filters.statuses.includes("all"),
    !filters.priorities.includes("all"),
    filters.tagIds.length > 0,
    filters.dateMode !== "none",
  ].filter(Boolean).length;

  const clearFilters = () => setFilters(DEFAULT_FILTERS);
  const setF = (patch: Partial<TaskFilters>) => setFilters({ ...filters, ...patch });

  const activeSortLabel = SORT_OPTIONS.find(
    o => o.sortBy === filters.sortBy && o.sortDir === filters.sortDir
  )?.label ?? "Due date — soonest";

  const toggleExpand = (id: number) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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

  const reschedule = (id: number, dueDate: string) => {
    update.mutate({ id, data: { dueDate } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
        toast.success(`Due ${dueDate === today ? "today" : dueDate}`);
      },
      onError: () => toast.error("Failed to reschedule"),
    });
  };

  const toggleTag = (tagId: number) => {
    const current = filters.tagIds;
    const next = current.includes(tagId) ? current.filter(id => id !== tagId) : [...current, tagId];
    setF({ tagIds: next });
  };

  const renderTaskCard = (task: NonNullable<typeof tasks>[number]) => {
    const expanded = expandedTasks.has(task.id);
    const taskTagIds = taskTagMap.get(task.id) ?? [];
    const overdue = isTaskOverdue(task);

    return (
      <div key={task.id} data-testid={`task-${task.id}`}
        className={`rounded-xl border bg-card hover:shadow-sm transition-all ${
          task.status === "completed" || task.status === "archived" ? "opacity-60" : ""
        } ${overdue ? "border-l-4 border-l-red-400 border-r border-t border-b border-border" : "border-border"}`}>
        <div className="flex items-start gap-3 p-3.5">
          <button data-testid={`complete-${task.id}`} onClick={() => handleComplete(task.id)} className="mt-0.5 flex-shrink-0">
            {task.status === "completed" || task.status === "archived"
              ? <CheckCircle2 className="w-5 h-5 text-primary" />
              : <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${task.status === "completed" || task.status === "archived" ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {task.title}
            </p>
            {task.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.notes}</p>}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {task.dueDate && (
                <span className={`flex items-center gap-1 text-xs ${overdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                  {overdue && <AlertTriangle className="w-3 h-3" />}
                  <CalendarDays className="w-3 h-3" />
                  {task.dueDate === today ? "Today" : task.dueDate}
                </span>
              )}
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priorityBadge[task.priority]}`}>{task.priority}</span>
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
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => { setEditTask(task); setFormNonce(n => n + 1); setFormOpen(true); }}>Edit</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(task.id)}>
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {expanded && <TaskPanel taskId={task.id} assignedTagIds={taskTagIds} />}
      </div>
    );
  };

  const hasAnyTasks = sorted.length > 0;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your daily to-do list</p>
        </div>
        <Button onClick={() => { setEditTask(null); setFormNonce(n => n + 1); setFormOpen(true); }} data-testid="create-task">
          <Plus className="w-4 h-4 mr-1.5" /> New task
        </Button>
      </div>

      {/* Search + Sort (always visible) + Filter toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={filters.search}
            onChange={e => setF({ search: e.target.value })}
            placeholder="Search tasks by title or notes…"
            className="pl-9"
          />
          {filters.search && (
            <button onClick={() => setF({ search: "" })} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <div className="relative">
          <Button variant="outline" size="icon" onClick={() => setFiltersOpen(v => !v)}
            className={filtersOpen ? "bg-muted" : ""} title="Toggle filters">
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
                { value: "pending", label: "Pending" },
                { value: "completed", label: "Completed" },
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
                { value: "urgent", label: "Urgent" },
                { value: "high", label: "High" },
                { value: "normal", label: "Normal" },
                { value: "low", label: "Low" },
              ].map(p => (
                <Chip key={p.value} label={p.label}
                  active={filters.priorities.includes(p.value)}
                  onClick={() => setF({ priorities: toggleMulti(filters.priorities, p.value) })}
                />
              ))}
            </div>
          </div>

          {/* Tags (multi-select) */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
              <span className="text-xs font-medium text-muted-foreground pt-0.5 w-14 flex-shrink-0">Tags</span>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map(tag => {
                  const active = filters.tagIds.includes(tag.id);
                  return (
                    <button key={tag.id} onClick={() => toggleTag(tag.id)}
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full border transition-all ${
                        active ? "border-transparent text-white shadow-sm" : "border-border text-muted-foreground hover:border-foreground/30"
                      }`}
                      style={active ? { backgroundColor: tag.color } : {}}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: active ? "rgba(255,255,255,0.6)" : tag.color }} />
                      {tag.name}
                    </button>
                  );
                })}
                {filters.tagIds.length > 0 && (
                  <button onClick={() => setF({ tagIds: [] })} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Date row */}
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={filters.dateMode} onValueChange={v => setF({ dateMode: v as TaskFilters["dateMode"] })}>
              <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any due date</SelectItem>
                <SelectItem value="exact">Specific date</SelectItem>
                <SelectItem value="range">Date range</SelectItem>
              </SelectContent>
            </Select>

            {filters.dateMode === "exact" && (
              <DateFilterButton
                value={filters.dateExact}
                onChange={v => setF({ dateExact: v })}
                placeholder="Pick a date"
              />
            )}
            {filters.dateMode === "range" && (
              <>
                <DateFilterButton
                  value={filters.dateStart}
                  onChange={v => setF({ dateStart: v })}
                  placeholder="Start"
                />
                <span className="text-xs text-muted-foreground">—</span>
                <DateFilterButton
                  value={filters.dateEnd}
                  onChange={v => setF({ dateEnd: v })}
                  placeholder="End"
                />
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
              {" "}task{sorted.length !== 1 ? "s" : ""}
              {isFiltered && tasks && ` of ${tasks.length}`}
            </>
          )}
        </p>
        {isFiltered && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-3 h-3" /> Clear filters
          </button>
        )}
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : !hasAnyTasks ? (
        <div className="text-center py-16">
          <CheckCircle2 className="w-12 h-12 text-muted mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">
            {isFiltered ? "No tasks match your filters" : "No tasks"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {isFiltered
              ? "Try adjusting or clearing your filters."
              : "Add your first task to get started."}
          </p>
          {isFiltered ? (
            <Button variant="outline" onClick={clearFilters}><X className="w-4 h-4 mr-1.5" /> Clear filters</Button>
          ) : (
            <Button onClick={() => setFormOpen(true)}><Plus className="w-4 h-4 mr-1.5" /> Create your first task</Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <TaskSection label="Overdue" count={overdueTaskList.length}>
            {overdueTaskList.map(renderTaskCard)}
          </TaskSection>

          <TaskSection label="Due Today" count={dueTodayTaskList.length}>
            {dueTodayTaskList.map(renderTaskCard)}
          </TaskSection>

          <TaskSection label="Active" count={activeTaskList.length}>
            {activeTaskList.map(renderTaskCard)}
          </TaskSection>

          <TaskSection
            label="Completed"
            count={completedTaskList.length}
            collapsible
            open={completedOpen}
            onToggle={() => setCompletedOpen(v => !v)}
          >
            {completedTaskList.map(renderTaskCard)}
          </TaskSection>
        </div>
      )}

      {/* key prop ensures form re-initializes correctly when switching between edit targets */}
      <TaskForm
        key={`${editTask?.id ?? "new"}-${formNonce}`}
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTask(null); }}
        initial={editTask ?? undefined}
      />
    </div>
  );
}
