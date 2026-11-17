ALTER TABLE `sessions` ADD `score_visibility` text DEFAULT 'on_submit' NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `scores_released_at` integer;