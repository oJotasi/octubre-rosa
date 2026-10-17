import { sqliteTable, text, integer, index, check } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const gameSessions = sqliteTable("game_sessions", {
  id: text("id").primaryKey(),
  questionSetVersion: text("question_set_version").notNull(),
  questions: text("questions").notNull(),
  answer0: integer("answer_0"), answer1: integer("answer_1"), answer2: integer("answer_2"),
  correctCount: integer("correct_count"), isCorrect: integer("is_correct", { mode: "boolean" }),
  createdAt: integer("created_at").notNull(), expiresAt: integer("expires_at").notNull(), completedAt: integer("completed_at"),
}, (table) => [
  index("completed_sessions_idx").on(table.completedAt),
  check("valid_correct_count", sql`${table.correctCount} between 0 and 3`),
  check("valid_result", sql`(${table.completedAt} is null and ${table.correctCount} is null and ${table.isCorrect} is null) or (${table.completedAt} is not null and ${table.correctCount} is not null and ${table.isCorrect} = (${table.correctCount} = 3))`),
]);
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(), count: integer("count").notNull(), resetAt: integer("reset_at").notNull(),
});
// One permanent claim per participant for this event. Never clear claims on expiry.
export const attemptClaims = sqliteTable("attempt_claims", {
  participantKey: text("participant_key").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
});
