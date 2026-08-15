import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const timeEntries = sqliteTable("time_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  client: text("client").notNull(),
  project: text("project").notNull(),
  description: text("description").notNull(),
  hours: real("hours").notNull(),
  rate: real("rate").notNull(),
  billable: integer("billable", { mode: "boolean" }).notNull().default(true),
});
