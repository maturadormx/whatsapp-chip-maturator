CREATE TABLE `admin_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminUserId` int NOT NULL,
	`targetUserId` int,
	`entity` varchar(60) NOT NULL,
	`action` varchar(80) NOT NULL,
	`payload` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `execution_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`targetType` enum('number','group','list','chip') NOT NULL,
	`targetValue` varchar(255) NOT NULL,
	`actionType` enum('message','reaction') NOT NULL,
	`attemptOrder` int NOT NULL DEFAULT 1,
	`messageContent` text,
	`providerMessageId` varchar(128),
	`status` enum('pending','success','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`executedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `execution_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `execution_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`executionType` enum('dispatch','maturation') NOT NULL,
	`targetType` enum('number','group','list','chip') NOT NULL,
	`status` enum('pending','running','completed','failed','partial') NOT NULL DEFAULT 'pending',
	`templateId` int,
	`profileName` enum('suave','normal','ultra') NOT NULL DEFAULT 'normal',
	`totalTargets` int NOT NULL DEFAULT 0,
	`plannedMessages` int NOT NULL DEFAULT 0,
	`totalMessagesSent` int NOT NULL DEFAULT 0,
	`successCount` int NOT NULL DEFAULT 0,
	`failureCount` int NOT NULL DEFAULT 0,
	`payload` text,
	`errorMessage` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `execution_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maturation_targets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`targetName` varchar(150) NOT NULL,
	`targetType` enum('number','group','chip') NOT NULL,
	`targetValue` varchar(255) NOT NULL,
	`notes` text,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maturation_targets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `message_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`templateName` varchar(150) NOT NULL,
	`category` enum('dispatch','maturation','general') NOT NULL DEFAULT 'general',
	`content` text NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `message_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `profileImageUrl` mediumtext;--> statement-breakpoint
ALTER TABLE `admin_audit_logs` ADD CONSTRAINT `admin_audit_logs_adminUserId_users_id_fk` FOREIGN KEY (`adminUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_audit_logs` ADD CONSTRAINT `admin_audit_logs_targetUserId_users_id_fk` FOREIGN KEY (`targetUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `execution_attempts` ADD CONSTRAINT `execution_attempts_jobId_execution_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `execution_jobs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `execution_attempts` ADD CONSTRAINT `execution_attempts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `execution_attempts` ADD CONSTRAINT `execution_attempts_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `execution_jobs` ADD CONSTRAINT `execution_jobs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `execution_jobs` ADD CONSTRAINT `execution_jobs_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maturation_targets` ADD CONSTRAINT `maturation_targets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `message_templates` ADD CONSTRAINT `message_templates_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;