CREATE TABLE `sudoku_skills` (
	`generosite` integer DEFAULT 2 NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`skill` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%d %H:%M:%S.000+00', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sudoku_skills_skill_idx` ON `sudoku_skills` (`skill`);