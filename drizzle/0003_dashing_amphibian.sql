CREATE TABLE `team_profiles` (
	`member_email` text PRIMARY KEY NOT NULL,
	`headline` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`focus` text DEFAULT '' NOT NULL,
	`skills` text DEFAULT '' NOT NULL,
	`start_date` text DEFAULT '' NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team_recommendation_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`recommendation_id` text NOT NULL,
	`member_email` text NOT NULL,
	`decision` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_recommendation_decisions_member_job` ON `team_recommendation_decisions` (`member_email`,`recommendation_id`);--> statement-breakpoint
ALTER TABLE `team_recommendations` ADD `source_kind` text DEFAULT 'person' NOT NULL;--> statement-breakpoint
ALTER TABLE `team_recommendations` ADD `target_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `team_recommendations` ADD `evidence` text DEFAULT '' NOT NULL;