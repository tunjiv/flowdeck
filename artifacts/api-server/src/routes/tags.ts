import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, tagsTable } from "@workspace/db";
import { CreateTagBody, DeleteTagParams } from "@workspace/api-zod";
import { requireAuth, getUserId } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/tags", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const tags = await db
    .select()
    .from(tagsTable)
    .where(eq(tagsTable.userId, userId))
    .orderBy(tagsTable.name);
  res.json(tags);
});

router.post("/tags", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = CreateTagBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [tag] = await db
    .insert(tagsTable)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(tag);
});

router.delete("/tags/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = DeleteTagParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(tagsTable)
    .where(and(eq(tagsTable.id, params.data.id), eq(tagsTable.userId, userId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Tag not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
