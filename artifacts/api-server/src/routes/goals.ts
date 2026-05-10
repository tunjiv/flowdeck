import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, goalsTable, tasksTable, habitLogsTable } from "@workspace/db";
import {
  CreateGoalBody,
  UpdateGoalBody,
  UpdateGoalParams,
  GetGoalParams,
  DeleteGoalParams,
  GetGoalProgressParams,
  CompleteGoalParams,
  ListGoalsQueryParams,
} from "@workspace/api-zod";
import { requireAuth, getUserId } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/goals", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const query = ListGoalsQueryParams.safeParse(req.query);
  const goals = await db
    .select()
    .from(goalsTable)
    .where(eq(goalsTable.userId, userId))
    .orderBy(goalsTable.createdAt);

  let filtered = goals;
  if (query.success && query.data.status) {
    filtered = filtered.filter(g => g.status === query.data.status);
  }
  if (query.success && query.data.categoryId) {
    filtered = filtered.filter(g => g.categoryId === query.data.categoryId);
  }
  res.json(filtered);
});

router.post("/goals", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [goal] = await db
    .insert(goalsTable)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(goal);
});

router.get("/goals/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = GetGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [goal] = await db
    .select()
    .from(goalsTable)
    .where(and(eq(goalsTable.id, params.data.id), eq(goalsTable.userId, userId)));
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  res.json(goal);
});

router.patch("/goals/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = UpdateGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [goal] = await db
    .update(goalsTable)
    .set(parsed.data)
    .where(and(eq(goalsTable.id, params.data.id), eq(goalsTable.userId, userId)))
    .returning();
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  res.json(goal);
});

router.delete("/goals/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = DeleteGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(goalsTable)
    .where(and(eq(goalsTable.id, params.data.id), eq(goalsTable.userId, userId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/goals/:id/progress", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = GetGoalProgressParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [goal] = await db
    .select()
    .from(goalsTable)
    .where(and(eq(goalsTable.id, params.data.id), eq(goalsTable.userId, userId)));
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  const current = goal.currentValue ?? 0;
  const target = goal.targetValue ?? 1;
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  // Count linked tasks as milestones for milestone goals
  const linkedTasks = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.goalId, params.data.id), eq(tasksTable.userId, userId)));
  const completedMilestones = linkedTasks.filter(t => t.status === "completed").length;
  const totalMilestones = linkedTasks.length;

  res.json({
    goalId: goal.id,
    percent,
    currentValue: current,
    targetValue: target,
    completedMilestones,
    totalMilestones,
  });
});

router.post("/goals/:id/complete", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = CompleteGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [goal] = await db
    .update(goalsTable)
    .set({ status: "completed" })
    .where(and(eq(goalsTable.id, params.data.id), eq(goalsTable.userId, userId)))
    .returning();
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  res.json(goal);
});

export default router;
