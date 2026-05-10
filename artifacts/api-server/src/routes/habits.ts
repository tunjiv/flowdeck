import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, habitsTable, habitLogsTable } from "@workspace/db";
import {
  CreateHabitBody,
  UpdateHabitBody,
  UpdateHabitParams,
  GetHabitParams,
  DeleteHabitParams,
  GetHabitStreaksParams,
  GetHabitHeatmapParams,
  LogHabitBody,
  ListHabitLogsQueryParams,
  DeleteHabitLogParams,
} from "@workspace/api-zod";
import { requireAuth, getUserId } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/habits", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const habits = await db
    .select()
    .from(habitsTable)
    .where(and(eq(habitsTable.userId, userId), eq(habitsTable.isArchived, false)))
    .orderBy(habitsTable.createdAt);
  res.json(habits);
});

router.post("/habits", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = CreateHabitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [habit] = await db
    .insert(habitsTable)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(habit);
});

router.get("/habits/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = GetHabitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [habit] = await db
    .select()
    .from(habitsTable)
    .where(and(eq(habitsTable.id, params.data.id), eq(habitsTable.userId, userId)));
  if (!habit) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }
  res.json(habit);
});

router.patch("/habits/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = UpdateHabitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateHabitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [habit] = await db
    .update(habitsTable)
    .set(parsed.data)
    .where(and(eq(habitsTable.id, params.data.id), eq(habitsTable.userId, userId)))
    .returning();
  if (!habit) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }
  res.json(habit);
});

router.delete("/habits/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = DeleteHabitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(habitsTable)
    .where(and(eq(habitsTable.id, params.data.id), eq(habitsTable.userId, userId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/habits/:id/streaks", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = GetHabitStreaksParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [habit] = await db
    .select()
    .from(habitsTable)
    .where(and(eq(habitsTable.id, params.data.id), eq(habitsTable.userId, userId)));
  if (!habit) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }

  const logs = await db
    .select()
    .from(habitLogsTable)
    .where(and(eq(habitLogsTable.habitId, params.data.id), eq(habitLogsTable.userId, userId)))
    .orderBy(habitLogsTable.logDate);

  const logDates = new Set(logs.map(l => l.logDate));

  // Calculate current streak
  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;
  const today = new Date();

  // Build sorted dates array
  const sortedDates = Array.from(logDates).sort();

  // Calculate longest streak
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      streak = 1;
    } else {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        streak++;
      } else {
        streak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, streak);
  }

  // Calculate current streak (backwards from today)
  const todayStr = today.toISOString().split("T")[0];
  let checkDate = new Date(today);
  while (true) {
    const dateStr = checkDate.toISOString().split("T")[0];
    if (logDates.has(dateStr)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Calculate completion rates
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const weekLogs = sortedDates.filter(d => d >= weekAgo.toISOString().split("T")[0]);
  const monthLogs = sortedDates.filter(d => d >= monthAgo.toISOString().split("T")[0]);

  res.json({
    habitId: habit.id,
    currentStreak,
    longestStreak,
    completionRateWeek: Math.round((weekLogs.length / 7) * 100) / 100,
    completionRateMonth: Math.round((monthLogs.length / 30) * 100) / 100,
  });
});

router.get("/habits/:id/heatmap", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = GetHabitHeatmapParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [habit] = await db
    .select()
    .from(habitsTable)
    .where(and(eq(habitsTable.id, params.data.id), eq(habitsTable.userId, userId)));
  if (!habit) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }

  // Get last 365 days of logs
  const yearAgo = new Date();
  yearAgo.setDate(yearAgo.getDate() - 365);
  const yearAgoStr = yearAgo.toISOString().split("T")[0];

  const logs = await db
    .select()
    .from(habitLogsTable)
    .where(and(eq(habitLogsTable.habitId, params.data.id), eq(habitLogsTable.userId, userId)));

  const countByDate: Record<string, number> = {};
  for (const log of logs) {
    if (log.logDate >= yearAgoStr) {
      countByDate[log.logDate] = (countByDate[log.logDate] ?? 0) + 1;
    }
  }

  // Generate full 365-day grid
  const result = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    result.push({ date: dateStr, count: countByDate[dateStr] ?? 0 });
  }

  res.json(result);
});

// Habit logs routes
router.get("/habit-logs", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const query = ListHabitLogsQueryParams.safeParse(req.query);
  const allLogs = await db
    .select()
    .from(habitLogsTable)
    .where(eq(habitLogsTable.userId, userId))
    .orderBy(habitLogsTable.logDate);

  let filtered = allLogs;
  if (query.success) {
    if (query.data.habitId) {
      filtered = filtered.filter(l => l.habitId === query.data.habitId);
    }
    if (query.data.date) {
      filtered = filtered.filter(l => l.logDate === query.data.date);
    }
  }
  res.json(filtered);
});

router.post("/habit-logs", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = LogHabitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [log] = await db
    .insert(habitLogsTable)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(log);
});

router.delete("/habit-logs/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = DeleteHabitLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(habitLogsTable)
    .where(and(eq(habitLogsTable.id, params.data.id), eq(habitLogsTable.userId, userId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Habit log not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
