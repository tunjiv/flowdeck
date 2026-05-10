import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, moodLogsTable } from "@workspace/db";
import {
  CreateMoodLogBody,
  ListMoodLogsQueryParams,
} from "@workspace/api-zod";
import { requireAuth, getUserId } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/mood-logs/today", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const today = new Date().toISOString().split("T")[0];
  const [log] = await db
    .select()
    .from(moodLogsTable)
    .where(and(eq(moodLogsTable.userId, userId), eq(moodLogsTable.logDate, today)));
  if (!log) {
    res.status(404).json({ error: "No mood logged today" });
    return;
  }
  res.json(log);
});

router.get("/mood-logs", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const query = ListMoodLogsQueryParams.safeParse(req.query);
  const logs = await db
    .select()
    .from(moodLogsTable)
    .where(eq(moodLogsTable.userId, userId))
    .orderBy(moodLogsTable.logDate);

  let filtered = logs;
  if (query.success && query.data.month) {
    filtered = filtered.filter(l => l.logDate.startsWith(query.data.month!));
  }
  res.json(filtered);
});

router.post("/mood-logs", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = CreateMoodLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [log] = await db
    .insert(moodLogsTable)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(log);
});

export default router;
