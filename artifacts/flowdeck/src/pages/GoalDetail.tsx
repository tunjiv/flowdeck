import { useParams, Link } from "wouter";
import {
  useGetGoal,
  useGetGoalProgress,
  useListTasks,
  useListHabits,
  useListHabitLogs,
  useUpdateGoal,
  getListGoalsQueryKey,
  getGetGoalQueryKey,
  getListHabitLogsQueryKey,
  useLogHabit,
  useUpdateHabitLog,
  useDeleteHabitLog,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Circle, Repeat, AlertTriangle, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { format, subDays } from "date-fns";

type HabitStatus = "done" | "skipped" | "missed";

const today = format(new Date(), "yyyy-MM-dd");
const last7 = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), "yyyy-MM-dd"));

export default function GoalDetail() {
  const { id } = useParams<{ id: string }>();
  const goalId = Number(id);
  const qc = useQueryClient();

  const { data: goal, isLoading } = useGetGoal(goalId);
  const { data: progress } = useGetGoalProgress(goalId);
  const { data: tasks } = useListTasks({ goalId: goalId });
  const { data: allHabits } = useListHabits();
  const { data: allLogs } = useListHabitLogs();
  const updateGoal = useUpdateGoal();
  const logHabit = useLogHabit();
  const updateLog = useUpdateHabitLog();
  const deleteLog = useDeleteHabitLog();

  const [editing, setEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState("");

  // Linked habits (habits with this goalId)
  const linkedHabits = useMemo(
    () => (allHabits ?? []).filter(h => h.goalId === goalId),
    [allHabits, goalId]
  );

  // Build log map for linked habits
  const logsByKey = useMemo(() => {
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
  }, [allLogs]);

  // Compute overall progress driven by tasks + habits
  const computedProgress = useMemo(() => {
    const taskTotal = tasks?.length ?? 0;
    const taskDone = tasks?.filter(t => t.status === "completed").length ?? 0;
    const habitTotal = linkedHabits.length;
    // Weekly completion rate per linked habit
    const habitWeeklyDone = linkedHabits.reduce((acc, h) => {
      return acc + last7.filter(d => logsByKey[`${h.id}:${d}`]?.status === "done").length;
    }, 0);
    const habitCompletionRate = habitTotal > 0 ? habitWeeklyDone / (habitTotal * 7) : 0;

    if (goal?.goalType === "quantitative" && progress) {
      return progress.percent;
    }
    if (goal?.goalType === "milestone") {
      const total = taskTotal + habitTotal;
      if (total === 0) return progress?.percent ?? 0;
      const done = taskDone + Math.round(habitCompletionRate * habitTotal);
      return Math.round((done / total) * 100);
    }
    if (goal?.goalType === "habit") {
      return habitTotal > 0 ? Math.round(habitCompletionRate * 100) : progress?.percent ?? 0;
    }
    return progress?.percent ?? 0;
  }, [tasks, linkedHabits, logsByKey, progress, goal]);

  // Amber warning: any linked habit below 50% this week
  const weakHabits = linkedHabits.filter(h => {
    const done = last7.filter(d => logsByKey[`${h.id}:${d}`]?.status === "done").length;
    return done / 7 < 0.5;
  });

  const handleUpdateProgress = () => {
    const val = Number(currentValue);
    if (isNaN(val)) { toast.error("Enter a valid number"); return; }
    updateGoal.mutate({ id: goalId, data: { currentValue: val } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetGoalQueryKey(goalId) });
        qc.invalidateQueries({ queryKey: getListGoalsQueryKey() });
        toast.success("Progress updated");
        setEditing(false);
      },
    });
  };

  const handleHabitAck = async (habitId: number, habitName: string, status: HabitStatus) => {
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
    } catch {
      toast.error("Failed to update");
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-16">
        <p className="text-muted-foreground">Goal not found.</p>
        <Link href="/goals"><Button variant="outline" className="mt-3">Back to goals</Button></Link>
      </div>
    );
  }

  const pct = computedProgress;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/goals">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">{goal.title}</h1>
          {goal.description && <p className="text-sm text-muted-foreground mt-0.5">{goal.description}</p>}
        </div>
      </div>

      {/* Amber warning for weak habits */}
      {weakHabits.length > 0 && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Habit attention needed</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              {weakHabits.map(h => h.name).join(", ")} {weakHabits.length === 1 ? "is" : "are"} below 50% completion this week.
            </p>
          </div>
        </div>
      )}

      {/* Progress card */}
      <Card className="border-border">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold text-foreground">Progress</h2>
              {(tasks?.length ?? 0) > 0 || linkedHabits.length > 0 ? (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tasks?.length ? `${tasks.filter(t => t.status === "completed").length}/${tasks.length} tasks` : ""}
                  {tasks?.length && linkedHabits.length ? " · " : ""}
                  {linkedHabits.length ? `${linkedHabits.length} linked habit${linkedHabits.length > 1 ? "s" : ""}` : ""}
                </p>
              ) : null}
            </div>
            <span className="text-2xl font-bold text-primary">{pct}%</span>
          </div>
          <Progress value={pct} className="h-3 mb-3" />
          {goal.goalType === "quantitative" && (
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
              <span>Current: <span className="text-foreground font-medium">{goal.currentValue ?? 0}</span></span>
              <span>Target: <span className="text-foreground font-medium">{goal.targetValue ?? "—"}</span></span>
            </div>
          )}
          {editing ? (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">Update current value</Label>
                <Input
                  type="number"
                  value={currentValue}
                  onChange={e => setCurrentValue(e.target.value)}
                  placeholder={String(goal.currentValue ?? 0)}
                  className="mt-1"
                />
              </div>
              <Button size="sm" onClick={handleUpdateProgress} disabled={updateGoal.isPending}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          ) : goal.goalType === "quantitative" ? (
            <Button variant="outline" size="sm" onClick={() => { setEditing(true); setCurrentValue(String(goal.currentValue ?? 0)); }}>
              Update progress
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {/* Details */}
      <Card className="border-border">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Details</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Type</dt>
              <dd className="font-medium text-foreground capitalize mt-0.5">{goal.goalType}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Priority</dt>
              <dd className="font-medium text-foreground capitalize mt-0.5">{goal.priority}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium text-foreground capitalize mt-0.5">{goal.status}</dd>
            </div>
            {goal.targetEndDate && (
              <div>
                <dt className="text-muted-foreground">Target date</dt>
                <dd className="font-medium text-foreground mt-0.5">{goal.targetEndDate}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Milestones — linked tasks */}
      {tasks && tasks.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Milestones
              <span className="text-xs text-muted-foreground font-normal">
                {tasks.filter(t => t.status === "completed").length}/{tasks.length} done
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-1.5">
            {tasks.map(task => (
              <div key={task.id} className="flex items-center gap-2.5 py-1">
                {task.status === "completed"
                  ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  : <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                <span className={`text-sm flex-1 ${task.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {task.title}
                </span>
                {task.priority && (
                  <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                    task.priority === "urgent" ? "bg-red-100 text-red-600 dark:bg-red-900/20"
                    : task.priority === "high" ? "bg-orange-100 text-orange-600 dark:bg-orange-900/20"
                    : "bg-muted text-muted-foreground"
                  }`}>{task.priority}</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Linked habits */}
      {linkedHabits.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Repeat className="w-4 h-4 text-primary" />
              Habits
              <span className="text-xs text-muted-foreground font-normal">
                {linkedHabits.filter(h => todayLogsByHabit[h.id]?.status === "done").length}/{linkedHabits.length} done today
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-3">
            {linkedHabits.map(habit => {
              const weekDone = last7.filter(d => logsByKey[`${habit.id}:${d}`]?.status === "done").length;
              const pct = Math.round((weekDone / 7) * 100);
              const todayLog = todayLogsByHabit[habit.id];
              const isWeak = weekDone / 7 < 0.5;

              return (
                <div key={habit.id} className={`rounded-xl border p-3 ${isWeak ? "border-amber-300 dark:border-amber-700" : "border-border"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
                        style={{ backgroundColor: `${habit.color ?? "#14b8a6"}25`, color: habit.color ?? "#14b8a6" }}>
                        {habit.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{habit.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{habit.frequency}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Flame className={`w-3.5 h-3.5 ${isWeak ? "text-amber-500" : "text-orange-500"}`} />
                      <span className="font-medium text-foreground">{pct}%</span>
                      <span>this week</span>
                    </div>
                  </div>

                  {/* 7-dot strip */}
                  <div className="flex gap-1 mb-2">
                    {last7.map(d => {
                      const entry = logsByKey[`${habit.id}:${d}`];
                      const s = entry?.status;
                      return (
                        <div key={d} className="flex flex-col items-center gap-0.5">
                          <div className={`w-2.5 h-2.5 rounded-full ${
                            s === "done" ? "bg-primary"
                            : s === "skipped" ? "bg-amber-400"
                            : s === "missed" ? "bg-red-400"
                            : "bg-muted"
                          }`} />
                        </div>
                      );
                    })}
                  </div>

                  {/* Today ack buttons */}
                  <div className="flex gap-1.5">
                    {(["done", "skipped", "missed"] as HabitStatus[]).map(s => (
                      <button
                        key={s}
                        onClick={() => handleHabitAck(habit.id, habit.name, s)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                          todayLog?.status === s
                            ? s === "done" ? "bg-primary text-primary-foreground"
                              : s === "skipped" ? "bg-amber-500 text-white"
                              : "bg-red-500 text-white"
                            : s === "done" ? "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                              : s === "skipped" ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 hover:bg-amber-500 hover:text-white"
                              : "bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-500 hover:text-white"
                        }`}
                      >
                        {s === "done" ? "✓" : s === "skipped" ? "–" : "✗"} {s}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
