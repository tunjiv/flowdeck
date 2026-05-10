import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, focusSessionsTable } from "@workspace/db";
import {
  CreateFocusSessionBody,
  ListFocusSessionsQueryParams,
} from "@workspace/api-zod";
import { requireAuth, getUserId } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/focus-sessions", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const query = ListFocusSessionsQueryParams.safeParse(req.query);
  const sessions = await db
    .select()
    .from(focusSessionsTable)
    .where(eq(focusSessionsTable.userId, userId))
    .orderBy(focusSessionsTable.sessionDate);

  let filtered = sessions;
  if (query.success) {
    if (query.data.taskId) {
      filtered = filtered.filter(s => s.taskId === query.data.taskId);
    }
    if (query.data.date) {
      filtered = filtered.filter(s => s.sessionDate === query.data.date);
    }
  }
  res.json(filtered);
});

router.post("/focus-sessions", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = CreateFocusSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [session] = await db
    .insert(focusSessionsTable)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(session);
});

export default router;
