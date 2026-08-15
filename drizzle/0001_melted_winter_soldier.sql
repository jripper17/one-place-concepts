CREATE TABLE `team_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_team_members_user_id` ON `team_members` (`user_id`);--> statement-breakpoint
ALTER TABLE `time_entries` ADD `user_id` text DEFAULT 'legacy' NOT NULL;