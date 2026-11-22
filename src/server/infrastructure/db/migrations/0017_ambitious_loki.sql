CREATE TABLE `training_event_marks` (
	`event_id` integer PRIMARY KEY NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `training_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `training_members` ADD `mentor_note` text;--> statement-breakpoint
ALTER TABLE `trainings` ADD `report_exported_at` integer;