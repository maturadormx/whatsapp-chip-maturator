CREATE TABLE IF NOT EXISTS `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
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
CREATE TABLE IF NOT EXISTS `admin_audit_logs` (
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
CREATE TABLE IF NOT EXISTS `audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`chipId` int,
	`engine` varchar(120) NOT NULL,
	`action` varchar(120) NOT NULL,
	`entityType` varchar(80),
	`entityId` varchar(191),
	`beforeState` mediumtext,
	`afterState` mediumtext,
	`result` enum('success','failed','skipped') NOT NULL DEFAULT 'success',
	`errorMessage` text,
	`durationMs` int,
	`workerId` varchar(191),
	`payload` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `behavior_action_execution` (
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
CREATE TABLE IF NOT EXISTS `behavior_budget_reservations` (
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
CREATE TABLE IF NOT EXISTS `behavior_decision_log` (
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
CREATE TABLE IF NOT EXISTS `behavior_memory_snapshots` (
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
CREATE TABLE IF NOT EXISTS `behavior_opportunity_observations` (
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
CREATE TABLE IF NOT EXISTS `behavior_outcomes` (
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
CREATE TABLE IF NOT EXISTS `behavior_snapshots` (
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
CREATE TABLE IF NOT EXISTS `behavior_timeline_events` (
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
CREATE TABLE IF NOT EXISTS `chip_audit_evidences` (
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
CREATE TABLE IF NOT EXISTS `chip_behavior_scores` (
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
CREATE TABLE IF NOT EXISTS `chip_certification_state` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`maturityLevel` int NOT NULL DEFAULT 0,
	`maturityLabel` varchar(60) NOT NULL DEFAULT 'Nível 0 - Novo',
	`decision` enum('APPROVED','BLOCKED') NOT NULL DEFAULT 'BLOCKED',
	`humanScore` int NOT NULL DEFAULT 0,
	`socialScore` int NOT NULL DEFAULT 0,
	`routineScore` int NOT NULL DEFAULT 0,
	`trustScore` int NOT NULL DEFAULT 0,
	`spamRisk` int NOT NULL DEFAULT 0,
	`banRisk` int NOT NULL DEFAULT 0,
	`payload` mediumtext,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chip_certification_state_id` PRIMARY KEY(`id`),
	CONSTRAINT `chip_certification_state_chipId_unique` UNIQUE(`chipId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chip_certifications` (
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
CREATE TABLE IF NOT EXISTS `chip_event_history` (
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
CREATE TABLE IF NOT EXISTS `chip_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`groupJid` varchar(255) NOT NULL,
	`groupName` varchar(255),
	`origin` enum('internal','manual_invite','catalog','runtime_discovery') NOT NULL DEFAULT 'runtime_discovery',
	`category` varchar(120),
	`joinedAt` timestamp,
	`leftAt` timestamp,
	`lastInteraction` timestamp,
	`role` varchar(40) NOT NULL DEFAULT 'member',
	`status` enum('candidate','joined','left','blocked') NOT NULL DEFAULT 'candidate',
	`inviteLink` text,
	`risk` int NOT NULL DEFAULT 0,
	`payload` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chip_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chip_health` (
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
CREATE TABLE IF NOT EXISTS `chip_identity_evolution` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`generation` int NOT NULL DEFAULT 1,
	`lastNameChangeAt` timestamp,
	`lastAboutChangeAt` timestamp,
	`lastPhotoChangeAt` timestamp,
	`currentDisplayName` varchar(120),
	`currentAbout` text,
	`currentPhotoAsset` varchar(255),
	`payload` mediumtext,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chip_identity_evolution_id` PRIMARY KEY(`id`),
	CONSTRAINT `chip_identity_evolution_chipId_unique` UNIQUE(`chipId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chip_learning_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`actionKey` varchar(100) NOT NULL,
	`successCount` int NOT NULL DEFAULT 0,
	`failureCount` int NOT NULL DEFAULT 0,
	`successRate` int NOT NULL DEFAULT 0,
	`failureRate` int NOT NULL DEFAULT 0,
	`averageResponse` int NOT NULL DEFAULT 0,
	`averageDelay` int NOT NULL DEFAULT 0,
	`payload` mediumtext,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chip_learning_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chip_persona` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chipId` int NOT NULL,
	`displayName` varchar(120) NOT NULL,
	`homeState` varchar(60) NOT NULL,
	`homeCity` varchar(120) NOT NULL,
	`primaryDDD` varchar(4) NOT NULL,
	`secondaryDDDs` text,
	`profession` varchar(120) NOT NULL,
	`ageRange` varchar(40) NOT NULL,
	`socialProfile` varchar(80) NOT NULL,
	`wakeHour` int NOT NULL DEFAULT 8,
	`sleepHour` int NOT NULL DEFAULT 22,
	`weekendProfile` varchar(80) NOT NULL,
	`interests` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chip_persona_id` PRIMARY KEY(`id`),
	CONSTRAINT `chip_persona_chipId_unique` UNIQUE(`chipId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chip_relationships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`contact` varchar(191) NOT NULL,
	`interactions` int NOT NULL DEFAULT 0,
	`lastSeen` timestamp,
	`trustScore` int NOT NULL DEFAULT 0,
	`conversationLevel` int NOT NULL DEFAULT 0,
	`firstInteraction` timestamp,
	`lastInteraction` timestamp,
	`favorite` int NOT NULL DEFAULT 0,
	`payload` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chip_relationships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chip_risk_state` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`spamRisk` int NOT NULL DEFAULT 0,
	`banRisk` int NOT NULL DEFAULT 0,
	`humanScore` int NOT NULL DEFAULT 0,
	`socialScore` int NOT NULL DEFAULT 0,
	`routineScore` int NOT NULL DEFAULT 0,
	`conversationScore` int NOT NULL DEFAULT 0,
	`presenceScore` int NOT NULL DEFAULT 0,
	`payload` mediumtext,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chip_risk_state_id` PRIMARY KEY(`id`),
	CONSTRAINT `chip_risk_state_chipId_unique` UNIQUE(`chipId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chip_routine_state` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`weekday` int NOT NULL DEFAULT 0,
	`currentMode` varchar(60) NOT NULL DEFAULT 'idle',
	`nextActionAt` timestamp,
	`lastWindowStartedAt` timestamp,
	`lastWindowEndedAt` timestamp,
	`actionsToday` int NOT NULL DEFAULT 0,
	`pausesToday` int NOT NULL DEFAULT 0,
	`payload` mediumtext,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chip_routine_state_id` PRIMARY KEY(`id`),
	CONSTRAINT `chip_routine_state_chipId_unique` UNIQUE(`chipId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chip_social_graph` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`entityType` enum('contact','group') NOT NULL,
	`entityId` varchar(191) NOT NULL,
	`label` varchar(255),
	`trust` int NOT NULL DEFAULT 0,
	`interactionCount` int NOT NULL DEFAULT 0,
	`lastSeen` timestamp,
	`relationshipLevel` int NOT NULL DEFAULT 0,
	`favorite` int NOT NULL DEFAULT 0,
	`payload` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chip_social_graph_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chip_state_projections` (
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
CREATE TABLE IF NOT EXISTS `chip_worker_checkpoints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workerName` varchar(120) NOT NULL,
	`lastOffset` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chip_worker_checkpoints_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_chip_worker_checkpoints_workerName` UNIQUE(`workerName`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `cluster_backup_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotKey` varchar(191) NOT NULL,
	`scope` varchar(80) NOT NULL DEFAULT 'cluster',
	`status` enum('ready','restored','failed') NOT NULL DEFAULT 'ready',
	`payload` mediumtext NOT NULL,
	`restoredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cluster_backup_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_cluster_backup_snapshot` UNIQUE(`snapshotKey`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `cluster_nodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nodeId` varchar(191) NOT NULL,
	`hostname` varchar(191) NOT NULL,
	`pid` int NOT NULL,
	`role` varchar(80) NOT NULL DEFAULT 'worker',
	`status` enum('starting','running','draining','offline') NOT NULL DEFAULT 'starting',
	`version` varchar(40),
	`isLeader` int NOT NULL DEFAULT 0,
	`lastHeartbeatAt` timestamp NOT NULL DEFAULT (now()),
	`payload` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cluster_nodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_cluster_node` UNIQUE(`nodeId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `distributed_chip_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`chipId` int NOT NULL,
	`ownerNodeId` varchar(191) NOT NULL,
	`phoneNumber` varchar(30),
	`sessionStatus` enum('connected','disconnected','recovering','failed','orphaned') NOT NULL DEFAULT 'disconnected',
	`connectionState` varchar(80),
	`healthScore` int NOT NULL DEFAULT 0,
	`lastHeartbeatAt` timestamp NOT NULL DEFAULT (now()),
	`payload` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `distributed_chip_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_distributed_chip_session` UNIQUE(`chipId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ecosystem_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sourceChipId` int,
	`targetChipId` int,
	`eventType` varchar(80) NOT NULL,
	`referenceKey` varchar(191) NOT NULL,
	`payload` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ecosystem_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `execution_attempts` (
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
CREATE TABLE IF NOT EXISTS `execution_jobs` (
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
CREATE TABLE IF NOT EXISTS `fleet_knowledge_promotions` (
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
CREATE TABLE IF NOT EXISTS `fleet_learning_cohorts` (
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
CREATE TABLE IF NOT EXISTS `fleet_learning_patterns` (
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
CREATE TABLE IF NOT EXISTS `group_catalog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`category` varchar(120) NOT NULL,
	`city` varchar(120),
	`ddd` varchar(4),
	`link` text,
	`active` int NOT NULL DEFAULT 1,
	`risk` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `group_catalog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `knowledge_base_items` (
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
CREATE TABLE IF NOT EXISTS `leader_leases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leaseKey` varchar(120) NOT NULL,
	`leaderNodeId` varchar(191) NOT NULL,
	`leaseToken` varchar(191) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`payload` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leader_leases_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_leader_lease` UNIQUE(`leaseKey`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `learning_engine_events` (
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
CREATE TABLE IF NOT EXISTS `learning_hypotheses` (
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
CREATE TABLE IF NOT EXISTS `maturation_experience_journal` (
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
CREATE TABLE IF NOT EXISTS `maturation_profiles` (
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
CREATE TABLE IF NOT EXISTS `maturation_targets` (
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
CREATE TABLE IF NOT EXISTS `message_templates` (
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
CREATE TABLE IF NOT EXISTS `observation_runtime_events` (
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
CREATE TABLE IF NOT EXISTS `observation_runtime_records` (
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
CREATE TABLE IF NOT EXISTS `relationship_memories` (
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
CREATE TABLE IF NOT EXISTS `scheduled_tasks` (
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
	`lastExecutedAt` timestamp,
	`lastRunStatus` varchar(32),
	`lastRunError` text,
	`scheduleCronTaskUid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduled_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `subscription_plans` (
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
CREATE TABLE IF NOT EXISTS `system_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`configKey` varchar(191) NOT NULL,
	`valueType` enum('string','number','boolean','json') NOT NULL DEFAULT 'string',
	`valueText` text,
	`valueNumber` int,
	`valueBoolean` int,
	`description` text,
	`payload` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_system_config` UNIQUE(`configKey`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_subscriptions` (
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
CREATE TABLE IF NOT EXISTS `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`profileImageUrl` mediumtext,
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `whatsapp_chips` (
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
CREATE TABLE IF NOT EXISTS `worker_heartbeats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workerId` varchar(191) NOT NULL,
	`runtime` varchar(100) NOT NULL,
	`hostname` varchar(191) NOT NULL,
	`pid` int NOT NULL,
	`queueName` varchar(120) NOT NULL,
	`status` enum('starting','running','degraded','stopped') NOT NULL DEFAULT 'starting',
	`lastHeartbeatAt` timestamp NOT NULL DEFAULT (now()),
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`payload` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `worker_heartbeats_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_worker_heartbeat` UNIQUE(`workerId`)
);
--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_audit_logs` ADD CONSTRAINT `admin_audit_logs_adminUserId_users_id_fk` FOREIGN KEY (`adminUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_audit_logs` ADD CONSTRAINT `admin_audit_logs_targetUserId_users_id_fk` FOREIGN KEY (`targetUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE `chip_certification_state` ADD CONSTRAINT `chip_certification_state_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_certification_state` ADD CONSTRAINT `chip_certification_state_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_certifications` ADD CONSTRAINT `chip_certifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_certifications` ADD CONSTRAINT `chip_certifications_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_groups` ADD CONSTRAINT `chip_groups_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_groups` ADD CONSTRAINT `chip_groups_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_health` ADD CONSTRAINT `chip_health_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_health` ADD CONSTRAINT `chip_health_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_identity_evolution` ADD CONSTRAINT `chip_identity_evolution_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_identity_evolution` ADD CONSTRAINT `chip_identity_evolution_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_learning_metrics` ADD CONSTRAINT `chip_learning_metrics_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_learning_metrics` ADD CONSTRAINT `chip_learning_metrics_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_persona` ADD CONSTRAINT `chip_persona_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_relationships` ADD CONSTRAINT `chip_relationships_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_relationships` ADD CONSTRAINT `chip_relationships_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_risk_state` ADD CONSTRAINT `chip_risk_state_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_risk_state` ADD CONSTRAINT `chip_risk_state_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_routine_state` ADD CONSTRAINT `chip_routine_state_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_routine_state` ADD CONSTRAINT `chip_routine_state_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_social_graph` ADD CONSTRAINT `chip_social_graph_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chip_social_graph` ADD CONSTRAINT `chip_social_graph_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `distributed_chip_sessions` ADD CONSTRAINT `distributed_chip_sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `distributed_chip_sessions` ADD CONSTRAINT `distributed_chip_sessions_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ecosystem_events` ADD CONSTRAINT `ecosystem_events_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ecosystem_events` ADD CONSTRAINT `ecosystem_events_sourceChipId_whatsapp_chips_id_fk` FOREIGN KEY (`sourceChipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ecosystem_events` ADD CONSTRAINT `ecosystem_events_targetChipId_whatsapp_chips_id_fk` FOREIGN KEY (`targetChipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `execution_attempts` ADD CONSTRAINT `execution_attempts_jobId_execution_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `execution_jobs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `execution_attempts` ADD CONSTRAINT `execution_attempts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `execution_attempts` ADD CONSTRAINT `execution_attempts_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `execution_jobs` ADD CONSTRAINT `execution_jobs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `execution_jobs` ADD CONSTRAINT `execution_jobs_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fleet_knowledge_promotions` ADD CONSTRAINT `fleet_knowledge_promotions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fleet_learning_cohorts` ADD CONSTRAINT `fleet_learning_cohorts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fleet_learning_patterns` ADD CONSTRAINT `fleet_learning_patterns_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `group_catalog` ADD CONSTRAINT `group_catalog_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `knowledge_base_items` ADD CONSTRAINT `knowledge_base_items_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learning_engine_events` ADD CONSTRAINT `learning_engine_events_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learning_engine_events` ADD CONSTRAINT `learning_engine_events_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learning_hypotheses` ADD CONSTRAINT `learning_hypotheses_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maturation_experience_journal` ADD CONSTRAINT `maturation_experience_journal_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maturation_experience_journal` ADD CONSTRAINT `maturation_experience_journal_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maturation_profiles` ADD CONSTRAINT `maturation_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maturation_targets` ADD CONSTRAINT `maturation_targets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `message_templates` ADD CONSTRAINT `message_templates_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `relationship_memories` ADD CONSTRAINT `relationship_memories_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `relationship_memories` ADD CONSTRAINT `relationship_memories_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scheduled_tasks` ADD CONSTRAINT `scheduled_tasks_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scheduled_tasks` ADD CONSTRAINT `scheduled_tasks_chipId_whatsapp_chips_id_fk` FOREIGN KEY (`chipId`) REFERENCES `whatsapp_chips`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_planId_subscription_plans_id_fk` FOREIGN KEY (`planId`) REFERENCES `subscription_plans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_chips` ADD CONSTRAINT `whatsapp_chips_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ix_behavior_budget_user_status_created` ON `behavior_budget_reservations` (`userId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ix_behavior_decision_log_chipId_createdAt` ON `behavior_decision_log` (`chipId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `ix_behavior_decision_log_createdAt` ON `behavior_decision_log` (`createdAt`);--> statement-breakpoint
CREATE INDEX `ix_chip_audit_evidences_chipId_recordedAt` ON `chip_audit_evidences` (`chipId`,`recordedAt`);--> statement-breakpoint
CREATE INDEX `ix_chip_event_history_chipId_sequence` ON `chip_event_history` (`chipId`,`sequence`);--> statement-breakpoint
CREATE INDEX `idx_cluster_backup_scope` ON `cluster_backup_snapshots` (`scope`);--> statement-breakpoint
CREATE INDEX `idx_cluster_node_status` ON `cluster_nodes` (`status`);--> statement-breakpoint
CREATE INDEX `idx_distributed_owner` ON `distributed_chip_sessions` (`ownerNodeId`);--> statement-breakpoint
CREATE INDEX `idx_distributed_status` ON `distributed_chip_sessions` (`sessionStatus`);--> statement-breakpoint
CREATE INDEX `idx_leader_lease_expires` ON `leader_leases` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `observation_runtime_events_stream_idx` ON `observation_runtime_events` (`stream`);--> statement-breakpoint
CREATE INDEX `observation_runtime_records_status_idx` ON `observation_runtime_records` (`processingStatus`);--> statement-breakpoint
CREATE INDEX `observation_runtime_records_claimed_by_idx` ON `observation_runtime_records` (`claimedBy`);--> statement-breakpoint
CREATE INDEX `observation_runtime_records_correlation_idx` ON `observation_runtime_records` (`correlationId`);--> statement-breakpoint
CREATE INDEX `observation_runtime_records_lease_idx` ON `observation_runtime_records` (`leaseExpiresAt`);--> statement-breakpoint
CREATE INDEX `idx_worker_heartbeat_status` ON `worker_heartbeats` (`status`);--> statement-breakpoint
CREATE INDEX `idx_worker_heartbeat_runtime` ON `worker_heartbeats` (`runtime`);