import { useParams, Link } from "wouter";
import {
  useGetHabit,
  useGetHabitStreaks,
  useGetHabitHeatmap,
} from "@workspace/api-client-react";
import { ArrowLeft, Flame, TrendingUp, Calendar, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays } from "date-fns";

function HeatmapCell({ count }: { count: number }) {
  const opacity = count === 0 ? 0 : count === 1 ? 0.3 : count <= 2 ? 0.6 : 1;
  return (
    <div
      className="w-3 h-3 rounded-sm"
      style={{ backgroundColor: `hsl(189, 88%, 28%, ${opacity})` }}
    />
  );
}

export default function HabitDetail() {
  const { id } = useParams<{ id: string }>();
  const habitId = Number(id);

  const { data: habit, isLoading } = useGetHabit(habitId);
  const { data: streaks } = useGetHabitStreaks(habitId);
  const { data: heatmap } = useGetHabitHeatmap(habitId);

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!habit) {
    return (
      <div className="p-6 text-center py-16">
        <p className="text-muted-foreground">Habit not found.</p>
        <Link href="/habits"><Button variant="outline" className="mt-3">Back to habits</Button></Link>
      </div>
    );
  }

  // Build 52-week grid (7 rows × 53 cols)
  const weeks: Array<typeof heatmap> = [];
  if (heatmap) {
    for (let i = 0; i < heatmap.length; i += 7) {
      weeks.push(heatmap.slice(i, i + 7));
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/habits">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg"
            style={{ backgroundColor: `${habit.color ?? "#14b8a6"}20`, color: habit.color ?? "#14b8a6" }}
          >
            {habit.name[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{habit.name}</h1>
            <p className="text-sm text-muted-foreground capitalize">{habit.frequency}</p>
          </div>
        </div>
      </div>

      {/* Grace days banner */}
      {streaks && (streaks.graceTotal ?? 0) > 0 && (
        <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
          streaks.isStreakProtected
            ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
            : "bg-primary/5 border-primary/20"
        }`}>
          {streaks.isStreakProtected
            ? <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            : <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${streaks.isStreakProtected ? "text-amber-800 dark:text-amber-300" : "text-foreground"}`}>
              {streaks.isStreakProtected
                ? `Streak protected — ${streaks.graceUsedThisWeek}/${streaks.graceTotal} grace day${streaks.graceTotal !== 1 ? "s" : ""} used this week`
                : `Grace freeze active — ${streaks.graceTotal} missed day${streaks.graceTotal !== 1 ? "s" : ""} allowed per week`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {streaks.isStreakProtected
                ? "A grace day is shielding your streak right now"
                : `${streaks.graceTotal - (streaks.graceUsedThisWeek ?? 0)} grace day${(streaks.graceTotal - (streaks.graceUsedThisWeek ?? 0)) !== 1 ? "s" : ""} remaining this week`}
            </p>
          </div>
          {/* Grace pip indicators */}
          <div className="flex gap-1 flex-shrink-0">
            {Array.from({ length: streaks.graceTotal }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full ${
                  i < (streaks.graceUsedThisWeek ?? 0)
                    ? "bg-amber-500"
                    : "bg-primary/30"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Streaks */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Current streak</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{streaks?.currentStreak ?? 0}</p>
            <p className="text-xs text-muted-foreground">
              {streaks?.isStreakProtected ? "🛡️ protected" : "days"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Best streak</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{streaks?.longestStreak ?? 0}</p>
            <p className="text-xs text-muted-foreground">days</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">7-day rate</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {streaks ? Math.round((streaks.completionRateWeek ?? 0) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">30-day rate</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {streaks ? Math.round((streaks.completionRateMonth ?? 0) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card className="border-border">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold">Activity (last 365 days)</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4 overflow-x-auto">
          <div className="flex gap-0.5">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {(week ?? []).map((day, di) => (
                  <HeatmapCell key={di} count={day?.count ?? 0} />
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            <span className="text-xs text-muted-foreground">Less</span>
            {[0, 0.3, 0.6, 1].map((o, i) => (
              <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(189, 88%, 28%, ${o})` }} />
            ))}
            <span className="text-xs text-muted-foreground">More</span>
          </div>
        </CardContent>
      </Card>

      {/* Motivation note */}
      {habit.motivationNote && (
        <Card className="border-border bg-primary/5">
          <CardContent className="p-4">
            <p className="text-sm text-foreground italic">"{habit.motivationNote}"</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
