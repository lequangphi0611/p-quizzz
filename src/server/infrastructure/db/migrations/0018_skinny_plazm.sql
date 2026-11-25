CREATE TABLE `training_teaching_examples` (
	`event_id` integer PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`topic` text DEFAULT 'other' NOT NULL,
	`comment` text NOT NULL,
	`better_prompt` text,
	`edited_prompt` text,
	`edited_context` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `training_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `training_members` ADD `teaching_consent` integer DEFAULT false NOT NULL;
--> statement-breakpoint
-- PO decision (PRODUCT.md §7.39a): members who joined before this column existed count as agreed (the mentor confirmed outside the app).
-- New rows keep the column default (false).
UPDATE `training_members` SET `teaching_consent` = 1;
