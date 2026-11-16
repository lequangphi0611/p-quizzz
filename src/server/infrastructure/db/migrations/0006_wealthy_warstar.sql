CREATE TABLE `rejoin_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` integer NOT NULL,
	`claimant_name` text NOT NULL,
	`token` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rejoin_requests_token_unique` ON `rejoin_requests` (`token`);--> statement-breakpoint
CREATE INDEX `rejoin_requests_participant_idx` ON `rejoin_requests` (`participant_id`,`status`);--> statement-breakpoint
ALTER TABLE `participants` ADD `replaced_token` text;--> statement-breakpoint
ALTER TABLE `participants` ADD `rejoin_allowed_until` integer;