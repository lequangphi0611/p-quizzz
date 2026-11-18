ALTER TABLE `participants` ADD `ready_at` integer;--> statement-breakpoint
ALTER TABLE `participants` ADD `present_at_start` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `scheduled_start_at` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `countdown_ends_at` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `countdown_source` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `auto_start_ready` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `ready_min` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `start_schedule_dropped_at` integer;