ALTER TABLE `team_profiles` ADD `target_type` text DEFAULT 'full_time' NOT NULL;--> statement-breakpoint
ALTER TABLE `team_recommendations` ADD `opportunity_type` text DEFAULT 'full_time' NOT NULL;--> statement-breakpoint
ALTER TABLE `team_recommendations` ADD `period` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `team_profiles` SET `target_type`='summer_intern',`start_date`='2027 夏季' WHERE `member_email` IN (SELECT `email` FROM `team_members` WHERE `role`='member');--> statement-breakpoint
INSERT OR IGNORE INTO `team_profiles` (`member_email`,`target_type`,`start_date`,`updated`) SELECT `email`,'summer_intern','2027 夏季',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM `team_members` WHERE `role`='member';
