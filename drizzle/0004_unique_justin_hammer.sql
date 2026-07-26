CREATE TABLE `behavior_action_execution` (
	`id` varchar(64) NOT NULL,
	`decisionId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`requestedAction` varchar(64) NOT NULL,
	`targetType` enum('number','group','list','chip') NOT NULL,
	`targetValue` varchar(255) NOT NULL,
	`messageId` varchar(128),
	`status` enum('PENDING','SENDING','ACKED','FAILED','RETRYING') NOT NULL DEFAULT 'PENDING',
	`budgetState` enum('NOT_RESERVED','RESERVED','COMMITTED','RELEASED') NOT NULL DEFAULT 'NOT_RESERVED',
	`attempt` int NOT NULL DEFAULT 1,
	`recoverable` int NOT NULL DEFAULT 1,
	`maxAttempts` int NOT NULL DEFAULT 3,
	`nextRetryAt` timestamp,
	`lastRetryAt` timestamp,
	`payload` text,
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`sentAt` timestamp,
	`ackAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `behavior_action_execution_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `behavior_budget_reservations` (
	`id` varchar(64) NOT NULL,
	`executionId` varchar(64) NOT NULL,
	`attempt` int NOT NULL,
	`userId` int NOT NULL,
	`amount` int NOT NULL,
	`status` enum('RESERVED','COMMITTED','RELEASED') NOT NULL DEFAULT 'RESERVED',
	`reason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`committedAt` timestamp,
	`releasedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `behavior_budget_reservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_behavior_budget_execution_attempt` UNIQUE(`executionId`,`attempt`)
);
--> statement-breakpoint
CREATE TABLE `behavior_decision_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`phase` varchar(32) NOT NULL,
	`trustScore` int,
	`riskScore` int,
	`dailyBudgetUsed` int NOT NULL DEFAULT 0,
	`dailyBudgetTotal` int NOT NULL DEFAULT 0,
	`sessionId` varchar(191),
	`requestedAction` varchar(64) NOT NULL,
	`decision` varchar(32) NOT NULL,
	`reason` text NOT NULL,
	`delayMs` int,
	`nextCheckAt` timestamp,
	`engineVersion` varchar(64) NOT NULL,
	`policyFingerprint` varchar(128),
	`checksJson` mediumtext,
	`contributorsJson` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `behavior_decision_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `behavior_memory_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`windowStart` timestamp NOT NULL,
	`windowEnd` timestamp NOT NULL,
	`sampleDays` int NOT NULL DEFAULT 1,
	`firstActionAt` timestamp,
	`lastActionAt` timestamp,
	`totalActions` int NOT NULL DEFAULT 0,
	`distinctActionTypes` int NOT NULL DEFAULT 0,
	`repetitionScore` int NOT NULL DEFAULT 0,
	`variationScore` int NOT NULL DEFAULT 0,
	`actionSequence` text,
	`activeHourBuckets` text,
	`responseDelayBuckets` text,
	`idleWindows` text,
	`patternSignature` varchar(255),
	`payload` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `behavior_memory_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `behavior_opportunity_observations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`opportunityId` varchar(128) NOT NULL,
	`observedAt` timestamp NOT NULL DEFAULT (now()),
	`reason` text NOT NULL,
	`riskAtDecision` int NOT NULL DEFAULT 0,
	`confidence` int NOT NULL DEFAULT 0,
	`expectedGain` int NOT NULL DEFAULT 0,
	`expectedRisk` int NOT NULL DEFAULT 0,
	`decision` enum('ACT_NOW','WAIT','DO_NOTHING') NOT NULL DEFAULT 'DO_NOTHING',
	`observedResultAfter24h` text,
	`observedResultAfter72h` text,
	`observedResultAfter7d` text,
	`payload` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `behavior_opportunity_observations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `behavior_outcomes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`observationWindowStart` timestamp NOT NULL,
	`observationWindowEnd` timestamp NOT NULL,
	`predictedRisk` int NOT NULL DEFAULT 0,
	`predictedCredibility` int NOT NULL DEFAULT 0,
	`actualOutcome` enum('unknown','healthy','warning','restriction','ban') NOT NULL DEFAULT 'unknown',
	`restrictionOccurred` int NOT NULL DEFAULT 0,
	`warningOccurred` int NOT NULL DEFAULT 0,
	`banOccurred` int NOT NULL DEFAULT 0,
	`humanLikeOutcome` enum('unknown','human_like','not_human_like','uncertain') NOT NULL DEFAULT 'unknown',
	`validatedAt` timestamp,
	`payload` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `behavior_outcomes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `behavior_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`phase` varchar(32) NOT NULL,
	`trustScore` int,
	`riskScore` int,
	`dailyBudgetUsed` int NOT NULL DEFAULT 0,
	`dailyBudgetTotal` int NOT NULL DEFAULT 0,
	`inboundCount` int NOT NULL DEFAULT 0,
	`outboundCount` int NOT NULL DEFAULT 0,
	`sessionId` varchar(191),
	`lastDecision` varchar(32),
	`lastReason` text,
	`nextCheckAt` timestamp,
	`engineVersion` varchar(64) NOT NULL,
	`policyFingerprint` varchar(128),
	`snapshotJson` mediumtext,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `behavior_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `behavior_snapshots_chipId_unique` UNIQUE(`chipId`)
);
--> statement-breakpoint
CREATE TABLE `behavior_timeline_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`source` varchar(64) NOT NULL,
	`direction` varchar(20),
	`remoteJid` varchar(255),
	`remoteType` varchar(20),
	`remoteLabel` varchar(255),
	`messageId` varchar(128),
	`relatedMessageId` varchar(128),
	`ackType` varchar(64),
	`groupJid` varchar(255),
	`groupSubject` varchar(255),
	`contentPreview` text,
	`payload` mediumtext,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `behavior_timeline_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chip_audit_evidences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evidenceId` varchar(191) NOT NULL,
	`chipId` varchar(191) NOT NULL,
	`evidenceType` varchar(64) NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`payload` mediumtext NOT NULL,
	CONSTRAINT `chip_audit_evidences_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_chip_audit_evidences_evidenceId` UNIQUE(`evidenceId`)
);
--> statement-breakpoint
CREATE TABLE `chip_behavior_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`humanScore` int NOT NULL DEFAULT 0,
	`riskScore` int NOT NULL DEFAULT 100,
	`evidenceQuality` int NOT NULL DEFAULT 0,
	`evidenceCoverage` int NOT NULL DEFAULT 0,
	`evidenceNaturalness` int NOT NULL DEFAULT 0,
	`evidenceDiversity` int NOT NULL DEFAULT 0,
	`evidenceConsistency` int NOT NULL DEFAULT 0,
	`evidenceSocialPresence` int NOT NULL DEFAULT 0,
	`evidenceCoverageDetail` mediumtext,
	`sentCount` int NOT NULL DEFAULT 0,
	`receivedCount` int NOT NULL DEFAULT 0,
	`groupJoinCount` int NOT NULL DEFAULT 0,
	`readCount` int NOT NULL DEFAULT 0,
	`distinctConversations` int NOT NULL DEFAULT 0,
	`activeMinutes` int NOT NULL DEFAULT 0,
	`idleMinutes` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chip_behavior_scores_id` PRIMARY KEY(`id`),
	CONSTRAINT `chip_behavior_scores_chipId_unique` UNIQUE(`chipId`)
);
--> statement-breakpoint
CREATE TABLE `chip_certifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`status` enum('NOVO','EM_MATURACAO','EM_OBSERVACAO','APROVADO','RESTRITO','REPROVADO') NOT NULL DEFAULT 'NOVO',
	`usable` int NOT NULL DEFAULT 0,
	`reason` text,
	`approvedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chip_certifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `chip_certifications_chipId_unique` UNIQUE(`chipId`)
);
--> statement-breakpoint
CREATE TABLE `chip_event_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(191) NOT NULL,
	`chipId` varchar(191) NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`eventVersion` int NOT NULL,
	`sequence` int NOT NULL,
	`occurredAt` timestamp NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`payload` mediumtext NOT NULL,
	`metadata` mediumtext,
	CONSTRAINT `chip_event_history_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_chip_event_history_eventId` UNIQUE(`eventId`),
	CONSTRAINT `ux_chip_event_history_chipId_sequence` UNIQUE(`chipId`,`sequence`)
);
--> statement-breakpoint
CREATE TABLE `chip_health` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`healthScore` int NOT NULL DEFAULT 0,
	`reconnectCount` int NOT NULL DEFAULT 0,
	`disconnectCount` int NOT NULL DEFAULT 0,
	`lastDisconnect` timestamp,
	`sessionAge` int NOT NULL DEFAULT 0,
	`lastReceive` timestamp,
	`lastSend` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chip_health_id` PRIMARY KEY(`id`),
	CONSTRAINT `chip_health_chipId_unique` UNIQUE(`chipId`)
);
--> statement-breakpoint
CREATE TABLE `chip_state_projections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chipId` varchar(191) NOT NULL,
	`currentState` varchar(64),
	`previousState` varchar(64),
	`lastSequence` int,
	`inconsistencyCount` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chip_state_projections_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_chip_state_projections_chipId` UNIQUE(`chipId`)
);
--> statement-breakpoint
CREATE TABLE `chip_worker_checkpoints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workerName` varchar(120) NOT NULL,
	`lastOffset` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chip_worker_checkpoints_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_chip_worker_checkpoints_workerName` UNIQUE(`workerName`)
);
--> statement-breakpoint
CREATE TABLE `fleet_knowledge_promotions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sourcePatternKey` varchar(191) NOT NULL,
	`targetKnowledgeKey` varchar(191) NOT NULL,
	`action` enum('observe','promote','revalidate','retire') NOT NULL,
	`observedAt` timestamp NOT NULL DEFAULT (now()),
	`payload` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fleet_knowledge_promotions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fleet_learning_cohorts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`cohortKey` varchar(191) NOT NULL,
	`status` enum('emerging','stable','elite','critical') NOT NULL DEFAULT 'emerging',
	`title` varchar(255) NOT NULL,
	`chipCount` int NOT NULL DEFAULT 0,
	`averageSuccessRate` int NOT NULL DEFAULT 0,
	`averageRiskScore` int NOT NULL DEFAULT 0,
	`averageCredibilityScore` int NOT NULL DEFAULT 0,
	`lastComputedAt` timestamp,
	`payload` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fleet_learning_cohorts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fleet_learning_patterns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`patternKey` varchar(191) NOT NULL,
	`cohortKey` varchar(191) NOT NULL,
	`status` enum('candidate','promoted','active','retired') NOT NULL DEFAULT 'candidate',
	`title` varchar(255) NOT NULL,
	`confidence` int NOT NULL DEFAULT 0,
	`sampleSize` int NOT NULL DEFAULT 0,
	`successRate` int NOT NULL DEFAULT 0,
	`riskScore` int NOT NULL DEFAULT 0,
	`recommendationType` varchar(120) NOT NULL,
	`lastValidatedAt` timestamp,
	`payload` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fleet_learning_patterns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_base_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`knowledgeKey` varchar(191) NOT NULL,
	`sourceHypothesisKey` varchar(191),
	`status` enum('candidate','active','decaying','retired','archived') NOT NULL DEFAULT 'candidate',
	`title` varchar(255) NOT NULL,
	`confidence` int NOT NULL DEFAULT 0,
	`usageCount` int NOT NULL DEFAULT 0,
	`successRate` int NOT NULL DEFAULT 0,
	`decayRate` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp,
	`lastValidatedAt` timestamp,
	`payload` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledge_base_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `learning_engine_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int,
	`eventType` enum('observed','validated','promoted','revalidated','retired','contradicted') NOT NULL,
	`referenceKey` varchar(191) NOT NULL,
	`observedAt` timestamp NOT NULL DEFAULT (now()),
	`payload` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `learning_engine_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `learning_hypotheses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`hypothesisKey` varchar(191) NOT NULL,
	`status` enum('draft','candidate','validated','knowledge','deprecated','archived') NOT NULL DEFAULT 'draft',
	`title` varchar(255) NOT NULL,
	`confidence` int NOT NULL DEFAULT 0,
	`sampleSize` int NOT NULL DEFAULT 0,
	`successRate` int NOT NULL DEFAULT 0,
	`contradictionRate` int NOT NULL DEFAULT 0,
	`temporalStability` int NOT NULL DEFAULT 0,
	`segmentConsistency` int NOT NULL DEFAULT 0,
	`lastValidatedAt` timestamp,
	`payload` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `learning_hypotheses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maturation_experience_journal` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`chapterId` varchar(128) NOT NULL,
	`chapterType` enum('snapshot','opportunity','recovery','silence') NOT NULL DEFAULT 'snapshot',
	`observedAt` timestamp NOT NULL DEFAULT (now()),
	`contextHash` varchar(128),
	`strategyChosen` varchar(128),
	`actionTaken` varchar(128),
	`riskBefore` int NOT NULL DEFAULT 0,
	`riskAfter` int NOT NULL DEFAULT 0,
	`credibilityBefore` int NOT NULL DEFAULT 0,
	`credibilityAfter` int NOT NULL DEFAULT 0,
	`outcome24h` text,
	`outcome72h` text,
	`outcome7d` text,
	`payload` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maturation_experience_journal_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `observation_runtime_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stream` varchar(191) NOT NULL,
	`version` int NOT NULL,
	`type` varchar(120) NOT NULL,
	`occurredAt` varchar(64) NOT NULL,
	`payload` mediumtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `observation_runtime_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `observation_runtime_events_stream_version_uidx` UNIQUE(`stream`,`version`)
);
--> statement-breakpoint
CREATE TABLE `observation_runtime_records` (
	`id` varchar(191) NOT NULL,
	`source` varchar(120) NOT NULL,
	`eventType` varchar(191) NOT NULL,
	`payload` mediumtext NOT NULL,
	`timestamp` varchar(64) NOT NULL,
	`correlationId` varchar(191),
	`processingStatus` enum('PENDING','PROCESSING','PROCESSED','FAILED') NOT NULL DEFAULT 'PENDING',
	`claimedBy` varchar(191),
	`claimedAt` timestamp,
	`leaseExpiresAt` timestamp,
	`processedAt` timestamp,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `observation_runtime_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `relationship_memories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`counterpartKey` varchar(191) NOT NULL,
	`counterpartType` enum('contact','group','unknown') NOT NULL DEFAULT 'unknown',
	`stage` enum('unknown','known','trust','recurring','inactive') NOT NULL DEFAULT 'unknown',
	`firstInteractionAt` timestamp,
	`lastInteractionAt` timestamp,
	`trustScore` int NOT NULL DEFAULT 0,
	`relationshipRisk` int NOT NULL DEFAULT 0,
	`idealContactFrequencyHours` int NOT NULL DEFAULT 0,
	`payload` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `relationship_memories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `behavior_action_execution` ADD CONSTRAINT `behavior_action_execution_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `behavior_action_execution` ADD CONSTRAINT `behavior_action_execution_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `behavior_budget_reservations` ADD CONSTRAINT `behavior_budget_reservations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `behavior_decision_log` ADD CONSTRAINT `behavior_decision_log_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `behavior_decision_log` ADD CONSTRAINT `behavior_decision_log_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `behavior_memory_snapshots` ADD CONSTRAINT `behavior_memory_snapshots_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `behavior_memory_snapshots` ADD CONSTRAINT `behavior_memory_snapshots_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `behavior_opportunity_observations` ADD CONSTRAINT `behavior_opportunity_observations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `behavior_opportunity_observations` ADD CONSTRAINT `behavior_opportunity_observations_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `behavior_outcomes` ADD CONSTRAINT `behavior_outcomes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `behavior_outcomes` ADD CONSTRAINT `behavior_outcomes_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `behavior_snapshots` ADD CONSTRAINT `behavior_snapshots_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `behavior_snapshots` ADD CONSTRAINT `behavior_snapshots_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `behavior_timeline_events` ADD CONSTRAINT `behavior_timeline_events_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `behavior_timeline_events` ADD CONSTRAINT `behavior_timeline_events_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_behavior_scores` ADD CONSTRAINT `chip_behavior_scores_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_behavior_scores` ADD CONSTRAINT `chip_behavior_scores_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_certifications` ADD CONSTRAINT `chip_certifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_certifications` ADD CONSTRAINT `chip_certifications_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_health` ADD CONSTRAINT `chip_health_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_health` ADD CONSTRAINT `chip_health_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fleet_knowledge_promotions` ADD CONSTRAINT `fleet_knowledge_promotions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fleet_learning_cohorts` ADD CONSTRAINT `fleet_learning_cohorts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fleet_learning_patterns` ADD CONSTRAINT `fleet_learning_patterns_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `knowledge_base_items` ADD CONSTRAINT `knowledge_base_items_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learning_engine_events` ADD CONSTRAINT `learning_engine_events_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learning_engine_events` ADD CONSTRAINT `learning_engine_events_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learning_hypotheses` ADD CONSTRAINT `learning_hypotheses_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maturation_experience_journal` ADD CONSTRAINT `maturation_experience_journal_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maturation_experience_journal` ADD CONSTRAINT `maturation_experience_journal_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `relationship_memories` ADD CONSTRAINT `relationship_memories_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `relationship_memories` ADD CONSTRAINT `relationship_memories_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ix_behavior_budget_user_status_created` ON `behavior_budget_reservations` (`userId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ix_behavior_decision_log_chipId_createdAt` ON `behavior_decision_log` (`chipId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ix_behavior_decision_log_createdAt` ON `behavior_decision_log` (`createdAt`);--> statement-breakpoint
CREATE INDEX `ix_chip_audit_evidences_chipId_recordedAt` ON `chip_audit_evidences` (`chipId`,`recordedAt`);--> statement-breakpoint
CREATE INDEX `ix_chip_event_history_chipId_sequence` ON `chip_event_history` (`chipId`,`sequence`);--> statement-breakpoint
CREATE INDEX `observation_runtime_events_stream_idx` ON `observation_runtime_events` (`stream`);--> statement-breakpoint
CREATE INDEX `observation_runtime_records_status_idx` ON `observation_runtime_records` (`processingStatus`);--> statement-breakpoint
CREATE INDEX `observation_runtime_records_claimed_by_idx` ON `observation_runtime_records` (`claimedBy`);--> statement-breakpoint
CREATE INDEX `observation_runtime_records_correlation_idx` ON `observation_runtime_records` (`correlationId`);--> statement-breakpoint
CREATE INDEX `observation_runtime_records_lease_idx` ON `observation_runtime_records` (`leaseExpiresAt`);