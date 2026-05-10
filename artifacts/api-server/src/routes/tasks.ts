import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, tasksTable } from "@workspace/db";
import {
  CreateTaskBody,
  UpdateTaskBody,
  UpdateTaskParams,
  GetTaskParams,
  DeleteTaskParams,
  CompleteTaskParams,
  ListTasksQueryParams,
} from "@workspace/api-zod";
import { requireAuth, getUserId } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/tasks/today", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const today = new Date().toISOString().split("T")[0];
  const tasks = await db
    .select()
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.userId, userId),
        eq(tasksTable.status, "pending"),
      ),
    )
    .orderBy(tasksTable.sortOrder, tasksTable.createdAt);

  // Return tasks due today or overdue
  const todayTasks = tasks.filter(t => {
    if (!t.dueDate) return false;
    return t.dueDate <= today;
  });
  res.json(todayTasks);
});

router.get("/tasks", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const query = ListTasksQueryParams.safeParse(req.query);
  const allTasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.userId, userId))
    .orderBy(tasksTable.sortOrder, tasksTable.createdAt);

  let filtered = allTasks;
  if (query.success) {
    if (query.data.status) {
      filtered = filtered.filter(t => t.status === query.data.status);
    }
    if (query.data.goalId) {
      filtered = filtered.filter(t => t.goalId === query.data.goalId);
    }
    if (query.data.priority) {
      filtered = filtered.filter(t => t.priority === query.data.priority);
    }
    if (query.data.dueDate) {
      filtered = filtered.filter(t => t.dueDate === query.data.dueDate);
    }
  }
  res.json(filtered);
});

router.post("/tasks", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [task] = await db
    .insert(tasksTable)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(task);
});

router.get("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = GetTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [task] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.userId, userId)));
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(task);
});

router.patch("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [task] = await db
    .update(tasksTable)
    .set(parsed.data)
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.userId, userId)))
    .returning();
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(task);
});

router.delete("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(tasksTable)
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.userId, userId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/tasks/:id/complete", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = CompleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const newStatus = existing.status === "completed" ? "pending" : "completed";
  const [task] = await db
    .update(tasksTable)
    .set({
      status: newStatus,
      completedAt: newStatus === "completed" ? new Date() : null,
    })
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.userId, userId)))
    .returning();
  res.json(task);
});

export default router;
