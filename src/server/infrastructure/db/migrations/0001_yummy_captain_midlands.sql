ALTER TABLE `sessions` ADD `room_code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_room_code_uq` ON `sessions` (`room_code`);