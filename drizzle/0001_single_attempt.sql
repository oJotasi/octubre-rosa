CREATE TABLE `attempt_claims` (
	`participant_key` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempt_claims_session_id_unique` ON `attempt_claims` (`session_id`);