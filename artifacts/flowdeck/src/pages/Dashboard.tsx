import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useUser } from "@clerk/react";
import {
  useListTasks, useListGoals, useListHabits, useListFocusSessions,
  useListHabitLogs, useGetTodaysMood, useCreateMoodLog,
  useCompleteTask, useUpdateGoal, useGetWeeklyReview, useGetProductivityScore,
  useLogHabit, useUpdateHabitLog, useDeleteHabitLog,
  getListTasksQueryKey, getListGoalsQueryKey, getGetTodaysMoodQueryKey,
  getListHabitLogsQueryKey, getGetDashboardSummaryQueryKey, getGetProductivityScoreQueryKey,
} from "@workspace/api-client-react";
import type { Task, Goal } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import {
  CheckCircle2, Circle, Target, AlertTriangle, CalendarDays,
  ChevronDown, X, Smile, SmilePlus, Frown, Meh, Laugh, Zap,
  TrendingUp, ChevronRight, Repeat, Clock,
} from "lucide-react";
import {
  format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear, addDays,
} from "date-fns";
import { toast } from "sonner";

// ── Constants ──────────────────────────────────────────────────────────────────
type MoodMeta = { icon: typeof Frown; label: string; color: string };
const MOOD_META: { [key: number]: MoodMeta } = {
  1: { icon: Frown,     label: "Rough", color: "text-red-500" },
  2: { icon: Meh,       label: "Low",   color: "text-orange-500" },
  3: { icon: Smile,     label: "Okay",  color: "text-yellow-500" },
  4: { icon: SmilePlus, label: "Good",  color: "text-green-500" },
  5: { icon: Laugh,     label: "Great", color: "text-emerald-500" },
};
const MOOD_EMOJI: { [key: number]: string } = { 1: "😞", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };
const MOOD_LABEL: { [key: number]: string } = { 1: "Rough", 2: "Low", 3: "Okay", 4: "Good", 5: "Great" };

const TASK_PRIORITY_COLORS: { [key: string]: string } = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high:   "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  normal: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  low:    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};
const GOAL_PRIORITY_COLORS: { [key: string]: string } = {
  high:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  low:    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const OVERDUE_DISMISS_KEY = "flowdeck_overdue_dismissed";

// ── Date helpers ───────────────────────────────────────────────────────────────
function todayStr(): string { return new Date().toISOString().split("T")[0]!; }
function dateToStr(d: Date): string { return d.toISOString().split("T")[0]!; }

function getPresets(): { [name: string]: { from?: Date; to?: Date } } {
  const now = new Date();
  return {
    Today:        { from: now, to: now },
    Yesterday:    { from: subDays(now, 1), to: subDays(now, 1) },
    "This Week":  { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) },
    "Last Week":  { from: startOfWeek(subDays(now, 7), { weekStartsOn: 1 }), to: endOfWeek(subDays(now, 7), { weekStartsOn: 1 }) },
    "This Month": { from: startOfMonth(now), to: endOfMonth(now) },
    "This Year":  { from: startOfYear(now),  to: endOfYear(now) },
    "All Time":   {},
  };
}

function rangeLabel(range: DateRange | null): string {
  if (!range || (!range.from && !range.to)) return "All Time";
  const presets = getPresets();
  for (const [name, p] of Object.entries(presets)) {
    const hasBoth = p.from && p.to && range.from && range.to;
    if (hasBoth &&
      dateToStr(p.from!) === dateToStr(range.from!) &&
      dateToStr(p.to!)   === dateToStr(range.to!)) return name;
    if (!p.from && !p.to && !range.from && !range.to) return name;
  }
  if (range.from && range.to) {
    if (dateToStr(range.from) === dateToStr(range.to))
      return format(range.from, "MMM d, yyyy");
    return `${format(range.from, "MMM d")} – ${format(range.to, "MMM d")}`;
  }
  if (range.from) return format(range.from, "MMM d, yyyy");
  return "Select dates";
}

function inRange(dateStr: string, range: DateRange | null): boolean {
  if (!range || (!range.from && !range.to)) return true;
  if (range.from && !range.to) return dateStr >= dateToStr(range.from);
  if (!range.from && range.to) return dateStr <= dateToStr(range.to);
  return dateStr >= dateToStr(range.from!) && dateStr <= dateToStr(range.to!);
}

// ── DateRangeFilter ────────────────────────────────────────────────────────────
function DateRangeFilter({ value, onChange }: { value: DateRange | null; onChange: (r: DateRange | null) => void }) {
  const [open, setOpen] = useState(false);
  const presets = getPresets();

  const handlePreset = (name: string) => {
    const p = presets[name];
    if (!p) return;
    onChange(!p.from && !p.to ? null : { from: p.from, to: p.to });
    if (!p.from && !p.to) setOpen(false);
  };

  const activePreset = (() => {
    if (!value || (!value.from && !value.to)) return "All Time";
    for (const [name, p] of Object.entries(presets)) {
      if (p.from && p.to && value.from && value.to &&
        dateToStr(p.from) === dateToStr(value.from) &&
        dateToStr(p.to)   === dateToStr(value.to)) return name;
    }
    return null;
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 text-sm font-medium">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          {rangeLabel(value)}
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 shadow-lg" align="start">
        <div className="flex">
          <div className="border-r border-border p-2 flex flex-col gap-0.5 min-w-[120px]">
            {Object.keys(presets).map(name => (
              <button
                key={name}
                onClick={() => handlePreset(name)}
                className={`text-left text-sm px-3 py-1.5 rounded-md transition-colors ${
                  activePreset === name
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="p-2">
            <Calendar
              mode="range"
              selected={value ?? { from: undefined, to: undefined }}
              onSelect={(r) => onChange(r ?? null)}
              numberOfMonths={1}
              className="rounded-md"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── OverdueBanner ──────────────────────────────────────────────────────────────
function OverdueBanner({ overdueTasks, overdueGoals }: { overdueTasks: number; overdueGoals: number }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(OVERDUE_DISMISS_KEY) === todayStr(); }
    catch { return false; }
  });

  const dismiss = () => {
    try { sessionStorage.setItem(OVERDUE_DISMISS_KEY, todayStr()); } catch { /* ok */ }
    setDismissed(true);
  };

  if (dismissed || (overdueTasks === 0 && overdueGoals === 0)) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl">
      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
      <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {overdueTasks > 0 && (
          <span className="text-red-700 dark:text-red-400">
            <span className="font-semibold">{overdueTasks}</span> overdue task{overdueTasks !== 1 ? "s" : ""}{" "}
            <Link href="/tasks">
              <span className="underline underline-offset-2 hover:no-underline cursor-pointer">View</span>
            </Link>
          </span>
        )}
        {overdueGoals > 0 && (
          <span className="text-red-700 dark:text-red-400">
            <span className="font-semibold">{overdueGoals}</span> overdue goal{overdueGoals !== 1 ? "s" : ""}{" "}
            <Link href="/goals">
              <span className="underline underline-offset-2 hover:no-underline cursor-pointer">View</span>
            </Link>
          </span>
        )}
      </div>
      <button onClick={dismiss} className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── TodoPanel ──────────────────────────────────────────────────────────────────
function TodoPanel({ tasks, range }: { tasks: Task[] | undefined; range: DateRange | null }) {
  const qc = useQueryClient();
  const completeTask = useCompleteTask();
  const today = todayStr();
  const [completingIds, setCompletingIds] = useState<Set<number>>(new Set());

  const handleComplete = (id: number) => {
    setCompletingIds(prev => new Set(prev).add(id));
    completeTask.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        qc.invalidateQueries({ queryKey: getGetProductivityScoreQueryKey() });
        toast.success("Task completed");
      },
      onError: () => {
        setCompletingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        toast.error("Failed to complete task");
      },
    });
  };

  const isOverdue = (t: Task) =>
    !!(t.dueDate && t.dueDate < today && t.status !== "completed" && t.status !== "archived");

  const grouped = useMemo(() => {
    const all = tasks ?? [];
    const overdue:   Task[] = [];
    const dueToday:  Task[] = [];
    const upcoming:  Task[] = [];
    const completed: Task[] = [];

    for (const t of all) {
      if (t.status === "archived") continue;
      if (t.status === "completed" || completingIds.has(t.id)) {
        if (!t.dueDate || inRange(t.dueDate, range)) completed.push(t);
        continue;
      }
      if (isOverdue(t)) {
        overdue.push(t);
      } else if (t.dueDate === today) {
        dueToday.push(t);
      } else if (t.dueDate && inRange(t.dueDate, range)) {
        upcoming.push(t);
      }
    }

    const byDate = (a: Task, b: Task) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
    return {
      overdue:   overdue.sort(byDate),
      dueToday:  dueToday.sort(byDate),
      upcoming:  upcoming.sort(byDate),
      completed,
    };
  }, [tasks, range, completingIds, today]);

  const hasItems = grouped.overdue.length + grouped.dueToday.length + grouped.upcoming.length + grouped.completed.length > 0;

  function TaskRow({ task, overdue = false }: { task: Task; overdue?: boolean }) {
    const done = task.status === "completed" || completingIds.has(task.id);
    return (
      <div className={`flex items-start gap-2.5 py-2 px-2 rounded-lg transition-colors ${overdue ? "bg-red-50/60 dark:bg-red-950/20" : "hover:bg-muted/40"}`}>
        <button
          onClick={() => !done && handleComplete(task.id)}
          disabled={done}
          className="mt-0.5 flex-shrink-0 disabled:cursor-default"
        >
          {done
            ? <CheckCircle2 className="w-4 h-4 text-primary" />
            : <Circle className={`w-4 h-4 transition-colors ${overdue ? "text-red-400 hover:text-red-600" : "text-muted-foreground hover:text-primary"}`} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-snug ${done ? "line-through text-muted-foreground" : overdue ? "text-red-700 dark:text-red-400 font-medium" : "text-foreground"}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {task.dueDate && (
              <span className={`text-xs ${overdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                {overdue ? "Was due " : ""}{format(new Date(task.dueDate + "T12:00:00"), "MMM d")}
              </span>
            )}
            <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${TASK_PRIORITY_COLORS[task.priority] ?? ""}`}>
              {task.priority}
            </span>
          </div>
        </div>
      </div>
    );
  }

  function SectionLabel({ label, color = "text-muted-foreground" }: { label: string; color?: string }) {
    return <p className={`text-[10px] font-semibold uppercase tracking-wider px-2 pb-1 pt-1 ${color}`}>{label}</p>;
  }

  return (
    <Card className="border-border flex flex-col h-full min-h-0">
      <CardHeader className="pb-1 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" /> To-Do
          </CardTitle>
          <Link href="/tasks">
            <span className="text-xs text-primary hover:underline cursor-pointer">All tasks</span>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-3 overflow-y-auto flex-1 max-h-[420px]">
        {!hasItems ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No tasks for this period</p>
            <Link href="/tasks"><Button size="sm" variant="outline" className="mt-2">Add task</Button></Link>
          </div>
        ) : (
          <>
            {grouped.overdue.length > 0 && (
              <><SectionLabel label="Overdue" color="text-red-500" />
              {grouped.overdue.map(t => <TaskRow key={t.id} task={t} overdue />)}</>
            )}
            {grouped.dueToday.length > 0 && (
              <><SectionLabel label="Today" />
              {grouped.dueToday.map(t => <TaskRow key={t.id} task={t} />)}</>
            )}
            {grouped.upcoming.length > 0 && (
              <><SectionLabel label="Upcoming" />
              {grouped.upcoming.map(t => <TaskRow key={t.id} task={t} />)}</>
            )}
            {grouped.completed.length > 0 && (
              <><SectionLabel label="Completed" />
              {grouped.completed.map(t => <TaskRow key={t.id} task={t} />)}</>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── GoalsDashPanel ─────────────────────────────────────────────────────────────
function GoalsDashPanel({ goals }: { goals: Goal[] | undefined }) {
  const qc = useQueryClient();
  const updateGoal = useUpdateGoal();
  const today = todayStr();
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());

  const handleToggleComplete = (goal: Goal) => {
    const newStatus = goal.status === "completed" ? "active" : "completed";
    setUpdatingIds(prev => new Set(prev).add(goal.id));
    updateGoal.mutate({ id: goal.id, data: { status: newStatus } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListGoalsQueryKey() }); toast.success(newStatus === "completed" ? "Goal completed 🎉" : "Goal reopened"); },
      onError: () => toast.error("Failed to update goal"),
      onSettled: () => setUpdatingIds(prev => { const n = new Set(prev); n.delete(goal.id); return n; }),
    });
  };

  const handleStatusChange = (goal: Goal, status: string) => {
    updateGoal.mutate({ id: goal.id, data: { status: status as Goal["status"] } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListGoalsQueryKey() }); toast.success("Goal updated"); },
      onError: () => toast.error("Failed to update goal"),
    });
  };

  const sorted = useMemo(() => {
    const all = goals ?? [];
    const active    = all.filter(g => g.status === "active" || g.status === "paused");
    const completed = all.filter(g => g.status === "completed");
    active.sort((a, b) => {
      if (a.targetEndDate && b.targetEndDate) return a.targetEndDate.localeCompare(b.targetEndDate);
      return a.targetEndDate ? -1 : b.targetEndDate ? 1 : 0;
    });
    return [...active, ...completed];
  }, [goals]);

  return (
    <Card className="border-border flex flex-col h-full min-h-0">
      <CardHeader className="pb-1 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> Active Goals
          </CardTitle>
          <Link href="/goals">
            <span className="text-xs text-primary hover:underline cursor-pointer">All goals</span>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-3 overflow-y-auto flex-1 max-h-[420px]">
        {sorted.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No goals yet</p>
            <Link href="/goals"><Button size="sm" variant="outline" className="mt-2">Create goal</Button></Link>
          </div>
        ) : (
          <div className="space-y-0.5">
            {sorted.map(goal => {
              const isCompleted = goal.status === "completed";
              const isOverdue = !!(goal.targetEndDate && goal.targetEndDate < today && !isCompleted);
              return (
                <div
                  key={goal.id}
                  className={`flex items-start gap-2.5 py-2 px-2 rounded-lg transition-colors ${isCompleted ? "opacity-60" : isOverdue ? "bg-red-50/60 dark:bg-red-950/20" : "hover:bg-muted/40"}`}
                >
                  <button
                    onClick={() => !updatingIds.has(goal.id) && handleToggleComplete(goal)}
                    disabled={updatingIds.has(goal.id)}
                    className="mt-0.5 flex-shrink-0 disabled:cursor-default"
                  >
                    {isCompleted
                      ? <CheckCircle2 className="w-4 h-4 text-primary" />
                      : <Circle className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-snug ${isCompleted ? "line-through text-muted-foreground" : isOverdue ? "text-red-700 dark:text-red-400" : "text-foreground"}`}>
                      {goal.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${GOAL_PRIORITY_COLORS[goal.priority] ?? ""}`}>
                        {goal.priority}
                      </span>
                      {goal.targetEndDate && (
                        <span className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                          {isOverdue ? "Was due " : "Due "}{format(new Date(goal.targetEndDate + "T12:00:00"), "MMM d")}
                        </span>
                      )}
                      <Select value={goal.status} onValueChange={val => handleStatusChange(goal, val)}>
                        <SelectTrigger className="h-5 text-xs px-1.5 w-auto border-dashed min-w-[80px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="paused">Paused</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Link href={`/goals/${goal.id}`}>
                    <ChevronRight className="w-4 h-4 text-muted-foreground hover:text-foreground mt-0.5 flex-shrink-0" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── UpcomingPanel ──────────────────────────────────────────────────────────────
function UpcomingPanel({ tasks, goals }: { tasks: Task[] | undefined; goals: Goal[] | undefined }) {
  const today = todayStr();
  const days = Array.from({ length: 8 }, (_, i) => dateToStr(addDays(new Date(), i)));

  const groupedByDay = useMemo(() => {
    return days.map(day => {
      const dayTasks = (tasks ?? []).filter(t =>
        t.dueDate === day && t.status !== "completed" && t.status !== "archived"
      );
      const dayGoals = (goals ?? []).filter(g =>
        g.targetEndDate === day && g.status !== "completed" && g.status !== "archived"
      );
      return { day, tasks: dayTasks, goals: dayGoals };
    }).filter(g => g.tasks.length > 0 || g.goals.length > 0);
  }, [tasks, goals]);

  return (
    <Card className="border-border flex flex-col h-full min-h-0">
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" /> Next 7 Days
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-3 overflow-y-auto flex-1 max-h-[420px]">
        {groupedByDay.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Nothing due in the next 7 days</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedByDay.map(({ day, tasks: dayTasks, goals: dayGoals }) => {
              const isToday = day === today;
              const isTomorrow = day === dateToStr(addDays(new Date(), 1));
              const dateObj = new Date(day + "T12:00:00");
              const prefix = isToday ? "Today" : isTomorrow ? "Tomorrow" : "";
              const dayLabel = prefix
                ? `${prefix} — ${format(dateObj, "EEE, MMM d")}`
                : format(dateObj, "EEE, MMM d");
              return (
                <div key={day}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wider px-2 pb-1 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                    {dayLabel}
                  </p>
                  <div className="space-y-0.5">
                    {dayTasks.map(t => (
                      <Link key={`t-${t.id}`} href="/tasks">
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                          <span className="text-sm text-foreground truncate flex-1">{t.title}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${TASK_PRIORITY_COLORS[t.priority] ?? ""}`}>
                            {t.priority}
                          </span>
                        </div>
                      </Link>
                    ))}
                    {dayGoals.map(g => (
                      <Link key={`g-${g.id}`} href={`/goals/${g.id}`}>
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                          <span className="text-sm text-foreground truncate flex-1">{g.title}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">Goal</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── WeeklySummary ──────────────────────────────────────────────────────────────
function WeeklySummary() {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useGetWeeklyReview();

  const moodData = useMemo(() => data?.days.map(d => ({ day: d.day, mood: d.mood })) ?? [], [data]);
  const taskData = useMemo(() => data?.days.map(d => ({ day: d.day, tasks: d.tasksCompleted })) ?? [], [data]);

  return (
    <Card className="border-border">
      <button className="w-full text-left" onClick={() => setOpen(v => !v)}>
        <CardHeader className="py-3 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Weekly Summary
            </CardTitle>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </div>
        </CardHeader>
      </button>

      {open && (
        <CardContent className="px-5 pb-5">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : data ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted/30 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{data.tasksCompletedCount}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Tasks done this week</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{data.activeGoals.completed}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Goals completed</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">
                    {data.avgMood != null ? MOOD_EMOJI[Math.round(data.avgMood)] : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {data.avgMood != null ? `Avg mood ${data.avgMood}/5` : "No mood logs"}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">
                    {Math.floor(data.totalFocusMinutes / 60)}h {data.totalFocusMinutes % 60}m
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Focus time</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Mood trend</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={moodData}>
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={18} />
                      <Tooltip formatter={(v: number) => v ? [`${MOOD_EMOJI[v] ?? ""} ${MOOD_LABEL[v] ?? ""}`, "Mood"] : ["—", "Mood"]} cursor={{ stroke: "hsl(var(--border))" }} />
                      <Line type="monotone" dataKey="mood" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--primary))" }} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Tasks completed per day</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={taskData} margin={{ left: -20 }}>
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                      <Tooltip formatter={(v: number) => [v, "Tasks"]} cursor={{ fill: "hsl(var(--muted))" }} />
                      <Bar dataKey="tasks" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No weekly data available</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── Habits Today Panel ─────────────────────────────────────────────────────────
type HabitLite = { id: number; name: string; color?: string | null; frequency: string };
function HabitsTodayPanel({ habits, logsByHabitId, scheduled, today }: {
  habits: HabitLite[];
  logsByHabitId: Record<number, { id: number; status: string }>;
  scheduled: HabitLite[];
  today: string;
}) {
  const qc = useQueryClient();
  const logHabit = useLogHabit();
  const updateLog = useUpdateHabitLog();
  const deleteLog = useDeleteHabitLog();

  const handle = async (habitId: number, status: "done" | "skipped" | "missed") => {
    const existing = logsByHabitId[habitId];
    try {
      if (existing) {
        if (existing.status === status) {
          await deleteLog.mutateAsync({ id: existing.id });
        } else {
          await updateLog.mutateAsync({ id: existing.id, data: { status } });
        }
      } else {
        await logHabit.mutateAsync({ data: { habitId, logDate: today, status } });
      }
      qc.invalidateQueries({ queryKey: getListHabitLogsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    } catch {
      toast.error("Failed to update habit");
    }
  };

  const done = scheduled.filter(h => logsByHabitId[h.id]?.status === "done").length;
  const total = scheduled.length;

  return (
    <Card className="border-border">
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Repeat className="w-4 h-4 text-primary" /> Habits today
          </CardTitle>
          <span className="text-xs text-muted-foreground">{done}/{total}</span>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        {total === 0 ? (
          <div className="text-center py-8">
            <Repeat className="w-8 h-8 text-muted mx-auto mb-2" />
            <p className="text-xs text-muted-foreground mb-3">No habits scheduled today</p>
            <Link href="/habits">
              <Button variant="outline" size="sm" className="text-xs">Add a habit</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {scheduled.map(h => {
              const status = logsByHabitId[h.id]?.status;
              return (
                <div key={h.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                    style={{ backgroundColor: `${h.color ?? "#14b8a6"}25`, color: h.color ?? "#14b8a6" }}
                  >
                    {h.name[0]?.toUpperCase() ?? "?"}
                  </div>
                  <p className={`flex-1 text-xs font-medium truncate ${status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {h.name}
                  </p>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => handle(h.id, "done")}
                      title="Done"
                      className={`w-6 h-6 rounded text-[11px] font-bold transition-colors ${status === "done" ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"}`}
                    >✓</button>
                    <button
                      onClick={() => handle(h.id, "skipped")}
                      title="Skipped"
                      className={`w-6 h-6 rounded text-[11px] font-bold transition-colors ${status === "skipped" ? "bg-amber-500 text-white" : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 hover:bg-amber-500 hover:text-white"}`}
                    >–</button>
                    <button
                      onClick={() => handle(h.id, "missed")}
                      title="Missed"
                      className={`w-6 h-6 rounded text-[11px] font-bold transition-colors ${status === "missed" ? "bg-red-500 text-white" : "bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-500 hover:text-white"}`}
                    >✗</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Habit Trends Panel ─────────────────────────────────────────────────────────
function HabitTrendsPanel({ habits, habitLogs }: {
  habits: HabitLite[];
  habitLogs: Array<{ habitId: number; logDate: string; status: string }> | undefined;
}) {
  const last7 = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), "yyyy-MM-dd"));
  const logsByKey: Record<string, string> = {};
  for (const l of habitLogs ?? []) logsByKey[`${l.habitId}:${l.logDate}`] = l.status;

  return (
    <Card className="border-border">
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Habit trends
          </CardTitle>
          <Link href="/habits">
            <span className="text-xs text-primary hover:underline cursor-pointer">View all</span>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        {habits.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUp className="w-8 h-8 text-muted mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No habits to track yet</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[420px] overflow-y-auto">
            {habits.slice(0, 8).map(h => {
              let streak = 0;
              for (let i = 0; i < 365; i++) {
                const d = format(subDays(new Date(), i), "yyyy-MM-dd");
                if (logsByKey[`${h.id}:${d}`] === "done") streak++;
                else break;
              }
              const doneDays = last7.filter(d => logsByKey[`${h.id}:${d}`] === "done").length;
              const pct = Math.round((doneDays / 7) * 100);
              return (
                <div key={h.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: h.color ?? "#14b8a6" }} />
                      <span className="text-xs font-medium text-foreground truncate">{h.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 text-[10px]">
                      <span className="text-orange-500 font-semibold">🔥 {streak}</span>
                      <span className="text-muted-foreground">{pct}%</span>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    {last7.map(d => {
                      const s = logsByKey[`${h.id}:${d}`];
                      const cls = s === "done" ? "bg-primary"
                        : s === "skipped" ? "bg-amber-400"
                        : s === "missed" ? "bg-red-400"
                        : "bg-muted";
                      return <div key={d} className={`flex-1 h-1.5 rounded-sm ${cls}`} />;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useUser();
  const qc = useQueryClient();
  const today = todayStr();

  const { data: tasks, isLoading: tasksLoading } = useListTasks();
  const { data: goals, isLoading: goalsLoading } = useListGoals();
  const { data: habits }         = useListHabits();
  const { data: habitLogs }      = useListHabitLogs({ date: today });
  const { data: habitLogsAll }   = useListHabitLogs();
  const { data: focusSessions }  = useListFocusSessions();
  const { data: todayMood }      = useGetTodaysMood();
  const { data: score }          = useGetProductivityScore();
  const createMood               = useCreateMoodLog();

  const [dateRange, setDateRange] = useState<DateRange | null>({ from: new Date(), to: new Date() });

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";

  const overdueTasks = useMemo(() =>
    (tasks ?? []).filter(t => t.dueDate && t.dueDate < today && t.status === "pending").length,
  [tasks, today]);

  const overdueGoals = useMemo(() =>
    (goals ?? []).filter(g =>
      g.targetEndDate && g.targetEndDate < today && g.status !== "completed" && g.status !== "archived"
    ).length,
  [goals, today]);

  const { tasksCompleted, totalDue } = useMemo(() => {
    const all = tasks ?? [];
    const relevant = all.filter(t => t.dueDate && inRange(t.dueDate, dateRange) && t.status !== "archived");
    return {
      tasksCompleted: relevant.filter(t => t.status === "completed").length,
      totalDue: relevant.length,
    };
  }, [tasks, dateRange]);

  const activeGoalsCount = useMemo(() => (goals ?? []).filter(g => g.status === "active").length, [goals]);

  const logMood = (mood: number) => {
    createMood.mutate({ data: { mood, logDate: today } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetTodaysMoodQueryKey() }); toast.success("Mood logged"); },
    });
  };

  const hasHabits = (habits?.length ?? 0) > 0;
  const hasFocus  = (focusSessions?.length ?? 0) > 0;
  const logsByHabitId = useMemo(() => {
    const map: Record<number, { id: number; status: string }> = {};
    for (const l of habitLogs ?? []) map[l.habitId] = { id: l.id, status: l.status };
    return map;
  }, [habitLogs]);
  const scheduledHabitsToday = (habits ?? []).filter(h => {
    const now = new Date();
    const dow = now.getDay();
    switch (h.frequency) {
      case "daily": return true;
      case "weekdays": return dow >= 1 && dow <= 5;
      case "weekly": return dow === 1; // Mondays
      case "monthly": return now.getDate() === 1;
      case "yearly": return now.getDate() === 1 && now.getMonth() === 0;
      case "custom": {
        if (!h.recurrenceConfig) return true;
        try {
          const cfg = JSON.parse(h.recurrenceConfig) as { daysOfWeek?: number[] };
          if (cfg.daysOfWeek && cfg.daysOfWeek.length > 0) return cfg.daysOfWeek.includes(dow);
        } catch {}
        return true;
      }
      default: return true;
    }
  });
  const habitsDoneToday = scheduledHabitsToday.filter(h => logsByHabitId[h.id]?.status === "done").length;

  return (
    <div className="p-5 max-w-screen-xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {greeting}, {user?.firstName ?? "there"}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {format(new Date(), "EEEE, MMMM d")}
          </p>
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* Overdue banner */}
      <OverdueBanner overdueTasks={overdueTasks} overdueGoals={overdueGoals} />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(tasksLoading || totalDue > 0 || tasksCompleted > 0) && (
          tasksLoading ? <Skeleton className="h-20 rounded-xl" /> : (
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">Tasks</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {tasksCompleted}
                  <span className="text-sm font-normal text-muted-foreground">/{totalDue}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">completed in period</p>
              </CardContent>
            </Card>
          )
        )}

        {(goalsLoading || activeGoalsCount > 0) && (
          goalsLoading ? <Skeleton className="h-20 rounded-xl" /> : (
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">Goals</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{activeGoalsCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">active goals</p>
              </CardContent>
            </Card>
          )
        )}

        {/* Mood card — always shown */}
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Smile className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground font-medium">Mood</span>
            </div>
            {todayMood ? (() => {
              const meta = MOOD_META[todayMood.mood];
              return meta ? (
                <>
                  <p className={`text-2xl font-bold ${meta.color}`}>{meta.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">today's mood</p>
                </>
              ) : null;
            })() : (
              <>
                <p className="text-xs text-muted-foreground mb-1.5">How are you today?</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(m => {
                    const meta = MOOD_META[m];
                    if (!meta) return null;
                    const Icon = meta.icon;
                    return (
                      <button key={m} onClick={() => logMood(m)} data-testid={`mood-${m}`} className="p-1 rounded hover:bg-muted transition-colors">
                        <Icon className={`w-5 h-5 ${meta.color}`} />
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Habits stat card */}
        {hasHabits && (
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Repeat className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground font-medium">Habits</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {habitsDoneToday}
                <span className="text-sm font-normal text-muted-foreground">/{scheduledHabitsToday.length}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">done today</p>
            </CardContent>
          </Card>
        )}

        {/* Productivity score */}
        {score != null && score.score > 0 && (
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground font-medium">Score</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {score.score}
                <span className="text-sm font-normal text-muted-foreground">/100</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">productivity</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Three-panel layout: Habits today | Tasks today | Habit trends */}
      {(tasksLoading || goalsLoading) ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <HabitsTodayPanel habits={habits ?? []} logsByHabitId={logsByHabitId} scheduled={scheduledHabitsToday} today={today} />
          <TodoPanel tasks={tasks} range={dateRange} />
          <HabitTrendsPanel habits={habits ?? []} habitLogs={habitLogsAll} />
        </div>
      )}

      {/* Goals + Upcoming row */}
      {!(tasksLoading || goalsLoading) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GoalsDashPanel goals={goals} />
          <UpcomingPanel tasks={tasks} goals={goals} />
        </div>
      )}

      {/* Conditional: Focus stats */}
      {hasFocus && focusSessions && (
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {focusSessions.length} focus session{focusSessions.length !== 1 ? "s" : ""} completed
                </p>
                <p className="text-xs text-muted-foreground">
                  {focusSessions.reduce((acc, s) => acc + (s.durationMinutes ?? 0), 0)} minutes total
                </p>
              </div>
              <Link href="/focus" className="ml-auto">
                <Button size="sm" variant="outline" className="text-xs">Start session</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly summary (collapsible) */}
      <WeeklySummary />
    </div>
  );
}
