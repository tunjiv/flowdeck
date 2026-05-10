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

  // Productivity score: weighted mix of tasks + habits
  const taskRate = todayTasks.length > 0 ? completedToday.length / (todayTasks.length + completedToday.length) : 0;
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

  const tasksCompletionRate = todayTasks.length > 0
    ? completedToday.length / (todayTasks.length + completedToday.length)
    : completedToday.length > 0 ? 1 : 0;
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

export default router;
