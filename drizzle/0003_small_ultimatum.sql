CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ninjaone_id` integer,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`hourly_rate` real DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`synced_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_clients_ninjaone_id` ON `clients` (`ninjaone_id`);