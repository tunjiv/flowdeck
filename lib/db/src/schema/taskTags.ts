import { pgTable, integer, primaryKey } from "drizzle-orm/pg-core";

export const taskTagsTable = pgTable("task_tags", {
  taskId: integer("task_id").notNull(),
  tagId: integer("tag_id").notNull(),
}, t => [primaryKey({ columns: [t.taskId, t.tagId] })]);
