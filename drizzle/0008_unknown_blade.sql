CREATE TABLE `quotes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client` text NOT NULL,
	`description` text NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`rate` real DEFAULT 0 NOT NULL,
	`expires_on` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_quotes_status` ON `quotes` (`status`);--> statement-breakpoint
CREATE INDEX `idx_quotes_client` ON `quotes` (`client`);