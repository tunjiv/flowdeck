import { pgTable, serial, text, timestamp, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const habitsTable = pgTable("habits", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  categoryId: integer("category_id"),
  goalId: integer("goal_id"),
  frequency: text("frequency").notNull().default("daily"),
  targetValue: real("target_value"),
  icon: text("icon"),
  color: text("color"),
  motivationNote: text("motivation_note"),
  graceDaysPerWeek: integer("grace_days_per_week").notNull().default(0),
  recurrenceConfig: text("recurrence_config"),
  startDate: text("start_date"),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHabitSchema = createInsertSchema(habitsTable).omit({ id: true, createdAt: true });
export type InsertHabit = z.infer<typeof insertHabitSchema>;
export type Habit = typeof habitsTable.$inferSelect;
