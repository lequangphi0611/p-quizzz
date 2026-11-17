ALTER TABLE `sessions` ADD `name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `slot` integer;
--> statement-breakpoint
-- Hand-written backfill (drizzle-kit does not generate data changes): older sessions are named after their exam,
-- and the one session that may have been open under the old "single active session" rule takes slot 1.
UPDATE `sessions` SET `name` = (SELECT `title` FROM `exams` WHERE `exams`.`id` = `sessions`.`exam_id`) WHERE `name` = '';
--> statement-breakpoint
UPDATE `sessions` SET `slot` = 1 WHERE `status` IN ('lobby', 'running');
