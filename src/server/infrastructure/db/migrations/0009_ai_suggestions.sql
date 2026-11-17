CREATE TABLE `ai_suggestions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`answer_id` integer NOT NULL,
	`status` text NOT NULL,
	`score` real,
	`feedback` text,
	`criteria` text,
	`suspicious` integer DEFAULT false NOT NULL,
	`suspicious_reason` text,
	`suspicious_lines` text,
	`error` text,
	`model` text,
	`used` text,
	`requested_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`answer_id`) REFERENCES `answers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_suggestions_answer_id_unique` ON `ai_suggestions` (`answer_id`);