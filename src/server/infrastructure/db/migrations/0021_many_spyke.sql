CREATE TABLE `training_example_drafts` (
	`event_id` integer PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`label` text,
	`topic` text,
	`comment` text,
	`better_prompt` text,
	`suspicious` integer DEFAULT false NOT NULL,
	`suspicious_reason` text,
	`suspicious_quote` text,
	`sample_count` integer,
	`error` text,
	`seen_at` integer,
	`created_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`event_id`) REFERENCES `training_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `training_teaching_examples` ADD `ai_draft` text;--> statement-breakpoint
ALTER TABLE `training_teaching_examples` ADD `origin` text DEFAULT 'mentor' NOT NULL;