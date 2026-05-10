import { useState } from "react";
import { Link } from "wouter";
import {
  useListHabits,
  useCreateHabit,
  useUpdateHabit,
  useDeleteHabit,
  useListHabitLogs,
  useLogHabit,
  useDeleteHabitLog,
  useListCategories,
  getListHabitsQueryKey,
  getListHabitLogsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Repeat, CheckCircle2, Circle, Trash2, MoreHorizontal, ChevronRight, Flame } from "lucide-react";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

const COLORS = [
  "#14b8a6", "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#8b5cf6", "#ef4444", "#f97316", "#06b6d4",
];

function HabitForm({ open, onClose, initial }: {
  open: boolean;
  onClose: () => void;
  initial?: { id: number; name: string; frequency: string; color?: string | null; icon?: string | null; categoryId?: number | null; motivationNote?: string | null; };
}) {
  const qc = useQueryClient();
  const { data: categories } = useListCategories();
  const create = useCreateHabit();
  const update = useUpdateHabit();

  const [name, setName] = useState(initial?.name ?? "");
  const [frequency, setFrequency] = useState(initial?.frequency ?? "daily");
  const [color, setColor] = useState(initial?.color ?? "#14b8a6");
  const [categoryId, setCategoryId] = useState(String(initial?.categoryId ?? ""));
  const [motivationNote, setMotivationNote] = useState(initial?.motivationNote ?? "");

  const handleSubmit = () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    const payload: any = {
      name: name.trim(),
      frequency,
      color,
      categoryId: categoryId ? Number(categoryId) : undefined,
      motivationNote: motivationNote.trim() || undefined,
    };
    if (initial) {
      update.mutate({ id: initial.id, data: payload }, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListHabitsQueryKey() });
          toast.success("Habit updated");
          onClose();
        },
      });
    } else {
      create.mutate({ data: { ...payload, userId: "" } }, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListHabitsQueryKey() });
          toast.success("Habit created");
          onClose();
        },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit habit" : "New habit"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="habit-name">Name</Label>
            <Input id="habit-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning meditation" className="mt-1" />
          </div>
          <div>
            <Label>Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekdays">Weekdays</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
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
          <div>
            <Label htmlFor="motivation">Why this habit?</Label>
            <Input id="motivation" value={motivationNote} onChange={e => setMotivationNote(e.target.value)} placeholder="Optional motivation note" className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>
            {initial ? "Save" : "Create habit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Habits() {
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: habits, isLoading } = useListHabits();
  const { data: todayLogs } = useListHabitLogs({ date: today });
  const logHabit = useLogHabit();
  const deleteHabitLog = useDeleteHabitLog();
  const deleteHabit = useDeleteHabit();

  const [formOpen, setFormOpen] = useState(false);
  const [editHabit, setEditHabit] = useState<any>(null);

  const loggedMap = new Map<number, number>(
    (todayLogs ?? []).map(l => [l.habitId, l.id])
  );

  const handleToggle = (habit: { id: number; name: string }) => {
    const logId = loggedMap.get(habit.id);
    if (logId) {
      deleteHabitLog.mutate({ id: logId }, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListHabitLogsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast.success(`${habit.name} unmarked`);
        },
      });
    } else {
      logHabit.mutate({ data: { habitId: habit.id, logDate: today } }, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListHabitLogsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast.success(`${habit.name} done!`);
        },
      });
    }
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this habit?")) return;
    deleteHabit.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListHabitsQueryKey() });
        toast.success("Habit deleted");
      },
    });
  };

  const completedCount = (habits ?? []).filter(h => loggedMap.has(h.id)).length;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Habits</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {completedCount}/{habits?.length ?? 0} done today · {format(new Date(), "EEEE, MMM d")}
          </p>
        </div>
        <Button onClick={() => { setEditHabit(null); setFormOpen(true); }} data-testid="create-habit">
          <Plus className="w-4 h-4 mr-1.5" /> New habit
        </Button>
      </div>

      {/* Today's progress */}
      {habits && habits.length > 0 && (
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${habits.length > 0 ? (completedCount / habits.length) * 100 : 0}%` }}
          />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : !habits || habits.length === 0 ? (
        <div className="text-center py-16">
          <Repeat className="w-12 h-12 text-muted mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">No habits yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Start small and build momentum.</p>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Add your first habit
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {habits.map(habit => {
            const done = loggedMap.has(habit.id);
            return (
              <div
                key={habit.id}
                data-testid={`habit-${habit.id}`}
                className={`flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:shadow-sm transition-all ${done ? "opacity-75" : ""}`}
              >
                <button
                  data-testid={`toggle-habit-${habit.id}`}
                  onClick={() => handleToggle(habit)}
                  className="flex-shrink-0"
                >
                  {done
                    ? <CheckCircle2 className="w-6 h-6" style={{ color: habit.color ?? "#14b8a6" }} />
                    : <Circle className="w-6 h-6 text-muted-foreground hover:text-primary transition-colors" />}
                </button>
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-base flex-shrink-0"
                  style={{ backgroundColor: `${habit.color ?? "#14b8a6"}20`, color: habit.color ?? "#14b8a6" }}
                >
                  {habit.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {habit.name}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{habit.frequency}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Link href={`/habits/${habit.id}`}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`habit-detail-${habit.id}`}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`habit-menu-${habit.id}`}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditHabit(habit); setFormOpen(true); }}>Edit</DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDelete(habit.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <HabitForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditHabit(null); }}
        initial={editHabit ?? undefined}
      />
    </div>
  );
}
