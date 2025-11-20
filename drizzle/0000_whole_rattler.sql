CREATE TABLE `capacity_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`year_month` text NOT NULL,
	`capacity` real NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `capacity_overrides_team_id_idx` ON `capacity_overrides` (`team_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `capacity_overrides_team_month_unique` ON `capacity_overrides` (`team_id`,`year_month`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`monthly_capacity` real NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `work_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`size_in_person_months` real NOT NULL,
	`priority` integer NOT NULL,
	`assigned_team_id` text,
	`scheduled_position` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`assigned_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `work_packages_assigned_team_idx` ON `work_packages` (`assigned_team_id`);--> statement-breakpoint
CREATE INDEX `work_packages_priority_idx` ON `work_packages` (`priority`);