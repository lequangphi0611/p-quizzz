ALTER TABLE `exams` ADD `duration_minutes` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `time_limit_minutes` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `ends_at` integer;