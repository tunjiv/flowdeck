import { useState, useMemo } from "react";
import {
  useListTasks,
  useListHabits,
  useListHabitLogs,
  useLogHabit,
  useUpdateHabitLog,
  useDeleteHabitLog,
  getListHabitLogsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Repeat,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  isPast,
  isFuture,
  parseISO,
} from "date-fns";

type LogStatus = "done" | "skipped" | "missed";

function isHabitScheduledOnDay(frequency: string, recurrenceConfig: string | null | undefined, date: Date): boolean {
  const dow = date.getDay();
  switch (frequency) {
    case "daily": return true;
    case "weekdays": return dow >= 1 && dow <= 5;
    case "weekly": return dow === 1;
    case "monthly": return date.getDate() === 1;
    case "yearly": return date.getDate() === 1 && date.getMonth() === 0;
    case "custom": {
      if (!recurrenceConfig) return true;
      try {
        const cfg = JSON.parse(recurrenceConfig) as { daysOfWeek?: number[] };
        if (cfg.daysOfWeek && cfg.daysOfWeek.length > 0) {
          return cfg.daysOfWeek.includes(dow);
        }
      } catch {}
      return true;
    }
    default: return true;
  }
}

export default function Calendar() {
  const qc = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [ackHabit, setAckHabit] = useState<{ habitId: number; name: string; date: string; logId?: number; currentStatus?: LogStatus } | null>(null);

  const { data: tasks } = useListTasks();
  const { data: habits } = useListHabits();
  const { data: allLogs } = useListHabitLogs();
  const logHabit = useLogHabit();
  const updateLog = useUpdateHabitLog();
  const deleteLog = useDeleteHabitLog();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const tasksByDate = useMemo(() => {
    const map: Record<string, typeof tasks> = {};
    for (const task of tasks ?? []) {
      if (task.dueDate) {
        const key = task.dueDate.slice(0, 10);
        if (!map[key]) map[key] = [];
        map[key]!.push(task);
      }
    }
    return map;
  }, [tasks]);

  const logsByHabitDate = useMemo(() => {
    const map: Record<string, { id: number; status: string }> = {};
    for (const log of allLogs ?? []) {
      map[`${log.habitId}:${log.logDate}`] = { id: log.id, status: log.status };
    }
    return map;
  }, [allLogs]);

  const habitsByDate = useMemo(() => {
    const map: Record<string, typeof habits> = {};
    for (const day of calDays) {
      const key = format(day, "yyyy-MM-dd");
      map[key] = (habits ?? []).filter(h =>
        isHabitScheduledOnDay(h.frequency, h.recurrenceConfig, day)
      );
    }
    return map;
  }, [habits, calDays]);

  const handleAck = async (status: LogStatus) => {
    if (!ackHabit) return;
    const { habitId, date, logId, currentStatus } = ackHabit;
    try {
      if (status === currentStatus) {
        if (logId) {
          await deleteLog.mutateAsync({ id: logId });
          toast.success("Acknowledgment removed");
        }
      } else if (logId) {
        await updateLog.mutateAsync({ id: logId, data: { status } });
        toast.success(`Marked as ${status}`);
      } else {
        await logHabit.mutateAsync({ data: { habitId, logDate: date, status } });
        toast.success(`Marked as ${status}`);
      }
      qc.invalidateQueries({ queryKey: getListHabitLogsQueryKey() });
      setAckHabit(null);
    } catch {
      toast.error("Failed to update");
    }
  };

  const prevMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const STATUS_COLORS: Record<string, string> = { done: "bg-primary text-primary-foreground", skipped: "bg-amber-500 text-white", missed: "bg-red-500 text-white" };

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Tasks and habits on their scheduled days</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-base font-semibold text-foreground min-w-[140px] text-center">
            {format(currentDate, "MMMM yyyy")}
          </span>
          <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-xs font-medium text-muted-foreground text-center py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border">
        {calDays.map(day => {
          const key = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDate[key] ?? [];
          const dayHabits = habitsByDate[key] ?? [];
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);
          const selected = selectedDay ? isSameDay(day, selectedDay) : false;
          const past = isPast(day) && !isToday(day);

          return (
            <div
              key={key}
              onClick={() => setSelectedDay(selected ? null : day)}
              className={`min-h-[90px] p-1.5 cursor-pointer transition-colors ${
                inMonth ? "bg-card hover:bg-muted/50" : "bg-muted/20 hover:bg-muted/30"
              } ${selected ? "ring-2 ring-inset ring-primary" : ""}`}
            >
              <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                today ? "bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground"
              }`}>
                {format(day, "d")}
              </div>

              {/* Task chips */}
              {dayTasks.slice(0, 2).map(task => (
                <div
                  key={task.id}
                  className={`text-[10px] px-1.5 py-0.5 rounded mb-0.5 truncate flex items-center gap-0.5 ${
                    task.status === "completed"
                      ? "bg-muted text-muted-foreground line-through"
                      : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                  }`}
                >
                  <CheckSquare className="w-2.5 h-2.5 flex-shrink-0" />
                  <span className="truncate">{task.title}</span>
                </div>
              ))}

              {/* Habit chips */}
              {dayHabits.slice(0, past || today ? 3 : 2).map(habit => {
                const logEntry = logsByHabitDate[`${habit.id}:${key}`];
                const status = logEntry?.status as LogStatus | undefined;
                const showAck = past || today;
                return (
                  <div
                    key={habit.id}
                    onClick={e => {
                      e.stopPropagation();
                      if (showAck) {
                        setAckHabit({
                          habitId: habit.id,
                          name: habit.name,
                          date: key,
                          logId: logEntry?.id,
                          currentStatus: status,
                        });
                      }
                    }}
                    className={`text-[10px] px-1.5 py-0.5 rounded mb-0.5 truncate flex items-center gap-0.5 cursor-pointer ${
                      status === "done"
                        ? "bg-primary/20 text-primary"
                        : status === "skipped"
                        ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                        : status === "missed"
                        ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400"
                        : showAck
                        ? "bg-muted border border-dashed border-border text-muted-foreground hover:bg-primary/10"
                        : "bg-muted/60 text-muted-foreground"
                    }`}
                    title={showAck ? `Click to log ${habit.name}` : habit.name}
                  >
                    <Repeat className="w-2.5 h-2.5 flex-shrink-0" />
                    <span className="truncate">{habit.name}</span>
                  </div>
                );
              })}

              {/* Overflow indicator */}
              {(dayTasks.length + dayHabits.length > 4) && (
                <div className="text-[10px] text-muted-foreground px-1">
                  +{dayTasks.length + dayHabits.length - 4} more
                </div>
              )}

              {/* Quick-add for future empty days */}
              {isFuture(day) && inMonth && dayTasks.length === 0 && dayHabits.length === 0 && (
                <div className="flex items-center justify-center mt-1 opacity-0 group-hover:opacity-100">
                  <Plus className="w-3 h-3 text-muted-foreground/40" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Acknowledgment panel */}
      {ackHabit && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40" onClick={() => setAckHabit(null)}>
          <div
            className="bg-card rounded-2xl border border-border shadow-xl p-5 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-foreground">{ackHabit.name}</h3>
              <button onClick={() => setAckHabit(null)} className="p-1 rounded-md hover:bg-muted">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {format(parseISO(ackHabit.date), "EEEE, MMM d")}
              {ackHabit.currentStatus && (
                <span className="ml-2 capitalize font-medium text-foreground">· Currently: {ackHabit.currentStatus}</span>
              )}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleAck("done")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  ackHabit.currentStatus === "done"
                    ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                    : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                }`}
              >
                ✓ Done
              </button>
              <button
                onClick={() => handleAck("skipped")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  ackHabit.currentStatus === "skipped"
                    ? "bg-amber-500 text-white ring-2 ring-amber-500 ring-offset-2"
                    : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500 hover:text-white"
                }`}
              >
                — Skipped
              </button>
              <button
                onClick={() => handleAck("missed")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  ackHabit.currentStatus === "missed"
                    ? "bg-red-500 text-white ring-2 ring-red-500 ring-offset-2"
                    : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white"
                }`}
              >
                ✗ Missed
              </button>
            </div>
            {ackHabit.currentStatus && (
              <button
                onClick={() => handleAck(ackHabit.currentStatus!)}
                className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground py-1 transition-colors"
              >
                Click same status again to remove
              </button>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/40 border border-blue-300" />Task</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-primary/20 border border-primary/30" />Habit done</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />Habit skipped</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-100 border border-red-300" />Habit missed</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-muted border border-dashed border-border" />Unlogged (tap to log)</div>
      </div>
    </div>
  );
}
