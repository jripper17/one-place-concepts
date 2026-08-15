CREATE TABLE `business_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`federal_tax_rate` real DEFAULT 25 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `clients` ADD `monthly_recurring_revenue` real DEFAULT 0 NOT NULL;