import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const moodLogsTable = pgTable("mood_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  mood: integer("mood").notNull(),
  notes: text("notes"),
  logDate: text("log_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMoodLogSchema = createInsertSchema(moodLogsTable).omit({ id: true, createdAt: true });
export type InsertMoodLog = z.infer<typeof insertMoodLogSchema>;
export type MoodLog = typeof moodLogsTable.$inferSelect;
