import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  useListHabits,
  useCreateHabit,
  useUpdateHabit,
  useDeleteHabit,
  useListHabitLogs,
  useLogHabit,
  useUpdateHabitLog,
  useDeleteHabitLog,
  useListCategories,
  useListGoals,
  getListHabitsQueryKey,
  getListHabitLogsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Repeat, Trash2, MoreHorizontal, ChevronDown, ChevronUp,
  Flame, TrendingUp, BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format, subDays, parseISO } from "date-fns";

type HabitStatus = "done" | "skipped" | "missed";
type FreqPreset = "daily" | "weekdays" | "weekly" | "monthly" | "yearly" | "custom";

const COLORS = [
  "#14b8a6", "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#8b5cf6", "#ef4444", "#f97316", "#06b6d4",
];

const DAY_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function freqLabel(frequency: string, recurrenceConfig?: string | null): string {
  switch (frequency) {
    case "daily": return "Every day";
    case "weekdays": return "Mon–Fri";
    case "weekly": return "Every week";
    case "monthly": return "Every month";
    case "yearly": return "Every year";
    case "custom": {
      if (!recurrenceConfig) return "Custom";
      try {
        const cfg = JSON.parse(recurrenceConfig) as { interval?: number; unit?: string; daysOfWeek?: number[] };
        const n = cfg.interval ?? 1;
        const u = cfg.unit ?? "days";
        const days = cfg.daysOfWeek;
        let summary = `Every ${n > 1 ? n + " " : ""}${n > 1 ? u : u.replace(/s$/, "")}`;
        if (days && days.length > 0 && u === "weeks") {
          summary += " on " + days.map(d => DAY_FULL[d]).join(", ");
        }
        return summary;
      } catch {
        return "Custom";
      }
    }
    default: return frequency;
  }
}

function isScheduledOn(frequency: string, recurrenceConfig: string | null | undefined, date: Date): boolean {
  const dow = date.getDay();
  switch (frequency) {
    case "daily": return true;
    case "weekdays": return dow >= 1 && dow <= 5;
    case "weekly": return dow === 1; // Mondays
    case "monthly": return date.getDate() === 1;
    case "yearly": return date.getDate() === 1 && date.getMonth() === 0;
    case "custom": {
      if (!recurrenceConfig) return true;
      try {
        const cfg = JSON.parse(recurrenceConfig) as { daysOfWeek?: number[] };
        if (cfg.daysOfWeek && cfg.daysOfWeek.length > 0) return cfg.daysOfWeek.includes(dow);
      } catch {}
      return true;
    }
    default: return true;
  }
}

function isScheduledToday(frequency: string, recurrenceConfig?: string | null): boolean {
  return isScheduledOn(frequency, recurrenceConfig, new Date());
}

interface RecurrenceConfig {
  interval: number;
  unit: "days" | "weeks" | "months" | "years";
  daysOfWeek: number[];
}

function RecurrencePicker({ value, config, onChange, onConfigChange }: {
  value: FreqPreset;
  config: RecurrenceConfig;
  onChange: (v: FreqPreset) => void;
  onConfigChange: (c: RecurrenceConfig) => void;
}) {
  const presets: { value: FreqPreset; label: string; sub: string }[] = [
    { value: "daily", label: "Daily", sub: "Every day" },
    { value: "weekdays", label: "Weekdays", sub: "Mon – Fri" },
    { value: "weekly", label: "Weekly", sub: "Once a week" },
    { value: "monthly", label: "Monthly", sub: "Once a month" },
    { value: "yearly", label: "Yearly", sub: "Once a year" },
    { value: "custom", label: "Custom", sub: "Set your own schedule" },
  ];

  const customSummary = useMemo(() => {
    const n = config.interval;
    const u = config.unit;
    let s = `Every ${n > 1 ? n + " " : ""}${n > 1 ? u : u.replace(/s$/, "")}`;
    if (u === "weeks" && config.daysOfWeek.length > 0) {
      s += " on " + config.daysOfWeek.map(d => DAY_FULL[d]).join(", ");
    }
    return s;
  }, [config]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        {presets.map(p => (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            className={`flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-all ${
              value === p.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-primary/40 hover:bg-muted text-foreground"
            }`}
          >
            <span className="text-sm font-semibold">{p.label}</span>
            <span className="text-xs text-muted-foreground mt-0.5">{p.sub}</span>
          </button>
        ))}
      </div>

      {value === "custom" && (
        <div className="space-y-3 p-3 rounded-xl bg-muted/50 border border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Every</span>
            <Input
              type="number"
              min={1}
              max={99}
              value={config.interval}
              onChange={e => onConfigChange({ ...config, interval: Math.max(1, Number(e.target.value)) })}
              className="w-16 h-8 text-center"
            />
            <Select
              value={config.unit}
              onValueChange={v => onConfigChange({ ...config, unit: v as RecurrenceConfig["unit"] })}
            >
              <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="days">Days</SelectItem>
                <SelectItem value="weeks">Weeks</SelectItem>
                <SelectItem value="months">Months</SelectItem>
                <SelectItem value="years">Years</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.unit === "weeks" && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">On days</p>
              <div className="flex gap-1">
                {DAY_SHORT.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const days = config.daysOfWeek.includes(i)
                        ? config.daysOfWeek.filter(x => x !== i)
                        : [...config.daysOfWeek, i];
                      onConfigChange({ ...config, daysOfWeek: days });
                    }}
                    className={`w-8 h-8 rounded-full text-xs font-semibold transition-colors ${
                      config.daysOfWeek.includes(i)
                        ? "bg-primary text-primary-foreground"
                        : "bg-background border border-border text-muted-foreground hover:border-primary"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-primary font-medium">{customSummary}</p>
        </div>
      )}
    </div>
  );
}

function HabitForm({ open, onClose, initial }: {
  open: boolean;
  onClose: () => void;
  initial?: { id: number; name: string; frequency: string; color?: string | null; categoryId?: number | null; motivationNote?: string | null; graceDaysPerWeek?: number | null; recurrenceConfig?: string | null; goalId?: number | null; };
}) {
  const qc = useQueryClient();
  const { data: categories } = useListCategories();
  const { data: goals } = useListGoals();
  const create = useCreateHabit();
  const update = useUpdateHabit();

  const parseInitialConfig = (): RecurrenceConfig => {
    if (initial?.recurrenceConfig) {
      try { return JSON.parse(initial.recurrenceConfig); } catch {}
    }
    return { interval: 1, unit: "weeks", daysOfWeek: [1] };
  };

  const [name, setName] = useState(initial?.name ?? "");
  const [frequency, setFrequency] = useState<FreqPreset>((initial?.frequency as FreqPreset) ?? "daily");
  const [customCfg, setCustomCfg] = useState<RecurrenceConfig>(parseInitialConfig);
  const [color, setColor] = useState(initial?.color ?? "#14b8a6");
  const [categoryId, setCategoryId] = useState(String(initial?.categoryId ?? ""));
  const [motivationNote, setMotivationNote] = useState(initial?.motivationNote ?? "");
  const [graceDays, setGraceDays] = useState(String(initial?.graceDaysPerWeek ?? "0"));
  const [goalId, setGoalId] = useState(String(initial?.goalId ?? ""));

  const handleSubmit = () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    const recurrenceConfig = frequency === "custom" ? JSON.stringify(customCfg) : undefined;
    const payload = {
      name: name.trim(),
      frequency: frequency as "daily" | "weekdays" | "weekly" | "monthly" | "yearly" | "custom",
      recurrenceConfig,
      color,
      categoryId: categoryId ? Number(categoryId) : undefined,
      goalId: goalId ? Number(goalId) : undefined,
      motivationNote: motivationNote.trim() || undefined,
      graceDaysPerWeek: Number(graceDays),
    };
    if (initial) {
      update.mutate({ id: initial.id, data: payload }, {
        onSuccess: () => { qc.invalidateQueries({ queryKey: getListHabitsQueryKey() }); toast.success("Habit updated"); onClose(); },
      });
    } else {
      create.mutate({ data: payload }, {
        onSuccess: () => { qc.invalidateQueries({ queryKey: getListHabitsQueryKey() }); toast.success("Habit created"); onClose(); },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit habit" : "New habit"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="habit-name">Name</Label>
            <Input id="habit-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning run" className="mt-1" autoFocus />
          </div>

          <div>
            <Label className="mb-2 block">Repeat</Label>
            <RecurrencePicker
              value={frequency}
              config={customCfg}
              onChange={setFrequency}
              onConfigChange={setCustomCfg}
            />
          </div>

          <div>
            <Label>Color</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? "scale-125 ring-2 ring-offset-1 ring-foreground" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

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
              <Label>Linked goal</Label>
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
          </div>

          <div>
            <Label>Grace days / week</Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">Days that won't break your streak.</p>
            <Select value={graceDays} onValueChange={setGraceDays}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0 — strict</SelectItem>
                <SelectItem value="1">1 skip / week</SelectItem>
                <SelectItem value="2">2 skips / week</SelectItem>
                <SelectItem value="3">3 skips / week</SelectItem>
              </SelectContent>
            </Select>
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

function SevenDotStrip({ habitId, logs }: { habitId: number; logs: Record<string, { id: number; status: string }> }) {
  // Show 3 past + today + 3 future, so future days appear distinctly gray
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 3 - i);
    const key = format(d, "yyyy-MM-dd");
    const entry = logs[`${habitId}:${key}`];
    const isTodayDay = i === 3;
    const isFutureDay = i > 3;
    return { key, label: format(d, "EEEEE"), entry, isTodayDay, isFutureDay };
  });

  return (
    <div className="flex gap-1">
      {days.map(({ key, label, entry, isTodayDay, isFutureDay }) => {
        const s = entry?.status;
        let dot = "border border-dashed border-border bg-transparent";
        let title = "No log";
        if (isFutureDay) {
          dot = "bg-muted/40 border border-border/50";
          title = "Upcoming";
        } else if (s === "done") { dot = "bg-primary border border-primary"; title = "Done"; }
        else if (s === "skipped") { dot = "bg-amber-400 border border-amber-400"; title = "Skipped"; }
        else if (s === "missed") { dot = "bg-red-400 border border-red-400"; title = "Missed"; }
        return (
          <div key={key} className="flex flex-col items-center gap-0.5" title={title}>
            <div className={`w-2.5 h-2.5 rounded-full ${dot} ${isTodayDay ? "ring-2 ring-foreground/40 ring-offset-1" : ""}`} />
            <span className={`text-[9px] ${isFutureDay ? "text-muted-foreground/50" : "text-muted-foreground"}`}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function HabitHeatmap({ habits, logsByKey }: {
  habits: Array<{ id: number; name: string; color?: string | null }>;
  logsByKey: Record<string, { id: number; status: string }>;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(habits[0]?.id ?? null);
  if (!habits.length) return null;
  const habit = habits.find(h => h.id === selectedId) ?? habits[0]!;
  // 28 days: 4 rows x 7 cols, oldest top-left, newest (today) bottom-right
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = subDays(new Date(), 27 - i);
    return { key: format(d, "yyyy-MM-dd"), date: d };
  });
  const baseColor = habit.color ?? "hsl(189, 88%, 28%)";

  return (
    <Card className="border-border">
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" />
            28-day heatmap
          </CardTitle>
          <Select value={String(habit.id)} onValueChange={v => setSelectedId(Number(v))}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {habits.map(h => (
                <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        <div className="grid grid-cols-7 gap-1">
          {days.map(({ key, date }) => {
            const entry = logsByKey[`${habit.id}:${key}`];
            const s = entry?.status;
            let bg = "bg-muted/40";
            let title = `${format(date, "MMM d")} — no log`;
            if (s === "done") { bg = ""; title = `${format(date, "MMM d")} — done`; }
            else if (s === "skipped") { bg = "bg-amber-400"; title = `${format(date, "MMM d")} — skipped`; }
            else if (s === "missed") { bg = "bg-red-400"; title = `${format(date, "MMM d")} — missed`; }
            const isTodayCell = format(new Date(), "yyyy-MM-dd") === key;
            return (
              <div
                key={key}
                title={title}
                className={`aspect-square rounded-sm ${bg} ${isTodayCell ? "ring-1 ring-foreground/50" : ""}`}
                style={s === "done" ? { backgroundColor: baseColor } : undefined}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-3 text-[10px] text-muted-foreground">
          <span>{format(days[0]!.date, "MMM d")}</span>
          <div className="flex items-center gap-2">
            <span>Less</span>
            <div className="w-2.5 h-2.5 rounded-sm bg-muted/40" />
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: baseColor, opacity: 0.4 }} />
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: baseColor }} />
            <span>More</span>
          </div>
          <span>Today</span>
        </div>
      </CardContent>
    </Card>
  );
}

function CatchUpBatch({ habitName, catchUpDays, onLog, onAfter }: {
  habitId: number;
  habitName: string;
  catchUpDays: string[];
  onLog: (date: string, status: HabitStatus) => Promise<unknown>;
  onAfter: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const toggleDay = (d: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(catchUpDays));
  const clearAll = () => setSelected(new Set());
  const weekdaysOnly = () => {
    const next = new Set<string>();
    for (const d of catchUpDays) {
      const dow = parseISO(d).getDay();
      if (dow >= 1 && dow <= 5) next.add(d);
    }
    setSelected(next);
  };

  const applyBatch = async () => {
    if (selected.size === 0) { toast.error("Select at least one day"); return; }
    setBusy(true);
    try {
      for (const d of catchUpDays) {
        const status: HabitStatus = selected.has(d) ? "done" : "skipped";
        await onLog(d, status);
      }
      toast.success(`${habitName}: ${selected.size} done, ${catchUpDays.length - selected.size} skipped`);
      setSelected(new Set());
      onAfter();
    } catch {
      toast.error("Batch update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2.5 mb-1 space-y-2">
      {/* Day chips for selection */}
      <div className="flex flex-wrap gap-1">
        {catchUpDays.map(d => {
          const isSel = selected.has(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                isSel
                  ? "bg-primary text-primary-foreground"
                  : "bg-background border border-border text-muted-foreground hover:border-primary"
              }`}
            >
              {format(parseISO(d), "EEE d")}
            </button>
          );
        })}
      </div>
      {/* Quick-select */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <button type="button" onClick={selectAll} className="px-1.5 py-0.5 rounded bg-background border border-border hover:border-primary">Select all</button>
        <button type="button" onClick={clearAll} className="px-1.5 py-0.5 rounded bg-background border border-border hover:border-primary">Clear</button>
        <button type="button" onClick={weekdaysOnly} className="px-1.5 py-0.5 rounded bg-background border border-border hover:border-primary">Weekdays only</button>
        <span className="text-muted-foreground ml-auto">{selected.size} selected</span>
      </div>
      {/* Apply */}
      <button
        type="button"
        onClick={applyBatch}
        disabled={busy || selected.size === 0}
        className="w-full py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Mark selected as done & skip the rest
      </button>
    </div>
  );
}

export default function Habits() {
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: habits, isLoading } = useListHabits();
  const { data: allLogs } = useListHabitLogs();
  const logHabit = useLogHabit();
  const updateLog = useUpdateHabitLog();
  const deleteLog = useDeleteHabitLog();
  const deleteHabit = useDeleteHabit();

  const [formOpen, setFormOpen] = useState(false);
  const [editHabit, setEditHabit] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"habits" | "trends">("habits");

  const logsByKey = useMemo((): Record<string, { id: number; status: string }> => {
    const map: Record<string, { id: number; status: string }> = {};
    for (const log of allLogs ?? []) {
      map[`${log.habitId}:${log.logDate}`] = { id: log.id, status: log.status };
    }
    return map;
  }, [allLogs]);

  const todayLogsByHabit = useMemo(() => {
    const map: Record<number, { id: number; status: string }> = {};
    for (const log of allLogs ?? []) {
      if (log.logDate === today) map[log.habitId] = { id: log.id, status: log.status };
    }
    return map;
  }, [allLogs, today]);

  const handleAck = async (habitId: number, habitName: string, status: HabitStatus) => {
    const existing = todayLogsByHabit[habitId];
    try {
      if (existing) {
        if (existing.status === status) {
          await deleteLog.mutateAsync({ id: existing.id });
          toast.success(`${habitName} unlogged`);
        } else {
          await updateLog.mutateAsync({ id: existing.id, data: { status } });
          toast.success(`${habitName} → ${status}`);
        }
      } else {
        await logHabit.mutateAsync({ data: { habitId, logDate: today, status } });
        toast.success(`${habitName} → ${status}`);
      }
      qc.invalidateQueries({ queryKey: getListHabitLogsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    deleteHabit.mutate({ id }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListHabitsQueryKey() }); toast.success("Habit deleted"); },
    });
  };

  const scheduledToday = (habits ?? []).filter(h => isScheduledToday(h.frequency, h.recurrenceConfig));
  const doneToday = scheduledToday.filter(h => todayLogsByHabit[h.id]?.status === "done").length;
  const skippedToday = scheduledToday.filter(h => todayLogsByHabit[h.id]?.status === "skipped").length;

  // Past 7 days completion rate per habit (for trends)
  const last7Dates = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), "yyyy-MM-dd"));

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Habits</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {doneToday}/{scheduledToday.length} done · {skippedToday > 0 ? `${skippedToday} skipped · ` : ""}{format(new Date(), "EEEE, MMM d")}
          </p>
        </div>
        <Button onClick={() => { setEditHabit(null); setFormOpen(true); }} data-testid="create-habit">
          <Plus className="w-4 h-4 mr-1.5" /> New habit
        </Button>
      </div>

      {/* Progress bar */}
      {scheduledToday.length > 0 && (
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${scheduledToday.length > 0 ? (doneToday / scheduledToday.length) * 100 : 0}%` }}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("habits")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "habits" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Repeat className="w-3.5 h-3.5 inline mr-1.5" />Habits
        </button>
        <button
          onClick={() => setActiveTab("trends")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "trends" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <BarChart2 className="w-3.5 h-3.5 inline mr-1.5" />Trends
        </button>
      </div>

      {activeTab === "habits" && (
        <>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : !habits?.length ? (
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
                const todayLog = todayLogsByHabit[habit.id];
                const expanded = expandedId === habit.id;
                const scheduled = isScheduledToday(habit.frequency, habit.recurrenceConfig);
                const statusColor = todayLog?.status === "done"
                  ? "border-primary/40 bg-primary/5"
                  : todayLog?.status === "skipped"
                  ? "border-amber-400/40 bg-amber-50 dark:bg-amber-900/10"
                  : todayLog?.status === "missed"
                  ? "border-red-400/40 bg-red-50 dark:bg-red-900/10"
                  : "border-border bg-card";

                // Past catch-up days (last 7 excluding today, scheduled on that day, no log yet)
                const catchUpDays = last7Dates.slice(0, 6).filter(d =>
                  !logsByKey[`${habit.id}:${d}`] &&
                  isScheduledOn(habit.frequency, habit.recurrenceConfig, parseISO(d))
                );

                return (
                  <div
                    key={habit.id}
                    data-testid={`habit-${habit.id}`}
                    className={`rounded-xl border transition-all overflow-hidden ${statusColor}`}
                  >
                    {/* Collapsed row */}
                    <div
                      className="flex items-center gap-3 p-3.5 cursor-pointer"
                      onClick={() => setExpandedId(expanded ? null : habit.id)}
                    >
                      {/* Color dot */}
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-base flex-shrink-0"
                        style={{ backgroundColor: `${habit.color ?? "#14b8a6"}25`, color: habit.color ?? "#14b8a6" }}
                      >
                        {habit.name[0].toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-medium ${todayLog?.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {habit.name}
                          </p>
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {freqLabel(habit.frequency, habit.recurrenceConfig)}
                          </span>
                          {todayLog && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${
                              todayLog.status === "done" ? "bg-primary/10 text-primary"
                              : todayLog.status === "skipped" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                              : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                            }`}>{todayLog.status}</span>
                          )}
                          {catchUpDays.length > 0 && (
                            <span className="text-xs bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded">
                              {catchUpDays.length} unlogged
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5">
                          <SevenDotStrip habitId={habit.id} logs={logsByKey} />
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`habit-menu-${habit.id}`}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); setEditHabit(habit); setFormOpen(true); }}>Edit</DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/habits/${habit.id}`}>View detail</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={e => { e.stopPropagation(); handleDelete(habit.id, habit.name); }}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Expanded panel */}
                    {expanded && (
                      <div className="border-t border-border bg-background/60 px-4 py-3 space-y-3">
                        {/* Today acknowledgment */}
                        {scheduled && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                              TODAY — {format(new Date(), "MMM d").toUpperCase()}
                            </p>
                            <div className="flex gap-2">
                              {(["done", "skipped", "missed"] as HabitStatus[]).map(s => (
                                <button
                                  key={s}
                                  onClick={() => handleAck(habit.id, habit.name, s)}
                                  className={`flex-1 py-2 rounded-xl text-sm font-semibold capitalize transition-all ${
                                    todayLog?.status === s
                                      ? s === "done" ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                                        : s === "skipped" ? "bg-amber-500 text-white ring-2 ring-amber-500 ring-offset-2"
                                        : "bg-red-500 text-white ring-2 ring-red-500 ring-offset-2"
                                      : s === "done" ? "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                                        : s === "skipped" ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 hover:bg-amber-500 hover:text-white"
                                        : "bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-500 hover:text-white"
                                  }`}
                                >
                                  {s === "done" ? "✓ Done" : s === "skipped" ? "— Skipped" : "✗ Missed"}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Last 7 days with labels */}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">LAST 7 DAYS</p>
                          <div className="flex gap-2">
                            {Array.from({ length: 7 }, (_, i) => {
                              const d = subDays(new Date(), 6 - i);
                              const key = format(d, "yyyy-MM-dd");
                              const entry = logsByKey[`${habit.id}:${key}`];
                              const s = entry?.status;
                              return (
                                <div key={key} className="flex flex-col items-center gap-1">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                    s === "done" ? "bg-primary text-primary-foreground"
                                    : s === "skipped" ? "bg-amber-400 text-white"
                                    : s === "missed" ? "bg-red-400 text-white"
                                    : "bg-muted text-muted-foreground border border-border"
                                  }`}>
                                    {s === "done" ? "✓" : s === "skipped" ? "–" : s === "missed" ? "✗" : "·"}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">{format(d, "EEE")[0]}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Catch-up section */}
                        {catchUpDays.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-1.5">
                              CATCH UP — {catchUpDays.length} unlogged day{catchUpDays.length > 1 ? "s" : ""}
                            </p>
                            <CatchUpBatch
                              habitId={habit.id}
                              habitName={habit.name}
                              catchUpDays={catchUpDays}
                              onLog={async (date, status) => {
                                await logHabit.mutateAsync({ data: { habitId: habit.id, logDate: date, status } });
                              }}
                              onAfter={() => {
                                qc.invalidateQueries({ queryKey: getListHabitLogsQueryKey() });
                              }}
                            />
                            <div className="space-y-1 mt-2">
                              {catchUpDays.map(d => (
                                <div key={d} className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground w-20">{format(parseISO(d), "EEE, MMM d")}</span>
                                  <div className="flex gap-1">
                                    {(["done", "skipped", "missed"] as HabitStatus[]).map(s => (
                                      <button
                                        key={s}
                                        onClick={async () => {
                                          try {
                                            await logHabit.mutateAsync({ data: { habitId: habit.id, logDate: d, status: s } });
                                            qc.invalidateQueries({ queryKey: getListHabitLogsQueryKey() });
                                            toast.success(`${format(parseISO(d), "MMM d")} → ${s}`);
                                          } catch { toast.error("Failed"); }
                                        }}
                                        className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors capitalize ${
                                          s === "done" ? "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                                          : s === "skipped" ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 hover:bg-amber-500 hover:text-white"
                                          : "bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-500 hover:text-white"
                                        }`}
                                      >{s}</button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "trends" && (
        <div className="space-y-4">
          {/* Summary stat cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-border">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Active habits</p>
                <p className="text-2xl font-bold text-foreground">{habits?.length ?? 0}</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Done today</p>
                <p className="text-2xl font-bold text-primary">{doneToday}/{scheduledToday.length}</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">This week</p>
                <p className="text-2xl font-bold text-foreground">
                  {habits && habits.length > 0
                    ? Math.round((last7Dates.reduce((acc, d) => {
                        return acc + (habits ?? []).filter(h => logsByKey[`${h.id}:${d}`]?.status === "done").length;
                      }, 0) / Math.max(1, last7Dates.length * habits.length)) * 100)
                    : 0}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Completion bar chart */}
          <Card className="border-border">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Weekly completion
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-3">
              {(habits ?? []).map(habit => {
                const doneDays = last7Dates.filter(d => logsByKey[`${habit.id}:${d}`]?.status === "done").length;
                const pct = Math.round((doneDays / 7) * 100);
                const barColor = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-400";
                return (
                  <div key={habit.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: habit.color ?? "#14b8a6" }} />
                        <span className="text-xs font-medium text-foreground">{habit.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{pct}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {!habits?.length && (
                <p className="text-sm text-muted-foreground text-center py-4">No habits to show trends for</p>
              )}
            </CardContent>
          </Card>

          {/* 28-day heatmap */}
          <HabitHeatmap habits={habits ?? []} logsByKey={logsByKey} />

          {/* Best streaks */}
          <Card className="border-border">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                Current streaks
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4 space-y-2">
              {(habits ?? []).map(habit => {
                let streak = 0;
                const todayStr = format(new Date(), "yyyy-MM-dd");
                for (let i = 0; i < 365; i++) {
                  const d = format(subDays(new Date(), i), "yyyy-MM-dd");
                  if (d > todayStr) continue;
                  if (logsByKey[`${habit.id}:${d}`]?.status === "done") streak++;
                  else break;
                }
                return (
                  <div key={habit.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: habit.color ?? "#14b8a6" }} />
                      <span className="text-sm text-foreground">{habit.name}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-semibold text-orange-500">
                      <Flame className="w-3.5 h-3.5" />
                      {streak}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
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
