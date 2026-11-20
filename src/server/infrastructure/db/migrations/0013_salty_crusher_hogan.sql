CREATE TABLE `training_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` integer NOT NULL,
	`kind` text NOT NULL,
	`claude_session_id` text NOT NULL,
	`received_at` integer NOT NULL,
	`prompt` text,
	`tool_name` text,
	`tool_target` text,
	`ok` integer,
	`duration_ms` integer,
	`error_excerpt` text,
	`output_head` text,
	`output_tail` text,
	`output_omitted_lines` integer,
	`change_head` text,
	`change_tail` text,
	`change_omitted_lines` integer,
	FOREIGN KEY (`member_id`) REFERENCES `training_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `training_events_member_idx` ON `training_events` (`member_id`,`id`);--> statement-breakpoint
CREATE TABLE `training_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`training_id` integer NOT NULL,
	`display_name` text NOT NULL,
	`token` text NOT NULL,
	`ingest_token` text NOT NULL,
	`consented_at` integer NOT NULL,
	`first_seen_at` integer,
	`last_seen_at` integer,
	`seen_after_stop_at` integer,
	`uninstall_check_at` integer,
	`uninstalled_at` integer,
	FOREIGN KEY (`training_id`) REFERENCES `trainings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `training_members_token_unique` ON `training_members` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `training_members_ingest_token_unique` ON `training_members` (`ingest_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `training_members_name_uq` ON `training_members` (`training_id`,lower("display_name"));--> statement-breakpoint
CREATE TABLE `trainings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`room_code` text,
	`created_at` integer NOT NULL,
	`stopped_at` integer,
	`ended_at` integer,
	`member_count` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trainings_room_code_uq` ON `trainings` (`room_code`);