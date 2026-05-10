import { useUser } from "@clerk/react";
import { Link } from "wouter";
import {
  useGetDashboardSummary,
  useGetWeeklyOverview,
  useGetUpcomingTasks,
  useListHabits,
  useListHabitLogs,
  useListGoals,
  useGetTodaysMood,
  useCreateMoodLog,
  useGetProductivityScore,
  useCompleteTask,
  getGetDashboardSummaryQueryKey,
  getListHabitLogsQueryKey,
  getGetTodaysMoodQueryKey,
  getGetUpcomingTasksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CheckCircle2, Target, Repeat, Zap, Clock, TrendingUp, CalendarDays, Smile, SmilePlus, Frown, Meh, Laugh } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";

const moodEmojis: Record<number, { icon: React.ComponentType<{ className?: string }>, label: string, color: string }> = {
  1: { icon: Frown, label: "Rough", color: "text-red-500" },
  2: { icon: Meh, label: "Low", color: "text-orange-500" },
  3: { icon: Smile, label: "Okay", color: "text-yellow-500" },
  4: { icon: SmilePlus, label: "Good", color: "text-green-500" },
  5: { icon: Laugh, label: "Great", color: "text-emerald-500" },
};

const priorityColors: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  normal: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default function Dashboard() {
  const { user } = useUser();
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: weekly, isLoading: weeklyLoading } = useGetWeeklyOverview();
  const { data: upcoming, isLoading: upcomingLoading } = useGetUpcomingTasks();
  const { data: habits } = useListHabits();
  const { data: habitLogs } = useListHabitLogs({ date: today });
  const { data: todayMood } = useGetTodaysMood();
  const { data: goals } = useListGoals();
  const { data: score } = useGetProductivityScore();

  const createMood = useCreateMoodLog();
  const completeTask = useCompleteTask();

  const logMood = (mood: number) => {
    createMood.mutate({ data: { mood, logDate: today } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetTodaysMoodQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast.success("Mood logged");
      },
    });
  };

  const activeGoals = goals?.filter(g => g.status === "active").slice(0, 5) ?? [];
  const loggedHabitIds = new Set(habitLogs?.map(l => l.habitId) ?? []);

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {greeting}, {user?.firstName ?? "there"}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {format(new Date(), "EEEE, MMMM d")} — here's your day at a glance
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">Tasks</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {summary?.tasksCompleted ?? 0}
                  <span className="text-sm font-normal text-muted-foreground">/{summary?.tasksToday ?? 0}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">completed today</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">Goals</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{summary?.activeGoals ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">active goals</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Repeat className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">Habits</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {summary?.habitsCompleted ?? 0}
                  <span className="text-sm font-normal text-muted-foreground">/{summary?.habitsToday ?? 0}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">done today</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">Score</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{summary?.productivityScore ?? 0}
                  <span className="text-sm font-normal text-muted-foreground">/100</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">productivity</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Weekly bar chart */}
        <Card className="border-border">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {weeklyLoading ? (
              <Skeleton className="h-40" />
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={weekly ?? []} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
                    cursor={{ fill: "hsl(var(--muted))" }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Tasks">
                    {(weekly ?? []).map((entry, i) => (
                      <Cell key={i} fill={entry.day === format(new Date(), "EEE") ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.3)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Mood check-in */}
        <Card className="border-border">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Smile className="w-4 h-4 text-primary" />
              Today's Mood
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {todayMood ? (
              <div className="flex flex-col items-center gap-2 py-3">
                {(() => {
                  const m = moodEmojis[todayMood.mood];
                  return (
                    <>
                      <m.icon className={`w-12 h-12 ${m.color}`} />
                      <p className="font-medium text-foreground">{m.label}</p>
                      {todayMood.notes && <p className="text-sm text-muted-foreground text-center">{todayMood.notes}</p>}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="py-2">
                <p className="text-sm text-muted-foreground mb-3">How are you feeling today?</p>
                <div className="flex gap-2 justify-between">
                  {[1, 2, 3, 4, 5].map((mood) => {
                    const { icon: Icon, label, color } = moodEmojis[mood];
                    return (
                      <button
                        key={mood}
                        data-testid={`mood-${mood}`}
                        onClick={() => logMood(mood)}
                        className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-muted transition-colors flex-1"
                      >
                        <Icon className={`w-7 h-7 ${color}`} />
                        <span className="text-xs text-muted-foreground">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Active Goals */}
        <Card className="border-border">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Active Goals
              </CardTitle>
              <Link href="/goals">
                <span className="text-xs text-primary hover:underline cursor-pointer">View all</span>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-3">
            {activeGoals.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">No active goals</p>
                <Link href="/goals">
                  <Button size="sm" variant="outline" className="mt-2">Create a goal</Button>
                </Link>
              </div>
            ) : (
              activeGoals.map(goal => {
                const pct = goal.targetValue && goal.targetValue > 0
                  ? Math.min(100, Math.round(((goal.currentValue ?? 0) / goal.targetValue) * 100))
                  : 0;
                return (
                  <div key={goal.id} data-testid={`goal-card-${goal.id}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-foreground truncate flex-1 mr-2">{goal.title}</span>
                      <span className="text-xs text-muted-foreground">{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Habit streaks */}
        <Card className="border-border">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Repeat className="w-4 h-4 text-primary" />
                Habit Streaks
              </CardTitle>
              <Link href="/habits">
                <span className="text-xs text-primary hover:underline cursor-pointer">View all</span>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2">
            {!habits || habits.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">No habits yet</p>
                <Link href="/habits">
                  <Button size="sm" variant="outline" className="mt-2">Add habit</Button>
                </Link>
              </div>
            ) : (
              habits.slice(0, 5).map(habit => (
                <div key={habit.id} data-testid={`habit-card-${habit.id}`}
                  className="flex items-center gap-3 py-1.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: `${habit.color ?? "#6366f1"}20`, color: habit.color ?? "#6366f1" }}
                  >
                    {habit.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{habit.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{habit.frequency}</p>
                  </div>
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${loggedHabitIds.has(habit.id) ? "bg-green-500" : "bg-muted"}`} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming tasks */}
      <Card className="border-border">
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Upcoming (next 7 days)
            </CardTitle>
            <Link href="/tasks">
              <span className="text-xs text-primary hover:underline cursor-pointer">View all</span>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {upcomingLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : !upcoming || upcoming.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">Nothing scheduled for the next 7 days</p>
              <Link href="/tasks">
                <Button size="sm" variant="outline" className="mt-2">Add task</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {upcoming.slice(0, 6).map(task => (
                <div key={task.id} data-testid={`upcoming-task-${task.id}`}
                  className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <button
                    onClick={() => {
                      completeTask.mutate({ id: task.id }, {
                        onSuccess: () => {
                          qc.invalidateQueries({ queryKey: getGetUpcomingTasksQueryKey() });
                          qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
                        },
                      });
                    }}
                    data-testid={`complete-task-${task.id}`}
                    className="w-4 h-4 rounded-full border-2 border-border hover:border-primary transition-colors flex-shrink-0"
                  />
                  <span className="flex-1 text-sm text-foreground truncate">{task.title}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {task.dueDate && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(task.dueDate + "T00:00:00"), "MMM d")}
                      </span>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${priorityColors[task.priority]}`}>
                      {task.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
