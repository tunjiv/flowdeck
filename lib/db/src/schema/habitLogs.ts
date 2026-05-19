import { pgTable, serial, text, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const habitLogsTable = pgTable("habit_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  habitId: integer("habit_id").notNull(),
  logDate: text("log_date").notNull(),
  status: text("status").notNull().default("done"),
  value: real("value"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHabitLogSchema = createInsertSchema(habitLogsTable).omit({ id: true, createdAt: true });
export type InsertHabitLog = z.infer<typeof insertHabitLogSchema>;
export type HabitLog = typeof habitLogsTable.$inferSelect;
