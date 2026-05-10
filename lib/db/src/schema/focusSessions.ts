import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const focusSessionsTable = pgTable("focus_sessions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  taskId: integer("task_id"),
  durationMinutes: integer("duration_minutes").notNull(),
  sessionType: text("session_type").notNull().default("pomodoro"),
  sessionDate: text("session_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFocusSessionSchema = createInsertSchema(focusSessionsTable).omit({ id: true, createdAt: true });
export type InsertFocusSession = z.infer<typeof insertFocusSessionSchema>;
export type FocusSession = typeof focusSessionsTable.$inferSelect;
