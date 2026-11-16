CREATE TABLE `group_emails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`email` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_emails_uq` ON `group_emails` (`group_id`,`email`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session_roster` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`email` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_roster_uq` ON `session_roster` (`session_id`,`email`);--> statement-breakpoint
ALTER TABLE `participants` ADD `email` text;--> statement-breakpoint
CREATE UNIQUE INDEX `participants_session_email_uq` ON `participants` (`session_id`,`email`) WHERE "participants"."status" != 'kicked' and "participants"."email" is not null;--> statement-breakpoint
ALTER TABLE `sessions` ADD `access` text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `outsider_policy` text DEFAULT 'block' NOT NULL;--> statement-breakpoint
-- drizzle-kit drops the ON DELETE action on ADD COLUMN; without it, deleting a group that sessions were created from would fail.
ALTER TABLE `sessions` ADD `source_group_id` integer REFERENCES groups(id) ON DELETE set null;