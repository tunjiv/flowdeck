import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, tasksTable, goalsTable, habitsTable, habitLogsTable, moodLogsTable, focusSessionsTable } from "@workspace/db";
import { requireAuth, getUserId } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const today = new Date().toISOString().split("T")[0];

  const [allTasks, activeGoals, allHabits, habitLogs, moodLog, focusSessions] = await Promise.all([
    db.select().from(tasksTable).where(eq(tasksTable.userId, userId)),
    db.select().from(goalsTable).where(and(eq(goalsTable.userId, userId), eq(goalsTable.status, "active"))),
    db.select().from(habitsTable).where(and(eq(habitsTable.userId, userId), eq(habitsTable.isArchived, false))),
    db.select().from(habitLogsTable).where(and(eq(habitLogsTable.userId, userId), eq(habitLogsTable.logDate, today))),
    db.select().from(moodLogsTable).where(and(eq(moodLogsTable.userId, userId), eq(moodLogsTable.logDate, today))),
    db.select().from(focusSessionsTable).where(and(eq(focusSessionsTable.userId, userId), eq(focusSessionsTable.sessionDate, today))),
  ]);

  const todayTasks = allTasks.filter(t => t.dueDate && t.dueDate <= today && t.status === "pending");
  const completedToday = allTasks.filter(t => t.completedAt && t.completedAt.toISOString().split("T")[0] === today);
  const habitsToday = allHabits.length;
  const habitsCompleted = habitLogs.length;

  // Productivity score: completed-today / (pending due-or-overdue + completed-today)
  // Completed overdue still counts in the numerator but won't pin the score to 100%
  // unless there's nothing left pending.
  const taskDenominator = todayTasks.length + completedToday.length;
  const taskRate = taskDenominator > 0 ? completedToday.length / taskDenominator : 0;
  const habitRate = habitsToday > 0 ? habitsCompleted / habitsToday : 0;
  const productivityScore = Math.round((taskRate * 0.6 + habitRate * 0.4) * 100);

  // Streak highlight — find habit with longest current streak
  let streakHighlight: number | null = null;
  for (const habit of allHabits) {
    const logs = await db
      .select()
      .from(habitLogsTable)
      .where(eq(habitLogsTable.habitId, habit.id))
      .orderBy(habitLogsTable.logDate);
    const logDates = new Set(logs.map(l => l.logDate));
    let streak = 0;
    const checkDate = new Date();
    while (true) {
      const dateStr = checkDate.toISOString().split("T")[0];
      if (logDates.has(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else break;
    }
    if (streakHighlight === null || streak > streakHighlight) {
      streakHighlight = streak;
    }
  }

  res.json({
    tasksToday: todayTasks.length + completedToday.length,
    tasksCompleted: completedToday.length,
    activeGoals: activeGoals.length,
    habitsToday,
    habitsCompleted,
    productivityScore,
    moodToday: moodLog[0]?.mood ?? null,
    streakHighlight,
  });
});

router.get("/dashboard/weekly-overview", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const result = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const tasks = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.userId, userId));
    const completed = tasks.filter(t => t.completedAt && t.completedAt.toISOString().split("T")[0] === dateStr).length;
    result.push({
      date: dateStr,
      day: days[d.getDay()],
      count: completed,
    });
  }
  res.json(result);
});

router.get("/dashboard/productivity-score", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const today = new Date().toISOString().split("T")[0];

  const [tasks, habits, habitLogs] = await Promise.all([
    db.select().from(tasksTable).where(eq(tasksTable.userId, userId)),
    db.select().from(habitsTable).where(and(eq(habitsTable.userId, userId), eq(habitsTable.isArchived, false))),
    db.select().from(habitLogsTable).where(and(eq(habitLogsTable.userId, userId), eq(habitLogsTable.logDate, today))),
  ]);

  const todayTasks = tasks.filter(t => t.dueDate && t.dueDate <= today && t.status === "pending");
  const completedToday = tasks.filter(t => t.completedAt && t.completedAt.toISOString().split("T")[0] === today);
  const habitsToday = habits.length;
  const habitsCompleted = habitLogs.length;

  // Denominator = anything that needed attention today (pending due-or-overdue + completed today).
  // Don't fall back to 100% when only overdue work was cleared but other items remain.
  const taskDenominator = todayTasks.length + completedToday.length;
  const tasksCompletionRate = taskDenominator > 0 ? completedToday.length / taskDenominator : 0;
  const habitCompletionRate = habitsToday > 0 ? habitsCompleted / habitsToday : 0;
  const score = Math.round((tasksCompletionRate * 0.6 + habitCompletionRate * 0.4) * 100);

  res.json({ score, tasksCompletionRate, habitCompletionRate, date: today });
});

router.get("/dashboard/upcoming", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const today = new Date();
  const in7Days = new Date(today);
  in7Days.setDate(in7Days.getDate() + 7);
  const todayStr = today.toISOString().split("T")[0];
  const in7DaysStr = in7Days.toISOString().split("T")[0];

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.userId, userId), eq(tasksTable.status, "pending")))
    .orderBy(tasksTable.dueDate);

  const upcoming = tasks.filter(t => t.dueDate && t.dueDate >= todayStr && t.dueDate <= in7DaysStr);
  res.json(upcoming);
});

router.get("/dashboard/weekly-review", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Build the 7-day window ending today
  const todayDate = new Date();
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  const weekStart = dates[0];
  const weekEnd = dates[6];

  // Fetch all data for the window in parallel
  const [allTasks, allHabits, allHabitLogs, allMoodLogs, allFocusSessions, allGoals] = await Promise.all([
    db.select().from(tasksTable).where(eq(tasksTable.userId, userId)),
    db.select().from(habitsTable).where(and(eq(habitsTable.userId, userId), eq(habitsTable.isArchived, false))),
    db.select().from(habitLogsTable).where(eq(habitLogsTable.userId, userId)),
    db.select().from(moodLogsTable).where(eq(moodLogsTable.userId, userId)),
    db.select().from(focusSessionsTable).where(eq(focusSessionsTable.userId, userId)),
    db.select().from(goalsTable).where(eq(goalsTable.userId, userId)),
  ]);

  const habitsTotal = allHabits.length;

  // Per-day breakdown
  const days = dates.map((dateStr) => {
    const d = new Date(dateStr + "T12:00:00");
    const day = DAY_LABELS[d.getDay()];

    const tasksCompleted = allTasks.filter(
      t => t.completedAt && t.completedAt.toISOString().split("T")[0] === dateStr
    ).length;

    const habitsCompleted = allHabitLogs.filter(l => l.logDate === dateStr).length;

    const focusMinutes = allFocusSessions
      .filter(s => s.sessionDate === dateStr && s.sessionType === "pomodoro")
      .reduce((sum, s) => sum + s.durationMinutes, 0);

    const moodEntry = allMoodLogs.find(m => m.logDate === dateStr);

    return {
      date: dateStr,
      day,
      mood: moodEntry?.mood ?? null,
      focusMinutes,
      tasksCompleted,
      habitsCompleted,
      habitsTotal,
    };
  });

  // Aggregate totals
  const totalFocusMinutes = days.reduce((s, d) => s + d.focusMinutes, 0);
  const tasksCompletedCount = days.reduce((s, d) => s + d.tasksCompleted, 0);

  const moodValues = days.map(d => d.mood).filter((m): m is number => m !== null);
  const avgMood = moodValues.length > 0
    ? Math.round((moodValues.reduce((s, m) => s + m, 0) / moodValues.length) * 10) / 10
    : null;

  const totalPossibleHabitSlots = habitsTotal * 7;
  const totalHabitsCompleted = days.reduce((s, d) => s + d.habitsCompleted, 0);
  const habitCompletionRate = totalPossibleHabitSlots > 0
    ? Math.round((totalHabitsCompleted / totalPossibleHabitSlots) * 100)
    : 0;

  // Goals summary
  const goalsSummary = {
    total: allGoals.length,
    completed: allGoals.filter(g => g.status === "completed").length,
    inProgress: allGoals.filter(g => g.status === "active").length,
  };

  // Top habit by streak this week
  let topHabit: { name: string; streak: number } | null = null;
  for (const habit of allHabits) {
    const logDates = new Set(allHabitLogs.filter(l => l.habitId === habit.id).map(l => l.logDate));
    let streak = 0;
    const check = new Date(todayDate);
    while (true) {
      const ds = check.toISOString().split("T")[0];
      if (logDates.has(ds)) { streak++; check.setDate(check.getDate() - 1); }
      else break;
    }
    if (!topHabit || streak > topHabit.streak) {
      topHabit = { name: habit.name, streak };
    }
  }
  if (topHabit?.streak === 0) topHabit = null;

  // Weekly score: weighted mix of habit rate, focus presence, task output, mood
  const focusScore = Math.min(totalFocusMinutes / (7 * 25), 1); // 1 pomodoro/day = 100%
  const moodScore = avgMood !== null ? (avgMood - 1) / 4 : 0;
  const weeklyScore = Math.round(
    (habitCompletionRate * 0.4 + focusScore * 100 * 0.3 + moodScore * 100 * 0.3)
  );

  res.json({
    weekStart,
    weekEnd,
    days,
    habitCompletionRate,
    totalFocusMinutes,
    tasksCompletedCount,
    avgMood,
    activeGoals: goalsSummary,
    topHabit,
    weeklyScore,
  });
});

export default router;
