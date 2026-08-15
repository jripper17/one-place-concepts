CREATE INDEX `idx_project_tasks_project_id` ON `project_tasks` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_project_tasks_assignee` ON `project_tasks` (`assignee_user_id`);