import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { useGetWeeklyReview, useListTasks } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, ReferenceLine,
} from "recharts";
import {
  Flame, Target, Timer, CheckSquare, TrendingUp, Smile, Star, Award,
  PenLine, Check, AlertCircle,
} from "lucide-react";

// ── constants ─────────────────────────────────────────────────────────────────
const MOOD_EMOJI: Record<number, string> = { 1: "😞", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };
const MOOD_LABEL: Record<number, string> = { 1: "Rough", 2: "Low", 3: "Okay", 4: "Good", 5: "Great" };

function moodColor(mood: number | null) {
  if (!mood) return "hsl(215,16%,75%)";
  if (mood >= 4) return "hsl(142,69%,45%)";
  if (mood === 3) return "hsl(43,96%,56%)";
  return "hsl(0,84%,60%)";
}

function scoreLabel(score: number) {
  if (score >= 80) return { text: "Excellent", color: "text-green-600 dark:text-green-400" };
  if (score >= 60) return { text: "Strong", color: "text-teal-600 dark:text-teal-400" };
  if (score >= 40) return { text: "Decent", color: "text-yellow-600 dark:text-yellow-400" };
  return { text: "Needs work", color: "text-red-500" };
}

function fmt(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function priorityDot(p: string) {
  if (p === "high") return "bg-red-500";
  if (p === "medium") return "bg-orange-400";
  return "bg-gray-400";
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = "text-primary" }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Reflection notes ──────────────────────────────────────────────────────────
const STORAGE_KEY = "flowdeck_weekly_reflection";

function loadReflection(weekStart: string): string {
  try {
    const store = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return store[weekStart] ?? "";
  } catch { return ""; }
}

function saveReflection(weekStart: string, text: string) {
  try {
    const store = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    store[weekStart] = text;
    // Keep only last 12 weeks to avoid bloat
    const keys = Object.keys(store).sort().reverse();
    for (const k of keys.slice(12)) delete store[k];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch { /* ignore */ }
}

function ReflectionPanel({ weekStart }: { weekStart: string }) {
  const [text, setText] = useState(() => loadReflection(weekStart));
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((val: string) => {
    setText(val);
    setSaved(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveReflection(weekStart, val);
      setSaved(true);
      timerRef.current = setTimeout(() => setSaved(false), 2000);
    }, 800);
  }, [weekStart]);

  useEffect(() => {
    setText(loadReflection(weekStart));
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [weekStart]);

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <PenLine className="w-4 h-4 text-primary" /> Weekly reflection
          </span>
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-normal">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <Textarea
          value={text}
          onChange={e => handleChange(e.target.value)}
          placeholder="What went well this week? What do you want to do differently? Any wins worth celebrating?"
          className="resize-none text-sm min-h-[120px] focus-visible:ring-primary/50"
          rows={5}
        />
        <p className="text-xs text-muted-foreground mt-2">
          Saved automatically · Stored locally in your browser per week
        </p>
      </CardContent>
    </Card>
  );
}

// ── Pending tasks callout ─────────────────────────────────────────────────────
function PendingTasksPanel({ weekEnd }: { weekEnd: string }) {
  const { data: tasks } = useListTasks();
  const today = new Date().toISOString().split("T")[0];

  const overdue = useMemo(() => {
    if (!tasks) return [];
    return tasks
      .filter(t => t.status === "pending" && t.dueDate && t.dueDate <= today)
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
      .slice(0, 8);
  }, [tasks, today]);

  const dueThisWeek = useMemo(() => {
    if (!tasks) return [];
    return tasks
      .filter(t => t.status === "pending" && t.dueDate && t.dueDate > today && t.dueDate <= weekEnd)
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
      .slice(0, 8);
  }, [tasks, weekEnd, today]);

  if (!overdue.length && !dueThisWeek.length) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-800/40">
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500" /> Open tasks to address
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4 space-y-4">
        {overdue.length > 0 && (
          <div>
            <p className="text-xs font-medium text-red-500 uppercase tracking-wide mb-2">Overdue</p>
            <ul className="space-y-1.5">
              {overdue.map(t => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityDot(t.priority)}`} />
                  <Link href="/tasks">
                    <span className="text-foreground hover:text-primary cursor-pointer transition-colors line-clamp-1">
                      {t.title}
                    </span>
                  </Link>
                  {t.dueDate && (
                    <span className="ml-auto text-xs text-red-500 flex-shrink-0">{fmt(t.dueDate)}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {dueThisWeek.length > 0 && (
          <div>
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2">Due this week</p>
            <ul className="space-y-1.5">
              {dueThisWeek.map(t => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityDot(t.priority)}`} />
                  <Link href="/tasks">
                    <span className="text-foreground hover:text-primary cursor-pointer transition-colors line-clamp-1">
                      {t.title}
                    </span>
                  </Link>
                  {t.dueDate && (
                    <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">{fmt(t.dueDate)}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WeeklyReview() {
  const { data, isLoading } = useGetWeeklyReview();

  const focusData = useMemo(
    () => data?.days.map(d => ({ day: d.day, minutes: d.focusMinutes })) ?? [],
    [data],
  );

  const habitData = useMemo(
    () => data?.days.map(d => ({
      day: d.day,
      pct: d.habitsTotal > 0 ? Math.round((d.habitsCompleted / d.habitsTotal) * 100) : 0,
    })) ?? [],
    [data],
  );

  const moodData = useMemo(
    () => data?.days.map(d => ({
      day: d.day,
      mood: d.mood,
      label: d.mood ? MOOD_EMOJI[d.mood] : "—",
    })) ?? [],
    [data],
  );

  const taskData = useMemo(
    () => data?.days.map(d => ({ day: d.day, tasks: d.tasksCompleted })) ?? [],
    [data],
  );

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-52" />)}
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!data) return null;

  const { weekStart, weekEnd, weeklyScore, habitCompletionRate, totalFocusMinutes, tasksCompletedCount, avgMood, activeGoals, topHabit } = data;
  const sl = scoreLabel(weeklyScore);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Weekly Review</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {fmt(weekStart)} — {fmt(weekEnd)}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-5 py-3 shadow-sm">
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Weekly score</p>
            <p className={`text-3xl font-extrabold leading-none mt-0.5 ${sl.color}`}>{weeklyScore}</p>
            <p className={`text-xs font-medium mt-0.5 ${sl.color}`}>{sl.text}</p>
          </div>
          <div className="w-px h-10 bg-border" />
          <Star className={`w-8 h-8 ${sl.color}`} />
        </div>
      </div>

      {/* Top habit highlight */}
      {topHabit && (
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
          <Award className="w-5 h-5 text-primary flex-shrink-0" />
          <span className="text-sm font-medium text-foreground">
            Best streak this week:&nbsp;
            <span className="text-primary">{topHabit.name}</span>
            &nbsp;—&nbsp;
            <span className="font-bold">{topHabit.streak} day{topHabit.streak !== 1 ? "s" : ""}</span>
            &nbsp;🔥
          </span>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={CheckSquare} label="Tasks done" value={tasksCompletedCount} sub="this week" />
        <StatCard
          icon={Timer}
          label="Focus time"
          value={`${Math.floor(totalFocusMinutes / 60)}h ${totalFocusMinutes % 60}m`}
          sub="pomodoro sessions"
        />
        <StatCard
          icon={Flame}
          label="Habit rate"
          value={`${habitCompletionRate}%`}
          sub="of all habit slots"
          color={habitCompletionRate >= 70 ? "text-green-600 dark:text-green-400" : habitCompletionRate >= 40 ? "text-yellow-600" : "text-red-500"}
        />
        <StatCard
          icon={Smile}
          label="Avg mood"
          value={avgMood != null ? `${MOOD_EMOJI[Math.round(avgMood)]} ${avgMood}` : "—"}
          sub={avgMood != null ? MOOD_LABEL[Math.round(avgMood)] : "no entries"}
          color={avgMood != null && avgMood >= 4 ? "text-green-600 dark:text-green-400" : avgMood != null && avgMood <= 2 ? "text-red-500" : "text-foreground"}
        />
      </div>

      {/* Goals summary */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> Goals overview
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{activeGoals.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{activeGoals.inProgress}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{activeGoals.completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
            <div className="flex-1 min-w-32">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Completion</span>
                <span>
                  {activeGoals.total > 0 ? Math.round((activeGoals.completed / activeGoals.total) * 100) : 0}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${activeGoals.total > 0 ? Math.round((activeGoals.completed / activeGoals.total) * 100) : 0}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Habit completion % per day */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Flame className="w-4 h-4 text-primary" /> Daily habit completion
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={habitData} barSize={28}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={36} />
                <Tooltip formatter={(v: number) => [`${v}%`, "Completion"]} cursor={{ fill: "hsl(var(--muted))" }} />
                <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                  {habitData.map((entry, i) => (
                    <Cell key={i} fill={entry.pct >= 80 ? "hsl(189,88%,28%)" : entry.pct >= 50 ? "hsl(189,70%,50%)" : "hsl(189,40%,75%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Focus minutes per day */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Timer className="w-4 h-4 text-primary" /> Focus minutes per day
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={focusData} barSize={28}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
                <Tooltip formatter={(v: number) => [`${v} min`, "Focus"]} cursor={{ fill: "hsl(var(--muted))" }} />
                <ReferenceLine y={25} stroke="hsl(189,88%,28%)" strokeDasharray="3 3" strokeOpacity={0.4} />
                <Bar dataKey="minutes" fill="hsl(189,88%,28%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Mood trend */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Smile className="w-4 h-4 text-primary" /> Mood trend
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={moodData}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={20} />
                <Tooltip
                  formatter={(v: number) => [`${MOOD_EMOJI[v]} ${MOOD_LABEL[v]}`, "Mood"]}
                  cursor={{ stroke: "hsl(var(--border))" }}
                />
                <Line
                  type="monotone"
                  dataKey="mood"
                  stroke="hsl(189,88%,28%)"
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (payload.mood === null) return <g key={props.key} />;
                    return (
                      <circle
                        key={props.key}
                        cx={cx} cy={cy} r={5}
                        fill={moodColor(payload.mood)}
                        stroke="white" strokeWidth={2}
                      />
                    );
                  }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex justify-between mt-2 px-1">
              {moodData.map((d, i) => (
                <span key={i} className="text-sm text-center w-8" title={d.mood ? MOOD_LABEL[d.mood] : "No entry"}>
                  {d.label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tasks completed per day */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Tasks completed per day
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={taskData} barSize={28}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                <Tooltip formatter={(v: number) => [v, "Tasks"]} cursor={{ fill: "hsl(var(--muted))" }} />
                <Bar dataKey="tasks" fill="hsl(189,88%,28%)" radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Day-by-day breakdown table */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Day-by-day breakdown</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Day", "Date", "Mood", "Focus", "Habits", "Tasks"].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-muted-foreground px-5 py-2 first:pl-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.days.map((d) => {
                  const habitPct = d.habitsTotal > 0 ? Math.round((d.habitsCompleted / d.habitsTotal) * 100) : null;
                  const isToday = d.date === new Date().toISOString().split("T")[0];
                  return (
                    <tr
                      key={d.date}
                      className={`border-b border-border/50 last:border-0 ${isToday ? "bg-primary/5" : "hover:bg-muted/40"} transition-colors`}
                    >
                      <td className="px-5 py-2.5 font-medium text-foreground">
                        {d.day}
                        {isToday && <Badge variant="secondary" className="ml-2 text-[10px] py-0 h-4">Today</Badge>}
                      </td>
                      <td className="px-5 py-2.5 text-muted-foreground">{fmt(d.date)}</td>
                      <td className="px-5 py-2.5">
                        {d.mood != null
                          ? <span title={MOOD_LABEL[d.mood]}>{MOOD_EMOJI[d.mood]} {d.mood}/5</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-2.5 text-foreground">
                        {d.focusMinutes > 0 ? `${d.focusMinutes}m` : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-2.5">
                        {d.habitsTotal > 0 ? (
                          <span className={habitPct! >= 80 ? "text-green-600 dark:text-green-400 font-medium" : habitPct! >= 50 ? "text-yellow-600" : "text-red-500"}>
                            {d.habitsCompleted}/{d.habitsTotal}
                            <span className="text-muted-foreground font-normal ml-1">({habitPct}%)</span>
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-2.5 font-medium text-foreground">
                        {d.tasksCompleted > 0 ? d.tasksCompleted : <span className="text-muted-foreground">0</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pending tasks callout */}
      <PendingTasksPanel weekEnd={weekEnd} />

      {/* Weekly reflection */}
      <ReflectionPanel weekStart={weekStart} />
    </div>
  );
}
