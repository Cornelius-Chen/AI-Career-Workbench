CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`company_group` text NOT NULL,
	`status` text NOT NULL,
	`resume_id` text,
	`lease` text,
	`lease_until` text,
	`updated` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applications_job` ON `applications` (`job_id`);--> statement-breakpoint
CREATE INDEX `applications_status` ON `applications` (`status`);--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`day` text NOT NULL,
	`company_group` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempts_application` ON `attempts` (`application_id`);--> statement-breakpoint
CREATE INDEX `attempts_day` ON `attempts` (`day`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text,
	`source_key` text NOT NULL,
	`occurred` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_source` ON `events` (`source_key`);--> statement-breakpoint
CREATE TABLE `facts` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`created` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical` text NOT NULL,
	`data` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_canonical` ON `jobs` (`canonical`);--> statement-breakpoint
CREATE TABLE `resumes` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`created` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`created` text NOT NULL,
	`data` text NOT NULL
);
