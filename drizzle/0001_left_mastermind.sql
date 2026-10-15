CREATE TABLE `cemag_external_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cidade` varchar(120) NOT NULL,
	`uf` varchar(2),
	`payload` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`schedule_cron_task_uid` varchar(65),
	CONSTRAINT `cemag_external_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `cemag_external_city_uf_idx` UNIQUE(`cidade`,`uf`)
);
