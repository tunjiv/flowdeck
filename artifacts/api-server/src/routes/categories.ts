import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, categoriesTable } from "@workspace/db";
import {
  CreateCategoryBody,
  UpdateCategoryBody,
  UpdateCategoryParams,
  GetCategoryParams,
  DeleteCategoryParams,
} from "@workspace/api-zod";
import { requireAuth, getUserId } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/categories", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const categories = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.userId, userId))
    .orderBy(categoriesTable.createdAt);
  res.json(categories);
});

router.post("/categories", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [category] = await db
    .insert(categoriesTable)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(category);
});

router.get("/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = GetCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [category] = await db
    .select()
    .from(categoriesTable)
    .where(and(eq(categoriesTable.id, params.data.id), eq(categoriesTable.userId, userId)));
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.json(category);
});

router.patch("/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = UpdateCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [category] = await db
    .update(categoriesTable)
    .set(parsed.data)
    .where(and(eq(categoriesTable.id, params.data.id), eq(categoriesTable.userId, userId)))
    .returning();
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.json(category);
});

router.delete("/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = DeleteCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(categoriesTable)
    .where(and(eq(categoriesTable.id, params.data.id), eq(categoriesTable.userId, userId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
