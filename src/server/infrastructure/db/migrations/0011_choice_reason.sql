ALTER TABLE `answers` ADD `reason_text` text;--> statement-breakpoint
ALTER TABLE `questions` ADD `require_reason` integer DEFAULT false NOT NULL;