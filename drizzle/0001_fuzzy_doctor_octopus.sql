CREATE TABLE `team_application_events` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`status` text NOT NULL,
	`details` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `team_application_events_application` ON `team_application_events` (`application_id`);--> statement-breakpoint
CREATE TABLE `team_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`member_email` text NOT NULL,
	`recommendation_id` text NOT NULL,
	`status` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_applications_member_recommendation` ON `team_applications` (`member_email`,`recommendation_id`);--> statement-breakpoint
CREATE INDEX `team_applications_member` ON `team_applications` (`member_email`);--> statement-breakpoint
CREATE TABLE `team_files` (
	`id` text PRIMARY KEY NOT NULL,
	`member_email` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`size` integer NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `team_files_member` ON `team_files` (`member_email`);--> statement-breakpoint
CREATE TABLE `team_members` (
	`email` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`resume_shared` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team_recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`author_email` text NOT NULL,
	`company` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`note` text NOT NULL,
	`coapply` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_recommendations_url` ON `team_recommendations` (`url`);