CREATE TABLE `time_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`client` text NOT NULL,
	`project` text NOT NULL,
	`description` text NOT NULL,
	`hours` real NOT NULL,
	`rate` real NOT NULL,
	`billable` integer DEFAULT true NOT NULL
);
