import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, subtasksTable } from "@workspace/db";
import {
  ListSubtasksParams,
  CreateSubtaskBody,
  CreateSubtaskParams,
  UpdateSubtaskBody,
  UpdateSubtaskParams,
  DeleteSubtaskParams,
  ToggleSubtaskParams,
} from "@workspace/api-zod";
import { requireAuth, getUserId } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/tasks/:taskId/subtasks", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = ListSubtasksParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const subtasks = await db
    .select()
    .from(subtasksTable)
    .where(and(eq(subtasksTable.taskId, params.data.taskId), eq(subtasksTable.userId, userId)))
    .orderBy(subtasksTable.sortOrder, subtasksTable.createdAt);
  res.json(subtasks);
});

router.post("/tasks/:taskId/subtasks", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = CreateSubtaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = CreateSubtaskBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [subtask] = await db
    .insert(subtasksTable)
    .values({ ...body.data, taskId: params.data.taskId, userId })
    .returning();
  res.status(201).json(subtask);
});

router.patch("/tasks/:taskId/subtasks/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = UpdateSubtaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateSubtaskBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [subtask] = await db
    .update(subtasksTable)
    .set(body.data)
    .where(and(eq(subtasksTable.id, params.data.id), eq(subtasksTable.taskId, params.data.taskId), eq(subtasksTable.userId, userId)))
    .returning();
  if (!subtask) {
    res.status(404).json({ error: "Subtask not found" });
    return;
  }
  res.json(subtask);
});

router.delete("/tasks/:taskId/subtasks/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = DeleteSubtaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(subtasksTable)
    .where(and(eq(subtasksTable.id, params.data.id), eq(subtasksTable.taskId, params.data.taskId), eq(subtasksTable.userId, userId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Subtask not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/tasks/:taskId/subtasks/:id/toggle", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = ToggleSubtaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(subtasksTable)
    .where(and(eq(subtasksTable.id, params.data.id), eq(subtasksTable.taskId, params.data.taskId), eq(subtasksTable.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Subtask not found" });
    return;
  }
  const [subtask] = await db
    .update(subtasksTable)
    .set({ completed: !existing.completed })
    .where(eq(subtasksTable.id, existing.id))
    .returning();
  res.json(subtask);
});

export default router;
