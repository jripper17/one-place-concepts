CREATE TABLE `project_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`assignee_user_id` text NOT NULL,
	`estimated_hours` real DEFAULT 0 NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client` text NOT NULL,
	`name` text NOT NULL,
	`budget_hours` real DEFAULT 0 NOT NULL,
	`start_date` text NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
