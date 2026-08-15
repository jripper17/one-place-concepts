import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const teamMembers = sqliteTable("team_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["manager", "member"] }).notNull().default("member"),
}, table => [uniqueIndex("idx_team_members_user_id").on(table.userId)]);

export const timeEntries = sqliteTable("time_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().default("legacy"),
  date: text("date").notNull(),
  client: text("client").notNull(),
  project: text("project").notNull(),
  description: text("description").notNull(),
  hours: real("hours").notNull(),
  rate: real("rate").notNull(),
  billable: integer("billable", { mode: "boolean" }).notNull().default(true),
});
