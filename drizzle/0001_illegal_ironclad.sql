CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chipId` int NOT NULL,
	`actionType` enum('message_sent','image_sent','audio_sent','reaction_sent','message_received','connection','disconnection','error') NOT NULL,
	`targetNumber` varchar(20),
	`targetGroup` varchar(255),
	`messageContent` text,
	`status` enum('success','failed','pending') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maturation_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`profileName` enum('suave','normal','ultra') NOT NULL,
	`minMessageDelay` int NOT NULL DEFAULT 5000,
	`maxMessageDelay` int NOT NULL DEFAULT 15000,
	`messageFrequencyPerDay` int NOT NULL DEFAULT 10,
	`typingIndicatorDuration` int NOT NULL DEFAULT 2000,
	`audioSimulationDuration` int NOT NULL DEFAULT 3000,
	`reactionProbability` int NOT NULL DEFAULT 30,
	`imageSendProbability` int NOT NULL DEFAULT 20,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maturation_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`taskName` varchar(255) NOT NULL,
	`targetType` enum('group','number','list') NOT NULL,
	`targetData` text NOT NULL,
	`messageTemplate` text,
	`scheduleCron` varchar(100),
	`scheduleTime` varchar(50),
	`intervalSeconds` int NOT NULL DEFAULT 5,
	`isActive` int NOT NULL DEFAULT 1,
	`scheduleCronTaskUid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduled_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_chips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipName` varchar(255) NOT NULL,
	`phoneNumber` varchar(20),
	`status` enum('conectado','maturando','desconectado') NOT NULL DEFAULT 'desconectado',
	`maturationProfile` enum('suave','normal','ultra') NOT NULL DEFAULT 'normal',
	`sessionData` text,
	`qrCode` text,
	`isPaused` int NOT NULL DEFAULT 0,
	`lastActivity` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsapp_chips_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maturation_profiles` ADD CONSTRAINT `maturation_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scheduled_tasks` ADD CONSTRAINT `scheduled_tasks_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scheduled_tasks` ADD CONSTRAINT `scheduled_tasks_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_chips` ADD CONSTRAINT `whatsapp_chips_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;