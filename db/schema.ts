import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const teamMembers = sqliteTable("team_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["manager", "member"] }).notNull().default("member"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
}, table => [uniqueIndex("idx_team_members_user_id").on(table.userId)]);

export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ninjaOneId: integer("ninjaone_id"),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  hourlyRate: real("hourly_rate").notNull().default(0),
  monthlyRecurringRevenue: real("monthly_recurring_revenue").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  syncedAt: text("synced_at"),
}, table => [uniqueIndex("idx_clients_ninjaone_id").on(table.ninjaOneId)]);

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

export const businessSettings = sqliteTable("business_settings", {
  id: integer("id").primaryKey().default(1),
  federalTaxRate: real("federal_tax_rate").notNull().default(25),
});

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  client: text("client").notNull(),
  name: text("name").notNull(),
  budgetHours: real("budget_hours").notNull().default(0),
  startDate: text("start_date").notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status", { enum: ["planned", "active", "complete"] }).notNull().default("active"),
});

export const projectTasks = sqliteTable("project_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id),
  title: text("title").notNull(),
  assigneeUserId: text("assignee_user_id").notNull(),
  estimatedHours: real("estimated_hours").notNull().default(0),
  dueDate: text("due_date").notNull(),
  status: text("status", { enum: ["todo", "in_progress", "complete"] }).notNull().default("todo"),
}, table => [index("idx_project_tasks_project_id").on(table.projectId), index("idx_project_tasks_assignee").on(table.assigneeUserId)]);

export const quotes = sqliteTable("quotes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  client: text("client").notNull(),
  description: text("description").notNull(),
  quantity: real("quantity").notNull().default(1),
  rate: real("rate").notNull().default(0),
  expiresOn: text("expires_on").notNull(),
  status: text("status", { enum: ["draft", "sent", "accepted"] }).notNull().default("draft"),
  createdAt: text("created_at").notNull(),
}, table => [index("idx_quotes_status").on(table.status), index("idx_quotes_client").on(table.client)]);

export const quoteItems = sqliteTable("quote_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  quoteId: integer("quote_id").notNull().references(() => quotes.id),
  category: text("category", { enum: ["hardware", "software", "service"] }).notNull(),
  description: text("description").notNull(),
  quantity: real("quantity").notNull().default(1),
  unitCost: real("unit_cost").notNull().default(0),
  markupPercent: real("markup_percent").notNull().default(0),
  unitPrice: real("unit_price").notNull().default(0),
  billing: text("billing", { enum: ["one_time", "monthly"] }).notNull().default("one_time"),
}, table => [index("idx_quote_items_quote_id").on(table.quoteId)]);
