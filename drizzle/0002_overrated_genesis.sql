CREATE TABLE `team_agent_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by_email` text NOT NULL,
	`assigned_to_email` text,
	`title` text NOT NULL,
	`details` text NOT NULL,
	`status` text NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `team_agent_tasks_status` ON `team_agent_tasks` (`status`,`updated`);--> statement-breakpoint
CREATE TABLE `team_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`member_email` text NOT NULL,
	`author_kind` text NOT NULL,
	`content` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `team_messages_created` ON `team_messages` (`created`);--> statement-breakpoint
ALTER TABLE `team_recommendations` ADD `location` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `team_recommendations` ADD `lane` text DEFAULT '' NOT NULL;