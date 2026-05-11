import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, taskTagsTable, tagsTable, tasksTable } from "@workspace/db";
import {
  GetTaskTagsParams,
  AddTagToTaskParams,
  RemoveTagFromTaskParams,
} from "@workspace/api-zod";
import { requireAuth, getUserId } from "../middlewares/requireAuth";

const router: IRouter = Router();

// All task-tag pairs for the user (used for client-side filtering + display)
router.get("/task-tags", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  // Get all task IDs belonging to this user
  const userTasks = await db.select({ id: tasksTable.id }).from(tasksTable)
    .where(eq(tasksTable.userId, userId));
  if (!userTasks.length) { res.json([]); return; }
  const taskIds = userTasks.map(t => t.id);
  const rows = await db.select().from(taskTagsTable)
    .where(inArray(taskTagsTable.taskId, taskIds));
  res.json(rows);
});

router.get("/tasks/:taskId/tags", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = GetTaskTagsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  // Verify task ownership
  const [task] = await db.select().from(tasksTable)
    .where(and(eq(tasksTable.id, params.data.taskId), eq(tasksTable.userId, userId)));
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }

  const rows = await db.select().from(taskTagsTable)
    .where(eq(taskTagsTable.taskId, params.data.taskId));
  if (!rows.length) { res.json([]); return; }

  const tagIds = rows.map(r => r.tagId);
  const tags = await db.select().from(tagsTable)
    .where(and(inArray(tagsTable.id, tagIds), eq(tagsTable.userId, userId)));
  res.json(tags);
});

router.put("/tasks/:taskId/tags/:tagId", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = AddTagToTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [task] = await db.select().from(tasksTable)
    .where(and(eq(tasksTable.id, params.data.taskId), eq(tasksTable.userId, userId)));
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }

  const [tag] = await db.select().from(tagsTable)
    .where(and(eq(tagsTable.id, params.data.tagId), eq(tagsTable.userId, userId)));
  if (!tag) { res.status(404).json({ error: "Tag not found" }); return; }

  await db.insert(taskTagsTable)
    .values({ taskId: params.data.taskId, tagId: params.data.tagId })
    .onConflictDoNothing();
  res.sendStatus(204);
});

router.delete("/tasks/:taskId/tags/:tagId", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = RemoveTagFromTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [task] = await db.select().from(tasksTable)
    .where(and(eq(tasksTable.id, params.data.taskId), eq(tasksTable.userId, userId)));
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }

  await db.delete(taskTagsTable)
    .where(and(eq(taskTagsTable.taskId, params.data.taskId), eq(taskTagsTable.tagId, params.data.tagId)));
  res.sendStatus(204);
});

export default router;
