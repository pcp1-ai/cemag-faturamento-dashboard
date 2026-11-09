CREATE TABLE `cemag_analytic_bases` (
	`id` int NOT NULL,
	`version` varchar(180) NOT NULL,
	`source_storage_key` varchar(512) NOT NULL,
	`source_file_name` varchar(255) NOT NULL,
	`status` enum('processing','ready','error') NOT NULL,
	`row_count` int NOT NULL DEFAULT 0,
	`dimensions` text NOT NULL,
	`data_inicio` varchar(32),
	`data_fim` varchar(32),
	`error_message` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cemag_analytic_bases_id` PRIMARY KEY(`id`),
	CONSTRAINT `cemag_analytic_bases_version_unique` UNIQUE(`version`)
);
--> statement-breakpoint
CREATE TABLE `cemag_analytic_rows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`base_version` varchar(180) NOT NULL,
	`row_number` int NOT NULL,
	`payload` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cemag_analytic_rows_id` PRIMARY KEY(`id`),
	CONSTRAINT `cemag_analytic_base_row_idx` UNIQUE(`base_version`,`row_number`)
);
