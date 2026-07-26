CREATE TABLE `subscription_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planName` varchar(100) NOT NULL,
	`description` text,
	`maxChips` int NOT NULL,
	`maxMessagesPerMonth` int NOT NULL,
	`maxScheduledTasks` int NOT NULL,
	`priceMonthly` int NOT NULL,
	`priceYearly` int,
	`features` text,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscription_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscription_plans_planName_unique` UNIQUE(`planName`)
);
--> statement-breakpoint
CREATE TABLE `user_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planId` int NOT NULL,
	`status` enum('active','cancelled','expired','trial') NOT NULL DEFAULT 'trial',
	`currentChipsCount` int NOT NULL DEFAULT 0,
	`currentMessagesThisMonth` int NOT NULL DEFAULT 0,
	`currentTasksCount` int NOT NULL DEFAULT 0,
	`subscriptionStartDate` timestamp NOT NULL DEFAULT (now()),
	`subscriptionEndDate` timestamp,
	`trialEndDate` timestamp,
	`autoRenew` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_subscriptions_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `activity_logs` ADD `userId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_planId_subscription_plans_id_fk` FOREIGN KEY (`planId`) REFERENCES `subscription_plans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;