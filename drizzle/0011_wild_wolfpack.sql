CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%d %H:%M:%S.000+00', 'now')),
	`value` text NOT NULL
);
