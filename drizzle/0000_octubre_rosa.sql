CREATE TABLE `game_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`question_set_version` text NOT NULL,
	`questions` text NOT NULL,
	`answer_0` integer,
	`answer_1` integer,
	`answer_2` integer,
	`correct_count` integer,
	`is_correct` integer,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`completed_at` integer,
	CONSTRAINT "valid_correct_count" CHECK("game_sessions"."correct_count" between 0 and 3),
	CONSTRAINT "valid_result" CHECK(("game_sessions"."completed_at" is null and "game_sessions"."correct_count" is null and "game_sessions"."is_correct" is null) or ("game_sessions"."completed_at" is not null and "game_sessions"."correct_count" is not null and "game_sessions"."is_correct" = ("game_sessions"."correct_count" = 3)))
);
--> statement-breakpoint
CREATE INDEX `completed_sessions_idx` ON `game_sessions` (`completed_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL
);
