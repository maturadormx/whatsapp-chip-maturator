import { eq, and, desc, gte, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  whatsappChips,
  chipPersona,
  activityLogs,
  behaviorTimelineEvents,
  behaviorMemorySnapshots,
  behaviorOutcomes,
  behaviorOpportunityObservations,
  fleetKnowledgePromotions,
  fleetLearningCohorts,
  fleetLearningPatterns,
  knowledgeBaseItems,
  learningEngineEvents,
  learningHypotheses,
  maturationExperienceJournal,
  relationshipMemories,
  chipGroups,
  groupCatalog,
  chipRelationships,
  chipSocialGraph,
  chipHealth,
  chipBehaviorScores,
  chipRiskState,
  chipRoutineState,
  chipIdentityEvolution,
  chipLearningMetrics,
  chipCertificationState,
  ecosystemEvents,
  workerHeartbeats,
  systemConfigs,
  auditEvents,
  clusterNodes,
  leaderLeases,
  distributedChipSessions,
  clusterBackupSnapshots,
  chipCertifications,
  behaviorDecisionLog,
  behaviorSnapshots,
  scheduledTasks,
  userSubscriptions,
  subscriptionPlans,
  maturationProfiles,
  messageTemplates,
  maturationTargets,
  executionJobs,
  executionAttempts,
  behaviorActionExecution,
  adminAuditLogs,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { generateRandomPersonaDraft } from "./services/persona/PersonaFactory";
import { normalizeTargetValue } from "./utils/targets";

let _db: ReturnType<typeof drizzle> | null = null;
let _adminAuditTableEnsured = false;
let _userProfileImageColumnEnsured = false;
let _behaviorTimelineTableEnsured = false;
let _behaviorMemoryTableEnsured = false;
let _behaviorOutcomesTableEnsured = false;
let _behaviorOpportunityObservationsTableEnsured = false;
let _maturationExperienceJournalTableEnsured = false;
let _relationshipMemoriesTableEnsured = false;
let _learningHypothesesTableEnsured = false;
let _knowledgeBaseItemsTableEnsured = false;
let _learningEngineEventsTableEnsured = false;
let _fleetLearningCohortsTableEnsured = false;
let _fleetLearningPatternsTableEnsured = false;
let _fleetKnowledgePromotionsTableEnsured = false;
let _chipHealthTableEnsured = false;
let _chipBehaviorScoresTableEnsured = false;
let _chipGroupsTableEnsured = false;
let _groupCatalogTableEnsured = false;
let _chipRelationshipsTableEnsured = false;
let _chipSocialGraphTableEnsured = false;
let _chipRiskStateTableEnsured = false;
let _chipRoutineStateTableEnsured = false;
let _chipIdentityEvolutionTableEnsured = false;
let _chipLearningMetricsTableEnsured = false;
let _chipCertificationStateTableEnsured = false;
let _ecosystemEventsTableEnsured = false;
let _workerHeartbeatsTableEnsured = false;
let _systemConfigsTableEnsured = false;
let _auditEventsTableEnsured = false;
let _clusterNodesTableEnsured = false;
let _leaderLeasesTableEnsured = false;
let _distributedChipSessionsTableEnsured = false;
let _clusterBackupSnapshotsTableEnsured = false;
let _chipCertificationsTableEnsured = false;
let _chipPersonaTableEnsured = false;
let _behaviorDecisionLogTableEnsured = false;
let _behaviorSnapshotsTableEnsured = false;
let _behaviorActionExecutionTableEnsured = false;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function ensureAdminAuditLogsTable() {
  if (_adminAuditTableEnsured) return;
  const db = await getDb();
  if (!db) return;
  try {
    // Safety: in ambientes sem migrations, tentamos criar a tabela automaticamente.
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        adminUserId INT NOT NULL,
        targetUserId INT NULL,
        entity VARCHAR(60) NOT NULL,
        action VARCHAR(80) NOT NULL,
        payload TEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    _adminAuditTableEnsured = true;
  } catch (error) {
    // Se falhar (permissão, driver, etc.), seguimos sem auditoria para não quebrar a operação.
    console.warn("[AdminAudit] Failed to ensure table:", error);
  }
}

async function ensureUserProfileImageColumn() {
  if (_userProfileImageColumnEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    const existingColumns = await (db as any).execute?.(sql`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'profileImageUrl'
      LIMIT 1
    `);
    const existingRows = Array.isArray(existingColumns?.[0]) ? existingColumns[0] : existingColumns?.rows ?? [];
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      _userProfileImageColumnEnsured = true;
      return;
    }

    await (db as any).execute?.(sql`
      ALTER TABLE users
      ADD COLUMN profileImageUrl MEDIUMTEXT NULL
    `);
  } catch (error: any) {
    const message = String(error?.message ?? "");
    const code = String(error?.code ?? "");
    if (!message.toLowerCase().includes("duplicate column") && code !== "ER_DUP_FIELDNAME") {
      console.warn("[Database] Failed to ensure users.profileImageUrl column:", error);
      return;
    }
  }

  _userProfileImageColumnEnsured = true;
}

async function ensureBehaviorTimelineTable() {
  if (_behaviorTimelineTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS behavior_timeline_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        chipId INT NOT NULL,
        eventType VARCHAR(64) NOT NULL,
        source VARCHAR(64) NOT NULL,
        direction VARCHAR(20) NULL,
        remoteJid VARCHAR(255) NULL,
        remoteType VARCHAR(20) NULL,
        remoteLabel VARCHAR(255) NULL,
        messageId VARCHAR(128) NULL,
        relatedMessageId VARCHAR(128) NULL,
        ackType VARCHAR(64) NULL,
        groupJid VARCHAR(255) NULL,
        groupSubject VARCHAR(255) NULL,
        contentPreview TEXT NULL,
        payload MEDIUMTEXT NULL,
        occurredAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_behavior_timeline_user_chip_time (userId, chipId, occurredAt),
        INDEX idx_behavior_timeline_event_type (eventType),
        INDEX idx_behavior_timeline_message (messageId),
        INDEX idx_behavior_timeline_group (groupJid)
      )
    `);
    _behaviorTimelineTableEnsured = true;
  } catch (error) {
    console.warn("[BehaviorTimeline] Failed to ensure table:", error);
  }
}

async function ensureBehaviorMemoryTable() {
  if (_behaviorMemoryTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS behavior_memory_snapshots (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        chipId INT NOT NULL,
        windowStart TIMESTAMP NOT NULL,
        windowEnd TIMESTAMP NOT NULL,
        sampleDays INT NOT NULL DEFAULT 1,
        firstActionAt TIMESTAMP NULL,
        lastActionAt TIMESTAMP NULL,
        totalActions INT NOT NULL DEFAULT 0,
        distinctActionTypes INT NOT NULL DEFAULT 0,
        repetitionScore INT NOT NULL DEFAULT 0,
        variationScore INT NOT NULL DEFAULT 0,
        actionSequence TEXT NULL,
        activeHourBuckets TEXT NULL,
        responseDelayBuckets TEXT NULL,
        idleWindows TEXT NULL,
        patternSignature VARCHAR(255) NULL,
        payload MEDIUMTEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_behavior_memory_user_chip_window (userId, chipId, windowStart),
        INDEX idx_behavior_memory_chip_updated (chipId, updatedAt),
        INDEX idx_behavior_memory_pattern_signature (patternSignature)
      )
    `);
    _behaviorMemoryTableEnsured = true;
  } catch (error) {
    console.warn("[BehaviorMemory] Failed to ensure table:", error);
  }
}

async function ensureBehaviorOutcomesTable() {
  if (_behaviorOutcomesTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS behavior_outcomes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        chipId INT NOT NULL,
        observationWindowStart TIMESTAMP NOT NULL,
        observationWindowEnd TIMESTAMP NOT NULL,
        predictedRisk INT NOT NULL DEFAULT 0,
        predictedCredibility INT NOT NULL DEFAULT 0,
        actualOutcome ENUM('unknown', 'healthy', 'warning', 'restriction', 'ban') NOT NULL DEFAULT 'unknown',
        restrictionOccurred TINYINT(1) NOT NULL DEFAULT 0,
        warningOccurred TINYINT(1) NOT NULL DEFAULT 0,
        banOccurred TINYINT(1) NOT NULL DEFAULT 0,
        humanLikeOutcome ENUM('unknown', 'human_like', 'not_human_like', 'uncertain') NOT NULL DEFAULT 'unknown',
        validatedAt TIMESTAMP NULL,
        payload MEDIUMTEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_behavior_outcomes_chip_window (chipId, observationWindowStart, observationWindowEnd),
        INDEX idx_behavior_outcomes_validated (validatedAt),
        INDEX idx_behavior_outcomes_actual (actualOutcome)
      )
    `);
    _behaviorOutcomesTableEnsured = true;
  } catch (error) {
    console.warn("[BehaviorOutcomes] Failed to ensure table:", error);
  }
}

async function ensureBehaviorOpportunityObservationsTable() {
  if (_behaviorOpportunityObservationsTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS behavior_opportunity_observations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        chipId INT NOT NULL,
        opportunityId VARCHAR(128) NOT NULL,
        observedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reason TEXT NOT NULL,
        riskAtDecision INT NOT NULL DEFAULT 0,
        confidence INT NOT NULL DEFAULT 0,
        expectedGain INT NOT NULL DEFAULT 0,
        expectedRisk INT NOT NULL DEFAULT 0,
        decision ENUM('ACT_NOW', 'WAIT', 'DO_NOTHING') NOT NULL DEFAULT 'DO_NOTHING',
        observedResultAfter24h TEXT NULL,
        observedResultAfter72h TEXT NULL,
        observedResultAfter7d TEXT NULL,
        payload MEDIUMTEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_behavior_opportunity_chip_observed (chipId, observedAt),
        INDEX idx_behavior_opportunity_decision (decision),
        INDEX idx_behavior_opportunity_id (opportunityId)
      )
    `);
    _behaviorOpportunityObservationsTableEnsured = true;
  } catch (error) {
    console.warn("[BehaviorOpportunityObservations] Failed to ensure table:", error);
  }
}

async function ensureMaturationExperienceJournalTable() {
  if (_maturationExperienceJournalTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS maturation_experience_journal (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        chipId INT NOT NULL,
        chapterId VARCHAR(128) NOT NULL,
        chapterType ENUM('snapshot', 'opportunity', 'recovery', 'silence') NOT NULL DEFAULT 'snapshot',
        observedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        contextHash VARCHAR(128) NULL,
        strategyChosen VARCHAR(128) NULL,
        actionTaken VARCHAR(128) NULL,
        riskBefore INT NOT NULL DEFAULT 0,
        riskAfter INT NOT NULL DEFAULT 0,
        credibilityBefore INT NOT NULL DEFAULT 0,
        credibilityAfter INT NOT NULL DEFAULT 0,
        outcome24h TEXT NULL,
        outcome72h TEXT NULL,
        outcome7d TEXT NULL,
        payload MEDIUMTEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_maturation_experience_chip_observed (chipId, observedAt),
        INDEX idx_maturation_experience_chapter (chapterId),
        INDEX idx_maturation_experience_type (chapterType)
      )
    `);
    _maturationExperienceJournalTableEnsured = true;
  } catch (error) {
    console.warn("[MaturationExperienceJournal] Failed to ensure table:", error);
  }
}

async function ensureRelationshipMemoriesTable() {
  if (_relationshipMemoriesTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS relationship_memories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        chipId INT NOT NULL,
        counterpartKey VARCHAR(191) NOT NULL,
        counterpartType ENUM('contact', 'group', 'unknown') NOT NULL DEFAULT 'unknown',
        stage ENUM('unknown', 'known', 'trust', 'recurring', 'inactive') NOT NULL DEFAULT 'unknown',
        firstInteractionAt TIMESTAMP NULL,
        lastInteractionAt TIMESTAMP NULL,
        trustScore INT NOT NULL DEFAULT 0,
        relationshipRisk INT NOT NULL DEFAULT 0,
        idealContactFrequencyHours INT NOT NULL DEFAULT 0,
        payload MEDIUMTEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_relationship_memory (chipId, counterpartKey),
        INDEX idx_relationship_memory_stage (stage),
        INDEX idx_relationship_memory_last_interaction (lastInteractionAt)
      )
    `);
    _relationshipMemoriesTableEnsured = true;
  } catch (error) {
    console.warn("[RelationshipMemories] Failed to ensure table:", error);
  }
}

async function ensureChipGroupsTable() {
  if (_chipGroupsTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS chip_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        chipId INT NOT NULL,
        groupJid VARCHAR(255) NOT NULL,
        groupName VARCHAR(255) NULL,
        origin ENUM('internal', 'manual_invite', 'catalog', 'runtime_discovery') NOT NULL DEFAULT 'runtime_discovery',
        category VARCHAR(120) NULL,
        joinedAt TIMESTAMP NULL,
        leftAt TIMESTAMP NULL,
        lastInteraction TIMESTAMP NULL,
        role VARCHAR(40) NOT NULL DEFAULT 'member',
        status ENUM('candidate', 'joined', 'left', 'blocked') NOT NULL DEFAULT 'candidate',
        inviteLink TEXT NULL,
        risk INT NOT NULL DEFAULT 0,
        payload MEDIUMTEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_chip_group_membership (chipId, groupJid),
        INDEX idx_chip_groups_status (status),
        INDEX idx_chip_groups_origin (origin),
        INDEX idx_chip_groups_last_interaction (lastInteraction)
      )
    `);
    _chipGroupsTableEnsured = true;
  } catch (error) {
    console.warn("[ChipGroups] Failed to ensure table:", error);
  }
}

async function ensureGroupCatalogTable() {
  if (_groupCatalogTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS group_catalog (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NULL,
        category VARCHAR(120) NOT NULL,
        city VARCHAR(120) NULL,
        ddd VARCHAR(4) NULL,
        link TEXT NULL,
        active INT NOT NULL DEFAULT 1,
        risk INT NOT NULL DEFAULT 0,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_group_catalog_active (active),
        INDEX idx_group_catalog_ddd (ddd),
        INDEX idx_group_catalog_city (city)
      )
    `);
    _groupCatalogTableEnsured = true;
  } catch (error) {
    console.warn("[GroupCatalog] Failed to ensure table:", error);
  }
}

async function ensureChipRelationshipsTable() {
  if (_chipRelationshipsTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS chip_relationships (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        chipId INT NOT NULL,
        contact VARCHAR(191) NOT NULL,
        interactions INT NOT NULL DEFAULT 0,
        lastSeen TIMESTAMP NULL,
        trustScore INT NOT NULL DEFAULT 0,
        conversationLevel INT NOT NULL DEFAULT 0,
        firstInteraction TIMESTAMP NULL,
        lastInteraction TIMESTAMP NULL,
        favorite INT NOT NULL DEFAULT 0,
        payload MEDIUMTEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_chip_relationship (chipId, contact),
        INDEX idx_chip_relationship_trust (trustScore),
        INDEX idx_chip_relationship_last_interaction (lastInteraction)
      )
    `);
    _chipRelationshipsTableEnsured = true;
  } catch (error) {
    console.warn("[ChipRelationships] Failed to ensure table:", error);
  }
}

async function ensureChipSocialGraphTable() {
  if (_chipSocialGraphTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS chip_social_graph (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        chipId INT NOT NULL,
        entityType ENUM('contact', 'group') NOT NULL,
        entityId VARCHAR(191) NOT NULL,
        label VARCHAR(255) NULL,
        trust INT NOT NULL DEFAULT 0,
        interactionCount INT NOT NULL DEFAULT 0,
        lastSeen TIMESTAMP NULL,
        relationshipLevel INT NOT NULL DEFAULT 0,
        favorite INT NOT NULL DEFAULT 0,
        payload MEDIUMTEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_chip_social_graph (chipId, entityType, entityId),
        INDEX idx_chip_social_graph_trust (trust),
        INDEX idx_chip_social_graph_last_seen (lastSeen)
      )
    `);
    _chipSocialGraphTableEnsured = true;
  } catch (error) {
    console.warn("[ChipSocialGraph] Failed to ensure table:", error);
  }
}

async function ensureLearningHypothesesTable() {
  if (_learningHypothesesTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS learning_hypotheses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        hypothesisKey VARCHAR(191) NOT NULL,
        status ENUM('draft', 'candidate', 'validated', 'knowledge', 'deprecated', 'archived') NOT NULL DEFAULT 'draft',
        title VARCHAR(255) NOT NULL,
        confidence INT NOT NULL DEFAULT 0,
        sampleSize INT NOT NULL DEFAULT 0,
        successRate INT NOT NULL DEFAULT 0,
        contradictionRate INT NOT NULL DEFAULT 0,
        temporalStability INT NOT NULL DEFAULT 0,
        segmentConsistency INT NOT NULL DEFAULT 0,
        lastValidatedAt TIMESTAMP NULL,
        payload MEDIUMTEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_learning_hypothesis (userId, hypothesisKey),
        INDEX idx_learning_hypothesis_status (status),
        INDEX idx_learning_hypothesis_validated (lastValidatedAt)
      )
    `);
    _learningHypothesesTableEnsured = true;
  } catch (error) {
    console.warn("[LearningHypotheses] Failed to ensure table:", error);
  }
}

async function ensureKnowledgeBaseItemsTable() {
  if (_knowledgeBaseItemsTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS knowledge_base_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        knowledgeKey VARCHAR(191) NOT NULL,
        sourceHypothesisKey VARCHAR(191) NULL,
        status ENUM('candidate', 'active', 'decaying', 'retired', 'archived') NOT NULL DEFAULT 'candidate',
        title VARCHAR(255) NOT NULL,
        confidence INT NOT NULL DEFAULT 0,
        usageCount INT NOT NULL DEFAULT 0,
        successRate INT NOT NULL DEFAULT 0,
        decayRate INT NOT NULL DEFAULT 0,
        expiresAt TIMESTAMP NULL,
        lastValidatedAt TIMESTAMP NULL,
        payload MEDIUMTEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_knowledge_item (userId, knowledgeKey),
        INDEX idx_knowledge_status (status),
        INDEX idx_knowledge_expires (expiresAt)
      )
    `);
    _knowledgeBaseItemsTableEnsured = true;
  } catch (error) {
    console.warn("[KnowledgeBaseItems] Failed to ensure table:", error);
  }
}

async function ensureLearningEngineEventsTable() {
  if (_learningEngineEventsTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS learning_engine_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        chipId INT NULL,
        eventType ENUM('observed', 'validated', 'promoted', 'revalidated', 'retired', 'contradicted') NOT NULL,
        referenceKey VARCHAR(191) NOT NULL,
        observedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        payload MEDIUMTEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_learning_event_reference (referenceKey),
        INDEX idx_learning_event_observed (observedAt),
        INDEX idx_learning_event_type (eventType)
      )
    `);
    _learningEngineEventsTableEnsured = true;
  } catch (error) {
    console.warn("[LearningEngineEvents] Failed to ensure table:", error);
  }
}

async function ensureChipLearningMetricsTable() {
  if (_chipLearningMetricsTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS chip_learning_metrics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        chipId INT NOT NULL,
        actionKey VARCHAR(100) NOT NULL,
        successCount INT NOT NULL DEFAULT 0,
        failureCount INT NOT NULL DEFAULT 0,
        successRate INT NOT NULL DEFAULT 0,
        failureRate INT NOT NULL DEFAULT 0,
        averageResponse INT NOT NULL DEFAULT 0,
        averageDelay INT NOT NULL DEFAULT 0,
        payload MEDIUMTEXT NULL,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_chip_learning_metrics (chipId, actionKey),
        INDEX idx_chip_learning_metrics_success (successRate),
        INDEX idx_chip_learning_metrics_failure (failureRate)
      )
    `);
    _chipLearningMetricsTableEnsured = true;
  } catch (error) {
    console.warn("[ChipLearningMetrics] Failed to ensure table:", error);
  }
}

async function ensureFleetLearningCohortsTable() {
  if (_fleetLearningCohortsTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS fleet_learning_cohorts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        cohortKey VARCHAR(191) NOT NULL,
        status ENUM('emerging', 'stable', 'elite', 'critical') NOT NULL DEFAULT 'emerging',
        title VARCHAR(255) NOT NULL,
        chipCount INT NOT NULL DEFAULT 0,
        averageSuccessRate INT NOT NULL DEFAULT 0,
        averageRiskScore INT NOT NULL DEFAULT 0,
        averageCredibilityScore INT NOT NULL DEFAULT 0,
        lastComputedAt TIMESTAMP NULL,
        payload MEDIUMTEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_fleet_cohort (userId, cohortKey),
        INDEX idx_fleet_cohort_status (status),
        INDEX idx_fleet_cohort_computed (lastComputedAt)
      )
    `);
    _fleetLearningCohortsTableEnsured = true;
  } catch (error) {
    console.warn("[FleetLearningCohorts] Failed to ensure table:", error);
  }
}

async function ensureFleetLearningPatternsTable() {
  if (_fleetLearningPatternsTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS fleet_learning_patterns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        patternKey VARCHAR(191) NOT NULL,
        cohortKey VARCHAR(191) NOT NULL,
        status ENUM('candidate', 'promoted', 'active', 'retired') NOT NULL DEFAULT 'candidate',
        title VARCHAR(255) NOT NULL,
        confidence INT NOT NULL DEFAULT 0,
        sampleSize INT NOT NULL DEFAULT 0,
        successRate INT NOT NULL DEFAULT 0,
        riskScore INT NOT NULL DEFAULT 0,
        recommendationType VARCHAR(120) NOT NULL,
        lastValidatedAt TIMESTAMP NULL,
        payload MEDIUMTEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_fleet_pattern (userId, patternKey),
        INDEX idx_fleet_pattern_status (status),
        INDEX idx_fleet_pattern_cohort (cohortKey)
      )
    `);
    _fleetLearningPatternsTableEnsured = true;
  } catch (error) {
    console.warn("[FleetLearningPatterns] Failed to ensure table:", error);
  }
}

async function ensureFleetKnowledgePromotionsTable() {
  if (_fleetKnowledgePromotionsTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS fleet_knowledge_promotions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        sourcePatternKey VARCHAR(191) NOT NULL,
        targetKnowledgeKey VARCHAR(191) NOT NULL,
        action ENUM('observe', 'promote', 'revalidate', 'retire') NOT NULL,
        observedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        payload MEDIUMTEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_fleet_promotion_source (sourcePatternKey),
        INDEX idx_fleet_promotion_target (targetKnowledgeKey),
        INDEX idx_fleet_promotion_observed (observedAt)
      )
    `);
    _fleetKnowledgePromotionsTableEnsured = true;
  } catch (error) {
    console.warn("[FleetKnowledgePromotions] Failed to ensure table:", error);
  }
}

async function ensureEcosystemEventsTable() {
  if (_ecosystemEventsTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS ecosystem_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        sourceChipId INT NULL,
        targetChipId INT NULL,
        eventType VARCHAR(80) NOT NULL,
        referenceKey VARCHAR(191) NOT NULL,
        payload MEDIUMTEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ecosystem_events_source (sourceChipId),
        INDEX idx_ecosystem_events_target (targetChipId),
        INDEX idx_ecosystem_events_reference (referenceKey)
      )
    `);
    _ecosystemEventsTableEnsured = true;
  } catch (error) {
    console.warn("[EcosystemEvents] Failed to ensure table:", error);
  }
}

async function ensureWorkerHeartbeatsTable() {
  if (_workerHeartbeatsTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS worker_heartbeats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        workerId VARCHAR(191) NOT NULL,
        runtime VARCHAR(100) NOT NULL,
        hostname VARCHAR(191) NOT NULL,
        pid INT NOT NULL,
        queueName VARCHAR(120) NOT NULL,
        status ENUM('starting', 'running', 'degraded', 'stopped') NOT NULL DEFAULT 'starting',
        lastHeartbeatAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        payload MEDIUMTEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_worker_heartbeat (workerId),
        INDEX idx_worker_heartbeat_status (status),
        INDEX idx_worker_heartbeat_runtime (runtime)
      )
    `);
    _workerHeartbeatsTableEnsured = true;
  } catch (error) {
    console.warn("[WorkerHeartbeats] Failed to ensure table:", error);
  }
}

async function ensureSystemConfigsTable() {
  if (_systemConfigsTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS system_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        configKey VARCHAR(191) NOT NULL,
        valueType ENUM('string', 'number', 'boolean', 'json') NOT NULL DEFAULT 'string',
        valueText TEXT NULL,
        valueNumber INT NULL,
        valueBoolean INT NULL,
        description TEXT NULL,
        payload MEDIUMTEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_system_config (configKey)
      )
    `);
    _systemConfigsTableEnsured = true;
  } catch (error) {
    console.warn("[SystemConfigs] Failed to ensure table:", error);
  }
}

async function ensureAuditEventsTable() {
  if (_auditEventsTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS audit_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NULL,
        chipId INT NULL,
        engine VARCHAR(120) NOT NULL,
        action VARCHAR(120) NOT NULL,
        entityType VARCHAR(80) NULL,
        entityId VARCHAR(191) NULL,
        beforeState MEDIUMTEXT NULL,
        afterState MEDIUMTEXT NULL,
        result ENUM('success', 'failed', 'skipped') NOT NULL DEFAULT 'success',
        errorMessage TEXT NULL,
        durationMs INT NULL,
        workerId VARCHAR(191) NULL,
        payload MEDIUMTEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_engine (engine),
        INDEX idx_audit_chip (chipId),
        INDEX idx_audit_worker (workerId),
        INDEX idx_audit_created (createdAt)
      )
    `);
    _auditEventsTableEnsured = true;
  } catch (error) {
    console.warn("[AuditEvents] Failed to ensure table:", error);
  }
}

async function ensureClusterNodesTable() {
  if (_clusterNodesTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS cluster_nodes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nodeId VARCHAR(191) NOT NULL,
        hostname VARCHAR(191) NOT NULL,
        pid INT NOT NULL,
        role VARCHAR(80) NOT NULL DEFAULT 'worker',
        status ENUM('starting', 'running', 'draining', 'offline') NOT NULL DEFAULT 'starting',
        version VARCHAR(40) NULL,
        isLeader INT NOT NULL DEFAULT 0,
        lastHeartbeatAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        payload MEDIUMTEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_cluster_node (nodeId),
        INDEX idx_cluster_node_status (status)
      )
    `);
    _clusterNodesTableEnsured = true;
  } catch (error) {
    console.warn("[ClusterNodes] Failed to ensure table:", error);
  }
}

async function ensureLeaderLeasesTable() {
  if (_leaderLeasesTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS leader_leases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        leaseKey VARCHAR(120) NOT NULL,
        leaderNodeId VARCHAR(191) NOT NULL,
        leaseToken VARCHAR(191) NOT NULL,
        expiresAt TIMESTAMP NOT NULL,
        payload MEDIUMTEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_leader_lease (leaseKey),
        INDEX idx_leader_lease_expires (expiresAt)
      )
    `);
    _leaderLeasesTableEnsured = true;
  } catch (error) {
    console.warn("[LeaderLeases] Failed to ensure table:", error);
  }
}

async function ensureDistributedChipSessionsTable() {
  if (_distributedChipSessionsTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS distributed_chip_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        chipId INT NOT NULL,
        ownerNodeId VARCHAR(191) NOT NULL,
        phoneNumber VARCHAR(30) NULL,
        sessionStatus ENUM('connected', 'disconnected', 'recovering', 'failed', 'orphaned') NOT NULL DEFAULT 'disconnected',
        connectionState VARCHAR(80) NULL,
        healthScore INT NOT NULL DEFAULT 0,
        lastHeartbeatAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        payload MEDIUMTEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_distributed_chip_session (chipId),
        INDEX idx_distributed_owner (ownerNodeId),
        INDEX idx_distributed_status (sessionStatus)
      )
    `);
    _distributedChipSessionsTableEnsured = true;
  } catch (error) {
    console.warn("[DistributedChipSessions] Failed to ensure table:", error);
  }
}

async function ensureClusterBackupSnapshotsTable() {
  if (_clusterBackupSnapshotsTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS cluster_backup_snapshots (
        id INT AUTO_INCREMENT PRIMARY KEY,
        snapshotKey VARCHAR(191) NOT NULL,
        scope VARCHAR(80) NOT NULL DEFAULT 'cluster',
        status ENUM('ready', 'restored', 'failed') NOT NULL DEFAULT 'ready',
        payload MEDIUMTEXT NOT NULL,
        restoredAt TIMESTAMP NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_cluster_backup_snapshot (snapshotKey),
        INDEX idx_cluster_backup_scope (scope)
      )
    `);
    _clusterBackupSnapshotsTableEnsured = true;
  } catch (error) {
    console.warn("[ClusterBackupSnapshots] Failed to ensure table:", error);
  }
}

async function ensureChipHealthTable() {
  if (_chipHealthTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS chip_health (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        chipId INT NOT NULL UNIQUE,
        healthScore INT NOT NULL DEFAULT 0,
        reconnectCount INT NOT NULL DEFAULT 0,
        disconnectCount INT NOT NULL DEFAULT 0,
        lastDisconnect TIMESTAMP NULL,
        sessionAge INT NOT NULL DEFAULT 0,
        lastReceive TIMESTAMP NULL,
        lastSend TIMESTAMP NULL,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_chip_health_user (userId),
        INDEX idx_chip_health_score (healthScore)
      )
    `);
    _chipHealthTableEnsured = true;
  } catch (error) {
    console.warn("[ChipHealth] Failed to ensure table:", error);
  }
}

async function ensureChipBehaviorScoresTable() {
  if (_chipBehaviorScoresTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS chip_behavior_scores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        chipId INT NOT NULL UNIQUE,
        humanScore INT NOT NULL DEFAULT 0,
        riskScore INT NOT NULL DEFAULT 100,
        evidenceQuality INT NOT NULL DEFAULT 0,
        evidenceCoverage INT NOT NULL DEFAULT 0,
        evidenceNaturalness INT NOT NULL DEFAULT 0,
        evidenceDiversity INT NOT NULL DEFAULT 0,
        evidenceConsistency INT NOT NULL DEFAULT 0,
        evidenceSocialPresence INT NOT NULL DEFAULT 0,
        evidenceCoverageDetail MEDIUMTEXT NULL,
        sentCount INT NOT NULL DEFAULT 0,
        receivedCount INT NOT NULL DEFAULT 0,
        groupJoinCount INT NOT NULL DEFAULT 0,
        readCount INT NOT NULL DEFAULT 0,
        distinctConversations INT NOT NULL DEFAULT 0,
        activeMinutes INT NOT NULL DEFAULT 0,
        idleMinutes INT NOT NULL DEFAULT 0,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_chip_behavior_scores_user (userId),
        INDEX idx_chip_behavior_scores_human (humanScore),
        INDEX idx_chip_behavior_scores_risk (riskScore),
        INDEX idx_chip_behavior_scores_evidence_quality (evidenceQuality),
        INDEX idx_chip_behavior_scores_evidence_coverage (evidenceCoverage),
        INDEX idx_chip_behavior_scores_naturalness (evidenceNaturalness),
        INDEX idx_chip_behavior_scores_diversity (evidenceDiversity),
        INDEX idx_chip_behavior_scores_consistency (evidenceConsistency),
        INDEX idx_chip_behavior_scores_social_presence (evidenceSocialPresence)
      )
    `);
    try {
      await (db as any).execute?.(sql`
        ALTER TABLE chip_behavior_scores
        ADD COLUMN evidenceQuality INT NOT NULL DEFAULT 0
      `);
    } catch {}
    try {
      await (db as any).execute?.(sql`
        ALTER TABLE chip_behavior_scores
        ADD COLUMN evidenceNaturalness INT NOT NULL DEFAULT 0
      `);
    } catch {}
    try {
      await (db as any).execute?.(sql`
        ALTER TABLE chip_behavior_scores
        ADD COLUMN evidenceDiversity INT NOT NULL DEFAULT 0
      `);
    } catch {}
    try {
      await (db as any).execute?.(sql`
        ALTER TABLE chip_behavior_scores
        ADD COLUMN evidenceConsistency INT NOT NULL DEFAULT 0
      `);
    } catch {}
    try {
      await (db as any).execute?.(sql`
        ALTER TABLE chip_behavior_scores
        ADD COLUMN evidenceSocialPresence INT NOT NULL DEFAULT 0
      `);
    } catch {}
    try {
      await (db as any).execute?.(sql`
        ALTER TABLE chip_behavior_scores
        ADD COLUMN evidenceCoverage INT NOT NULL DEFAULT 0
      `);
    } catch {}
    try {
      await (db as any).execute?.(sql`
        ALTER TABLE chip_behavior_scores
        ADD COLUMN evidenceCoverageDetail MEDIUMTEXT NULL
      `);
    } catch {}
    _chipBehaviorScoresTableEnsured = true;
  } catch (error) {
    console.warn("[ChipBehaviorScores] Failed to ensure table:", error);
  }
}

async function ensureChipRiskStateTable() {
  if (_chipRiskStateTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS chip_risk_state (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        chipId INT NOT NULL UNIQUE,
        spamRisk INT NOT NULL DEFAULT 0,
        banRisk INT NOT NULL DEFAULT 0,
        humanScore INT NOT NULL DEFAULT 0,
        socialScore INT NOT NULL DEFAULT 0,
        routineScore INT NOT NULL DEFAULT 0,
        conversationScore INT NOT NULL DEFAULT 0,
        presenceScore INT NOT NULL DEFAULT 0,
        payload MEDIUMTEXT NULL,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_chip_risk_state_human (humanScore),
        INDEX idx_chip_risk_state_ban (banRisk)
      )
    `);
    _chipRiskStateTableEnsured = true;
  } catch (error) {
    console.warn("[ChipRiskState] Failed to ensure table:", error);
  }
}

async function ensureChipRoutineStateTable() {
  if (_chipRoutineStateTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS chip_routine_state (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        chipId INT NOT NULL UNIQUE,
        weekday INT NOT NULL DEFAULT 0,
        currentMode VARCHAR(60) NOT NULL DEFAULT 'idle',
        nextActionAt TIMESTAMP NULL,
        lastWindowStartedAt TIMESTAMP NULL,
        lastWindowEndedAt TIMESTAMP NULL,
        actionsToday INT NOT NULL DEFAULT 0,
        pausesToday INT NOT NULL DEFAULT 0,
        payload MEDIUMTEXT NULL,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_chip_routine_state_next (nextActionAt)
      )
    `);
    _chipRoutineStateTableEnsured = true;
  } catch (error) {
    console.warn("[ChipRoutineState] Failed to ensure table:", error);
  }
}

async function ensureChipIdentityEvolutionTable() {
  if (_chipIdentityEvolutionTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS chip_identity_evolution (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        chipId INT NOT NULL UNIQUE,
        generation INT NOT NULL DEFAULT 1,
        lastNameChangeAt TIMESTAMP NULL,
        lastAboutChangeAt TIMESTAMP NULL,
        lastPhotoChangeAt TIMESTAMP NULL,
        currentDisplayName VARCHAR(120) NULL,
        currentAbout TEXT NULL,
        currentPhotoAsset VARCHAR(255) NULL,
        payload MEDIUMTEXT NULL,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_chip_identity_generation (generation)
      )
    `);
    _chipIdentityEvolutionTableEnsured = true;
  } catch (error) {
    console.warn("[ChipIdentityEvolution] Failed to ensure table:", error);
  }
}

async function ensureChipCertificationStateTable() {
  if (_chipCertificationStateTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS chip_certification_state (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        chipId INT NOT NULL UNIQUE,
        maturityLevel INT NOT NULL DEFAULT 0,
        maturityLabel VARCHAR(60) NOT NULL DEFAULT 'Nível 0 - Novo',
        decision ENUM('APPROVED', 'BLOCKED') NOT NULL DEFAULT 'BLOCKED',
        humanScore INT NOT NULL DEFAULT 0,
        socialScore INT NOT NULL DEFAULT 0,
        routineScore INT NOT NULL DEFAULT 0,
        trustScore INT NOT NULL DEFAULT 0,
        spamRisk INT NOT NULL DEFAULT 0,
        banRisk INT NOT NULL DEFAULT 0,
        payload MEDIUMTEXT NULL,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_chip_certification_state_level (maturityLevel),
        INDEX idx_chip_certification_state_decision (decision)
      )
    `);
    _chipCertificationStateTableEnsured = true;
  } catch (error) {
    console.warn("[ChipCertificationState] Failed to ensure table:", error);
  }
}

async function ensureChipCertificationsTable() {
  if (_chipCertificationsTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS chip_certifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        chipId INT NOT NULL UNIQUE,
        status ENUM('NOVO', 'EM_MATURACAO', 'EM_OBSERVACAO', 'APROVADO', 'RESTRITO', 'REPROVADO') NOT NULL DEFAULT 'NOVO',
        usable INT NOT NULL DEFAULT 0,
        reason TEXT NULL,
        approvedAt TIMESTAMP NULL,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_chip_certifications_user (userId),
        INDEX idx_chip_certifications_status (status),
        INDEX idx_chip_certifications_usable (usable)
      )
    `);
    _chipCertificationsTableEnsured = true;
  } catch (error) {
    console.warn("[ChipCertifications] Failed to ensure table:", error);
  }
}

async function ensureChipPersonaTable() {
  if (_chipPersonaTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS chip_persona (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chipId INT NOT NULL UNIQUE,
        displayName VARCHAR(120) NOT NULL,
        homeState VARCHAR(60) NOT NULL,
        homeCity VARCHAR(120) NOT NULL,
        primaryDDD VARCHAR(4) NOT NULL,
        secondaryDDDs TEXT NULL,
        profession VARCHAR(120) NOT NULL,
        ageRange VARCHAR(40) NOT NULL,
        socialProfile VARCHAR(80) NOT NULL,
        wakeHour INT NOT NULL DEFAULT 8,
        sleepHour INT NOT NULL DEFAULT 22,
        weekendProfile VARCHAR(80) NOT NULL,
        interests TEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_chip_persona_chip (chipId),
        INDEX idx_chip_persona_primary_ddd (primaryDDD)
      )
    `);
    _chipPersonaTableEnsured = true;
  } catch (error) {
    console.warn("[ChipPersona] Failed to ensure table:", error);
  }
}

export async function ensureChipPersonaStorage() {
  await ensureChipPersonaTable();
}

async function ensureBehaviorDecisionLogTable() {
  if (_behaviorDecisionLogTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS behavior_decision_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        chipId INT NOT NULL,
        phase VARCHAR(32) NOT NULL,
        trustScore INT NULL,
        riskScore INT NULL,
        dailyBudgetUsed INT NOT NULL DEFAULT 0,
        dailyBudgetTotal INT NOT NULL DEFAULT 0,
        sessionId VARCHAR(191) NULL,
        requestedAction VARCHAR(64) NOT NULL,
        decision VARCHAR(32) NOT NULL,
        reason TEXT NOT NULL,
        delayMs INT NULL,
        nextCheckAt TIMESTAMP NULL,
        engineVersion VARCHAR(64) NOT NULL,
        policyFingerprint VARCHAR(128) NULL,
        checksJson MEDIUMTEXT NULL,
        contributorsJson MEDIUMTEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_behavior_decision_log_chip_created (chipId, createdAt),
        INDEX idx_behavior_decision_log_created (createdAt)
      )
    `);
    await (db as any).execute?.(sql`
      ALTER TABLE behavior_decision_log
      ADD COLUMN IF NOT EXISTS policyFingerprint VARCHAR(128) NULL
    `);
    _behaviorDecisionLogTableEnsured = true;
  } catch (error) {
    console.warn("[BehaviorDecisionLog] Failed to ensure table:", error);
  }
}

async function ensureBehaviorSnapshotsTable() {
  if (_behaviorSnapshotsTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS behavior_snapshots (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        chipId INT NOT NULL UNIQUE,
        phase VARCHAR(32) NOT NULL,
        trustScore INT NULL,
        riskScore INT NULL,
        dailyBudgetUsed INT NOT NULL DEFAULT 0,
        dailyBudgetTotal INT NOT NULL DEFAULT 0,
        inboundCount INT NOT NULL DEFAULT 0,
        outboundCount INT NOT NULL DEFAULT 0,
        sessionId VARCHAR(191) NULL,
        lastDecision VARCHAR(32) NULL,
        lastReason TEXT NULL,
        nextCheckAt TIMESTAMP NULL,
        engineVersion VARCHAR(64) NOT NULL,
        policyFingerprint VARCHAR(128) NULL,
        snapshotJson MEDIUMTEXT NULL,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_behavior_snapshots_phase (phase),
        INDEX idx_behavior_snapshots_updated (updatedAt)
      )
    `);
    await (db as any).execute?.(sql`
      ALTER TABLE behavior_snapshots
      ADD COLUMN IF NOT EXISTS policyFingerprint VARCHAR(128) NULL
    `);
    _behaviorSnapshotsTableEnsured = true;
  } catch (error) {
    console.warn("[BehaviorSnapshots] Failed to ensure table:", error);
  }
}

async function ensureBehaviorActionExecutionTable() {
  if (_behaviorActionExecutionTableEnsured) return;
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).execute?.(sql`
      CREATE TABLE IF NOT EXISTS behavior_action_execution (
        id VARCHAR(64) PRIMARY KEY,
        decisionId VARCHAR(64) NOT NULL,
        userId INT NOT NULL,
        chipId INT NOT NULL,
        requestedAction VARCHAR(64) NOT NULL,
        targetType ENUM('number', 'group', 'list', 'chip') NOT NULL,
        targetValue VARCHAR(255) NOT NULL,
        messageId VARCHAR(128) NULL,
        status ENUM('PENDING', 'SENDING', 'ACKED', 'FAILED', 'RETRYING') NOT NULL DEFAULT 'PENDING',
        budgetState ENUM('NOT_RESERVED', 'RESERVED', 'COMMITTED', 'RELEASED') NOT NULL DEFAULT 'NOT_RESERVED',
        attempt INT NOT NULL DEFAULT 1,
        recoverable INT NOT NULL DEFAULT 1,
        maxAttempts INT NOT NULL DEFAULT 3,
        nextRetryAt TIMESTAMP NULL,
        lastRetryAt TIMESTAMP NULL,
        payload TEXT NULL,
        error TEXT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sentAt TIMESTAMP NULL,
        ackAt TIMESTAMP NULL,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_behavior_action_execution_chip_created (chipId, createdAt),
        INDEX idx_behavior_action_execution_decision (decisionId),
        INDEX idx_behavior_action_execution_status (status)
      )
    `);
    await (db as any).execute?.(sql`
      ALTER TABLE behavior_action_execution
      MODIFY COLUMN status ENUM('PENDING', 'SENDING', 'ACKED', 'FAILED', 'RETRYING') NOT NULL DEFAULT 'PENDING'
    `);
    await (db as any).execute?.(sql`
      ALTER TABLE behavior_action_execution
      ADD COLUMN IF NOT EXISTS recoverable INT NOT NULL DEFAULT 1 AFTER attempt
    `);
    await (db as any).execute?.(sql`
      ALTER TABLE behavior_action_execution
      ADD COLUMN IF NOT EXISTS maxAttempts INT NOT NULL DEFAULT 3 AFTER recoverable
    `);
    await (db as any).execute?.(sql`
      ALTER TABLE behavior_action_execution
      ADD COLUMN IF NOT EXISTS nextRetryAt TIMESTAMP NULL AFTER maxAttempts
    `);
    await (db as any).execute?.(sql`
      ALTER TABLE behavior_action_execution
      ADD COLUMN IF NOT EXISTS lastRetryAt TIMESTAMP NULL AFTER nextRetryAt
    `);
    _behaviorActionExecutionTableEnsured = true;
  } catch (error) {
    console.warn("[BehaviorActionExecution] Failed to ensure table:", error);
  }
}

export async function createAdminAuditLog(params: {
  adminUserId: number;
  targetUserId?: number | null;
  entity: string;
  action: string;
  payload?: any;
}) {
  const db = await getDb();
  if (!db) return;

  await ensureAdminAuditLogsTable();

  try {
    await db.insert(adminAuditLogs).values({
      adminUserId: params.adminUserId,
      targetUserId: params.targetUserId ?? null,
      entity: params.entity,
      action: params.action,
      payload: params.payload ? JSON.stringify(params.payload) : null,
      createdAt: new Date(),
    });
  } catch (error) {
    // Não derruba o fluxo administrativo se auditoria falhar.
    console.warn("[AdminAudit] Failed to insert log:", error);
  }
}

export async function getAdminAuditLogs(limit = 100) {
  const db = await getDb();
  if (!db) return [];

  await ensureAdminAuditLogsTable();

  try {
    return await db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.id)).limit(limit);
  } catch (error) {
    console.warn("[AdminAudit] Failed to list logs:", error);
    return [];
  }
}

export async function updateSubscriptionPlan(
  planId: number,
  data: Partial<{
    planName: string;
    description: string;
    maxChips: number;
    maxMessagesPerMonth: number;
    maxScheduledTasks: number;
    priceMonthly: number;
    isActive: number;
  }>
) {
  const db = await getDb();
  if (!db) return null;

  try {
    return await db
      .update(subscriptionPlans)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(subscriptionPlans.id, planId));
  } catch (error) {
    console.error("[Database] Failed to update plan:", error);
    throw error;
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  await ensureUserProfileImageColumn();

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "profileImageUrl", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  await ensureUserProfileImageColumn();

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function ensureDefaultSubscriptionPlans() {
  const db = await getDb();
  if (!db) return [];

  const plans = [
    {
      planName: "Local",
      description: "Plano local para desenvolvimento e uso pessoal",
      maxChips: 50,
      maxMessagesPerMonth: -1,
      maxScheduledTasks: 100,
      priceMonthly: 0,
      priceYearly: 0,
      features: JSON.stringify([
        "Uso local",
        "Mensagens ilimitadas",
        "Até 50 chips",
        "Até 100 tarefas",
      ]),
      isActive: 1,
    },
    {
      planName: "Starter",
      description: "Plano inicial",
      maxChips: 10,
      maxMessagesPerMonth: 5000,
      maxScheduledTasks: 20,
      priceMonthly: 50,
      priceYearly: 500,
      features: JSON.stringify(["10 chips", "5.000 mensagens", "20 tarefas"]),
      isActive: 1,
    },
  ] as const;

  for (const plan of plans) {
    await db.insert(subscriptionPlans).values(plan).onDuplicateKeyUpdate({
      set: {
        description: plan.description,
        maxChips: plan.maxChips,
        maxMessagesPerMonth: plan.maxMessagesPerMonth,
        maxScheduledTasks: plan.maxScheduledTasks,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        features: plan.features,
        isActive: plan.isActive,
      },
    });
  }

  return await db.select().from(subscriptionPlans);
}

export async function ensureUserSubscriptionPlan(userId: number, preferredPlanName = "Local") {
  const db = await getDb();
  if (!db) return null;

  await ensureDefaultSubscriptionPlans();

  const existingSubscription = await getUserSubscription(userId);
  if (existingSubscription) {
    return existingSubscription;
  }

  const planResult = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.planName, preferredPlanName))
    .limit(1);

  const plan = planResult.length > 0 ? planResult[0] : null;
  if (!plan) return null;

  const now = new Date();
  const trialEndDate = new Date();
  trialEndDate.setFullYear(trialEndDate.getFullYear() + 1);

  await db.insert(userSubscriptions).values({
    userId,
    planId: plan.id,
    status: preferredPlanName === "Local" ? "active" : "trial",
    currentChipsCount: 0,
    currentMessagesThisMonth: 0,
    currentTasksCount: 0,
    subscriptionStartDate: now,
    subscriptionEndDate: preferredPlanName === "Local" ? null : undefined,
    trialEndDate,
    autoRenew: 1,
  });

  return await getUserSubscription(userId);
}

// ============================================
// RBAC & USER ISOLATION HELPERS
// ============================================

export async function getUserChips(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(whatsappChips).where(eq(whatsappChips.userId, userId));
}

export async function getAllChips() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(whatsappChips);
}

export async function getChipById(chipId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(whatsappChips).where(eq(whatsappChips.id, chipId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getUserActivityLogs(userId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(activityLogs).where(eq(activityLogs.userId, userId)).limit(limit);
}

export async function searchUserActivityLogs(filters: {
  userId: number;
  chipId?: number;
  actionType?: "message_sent" | "image_sent" | "audio_sent" | "reaction_sent" | "message_received" | "connection" | "disconnection" | "error";
  status?: "success" | "failed" | "pending";
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(activityLogs.userId, filters.userId)];

  if (filters.chipId) {
    conditions.push(eq(activityLogs.chipId, filters.chipId));
  }

  if (filters.actionType) {
    conditions.push(eq(activityLogs.actionType, filters.actionType));
  }

  if (filters.status) {
    conditions.push(eq(activityLogs.status, filters.status));
  }

  const search = filters.search?.trim();
  if (search) {
    conditions.push(
      or(
        like(activityLogs.messageContent, `%${search}%`),
        like(activityLogs.targetNumber, `%${search}%`),
        like(activityLogs.targetGroup, `%${search}%`),
        like(activityLogs.errorMessage, `%${search}%`)
      )!
    );
  }

  if (filters.dateFrom) {
    conditions.push(gte(activityLogs.createdAt, filters.dateFrom));
  }

  if (filters.dateTo) {
    conditions.push(lte(activityLogs.createdAt, filters.dateTo));
  }

  return db
    .select()
    .from(activityLogs)
    .where(and(...conditions))
    .orderBy(desc(activityLogs.createdAt))
    .limit(filters.limit ?? 100);
}

type BehaviorTimelineEventType =
  | "session_connected"
  | "contacts_synced"
  | "contact_added"
  | "profile_name_updated"
  | "profile_photo_updated"
  | "about_updated"
  | "group_created"
  | "group_left"
  | "wake_up"
  | "idle"
  | "status_viewed"
  | "chat_list_opened"
  | "sleep"
  | "presence_online"
  | "presence_offline"
  | "presence_reading"
  | "presence_typing"
  | "presence_recording"
  | "presence_away"
  | "message_sent"
  | "reaction_sent"
  | "contact_shared"
  | "message_acknowledged"
  | "message_received"
  | "group_joined"
  | "group_opened"
  | "participants_loaded"
  | "messages_read";

type BehaviorTimelineDirection = "inbound" | "outbound" | "system";
type CertificationStatus = "NOVO" | "EM_MATURACAO" | "EM_OBSERVACAO" | "APROVADO" | "RESTRITO" | "REPROVADO";

function parseBehaviorTimelinePayload(payload?: string | null) {
  if (!payload) return null;
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}

function parseBehaviorMemoryField(value?: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function createBehaviorTimelineEvent(data: {
  userId?: number;
  chipId: number;
  eventType: BehaviorTimelineEventType;
  source: string;
  direction?: BehaviorTimelineDirection | null;
  remoteJid?: string | null;
  remoteType?: "number" | "group" | "broadcast" | "unknown" | null;
  remoteLabel?: string | null;
  messageId?: string | null;
  relatedMessageId?: string | null;
  ackType?: string | null;
  groupJid?: string | null;
  groupSubject?: string | null;
  contentPreview?: string | null;
  payload?: unknown;
  occurredAt?: Date;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureBehaviorTimelineTable();

  try {
    let userId = data.userId;
    if (!userId) {
      const chip = await db.select().from(whatsappChips).where(eq(whatsappChips.id, data.chipId)).limit(1);
      if (chip.length > 0) {
        userId = chip[0].userId;
      }
    }

    if (!userId) {
      throw new Error("Cannot create behavior timeline event without userId");
    }

    return await db.insert(behaviorTimelineEvents).values({
      userId,
      chipId: data.chipId,
      eventType: data.eventType,
      source: data.source,
      direction: data.direction ?? null,
      remoteJid: data.remoteJid ?? null,
      remoteType: data.remoteType ?? null,
      remoteLabel: data.remoteLabel ?? null,
      messageId: data.messageId ?? null,
      relatedMessageId: data.relatedMessageId ?? null,
      ackType: data.ackType ?? null,
      groupJid: data.groupJid ?? null,
      groupSubject: data.groupSubject ?? null,
      contentPreview: data.contentPreview ?? null,
      payload: data.payload === undefined ? null : JSON.stringify(data.payload),
      occurredAt: data.occurredAt ?? new Date(),
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("[Database] Failed to create behavior timeline event:", error);
    throw error;
  }
}

export async function listBehaviorTimelineEvents(filters: {
  userId: number;
  chipId?: number;
  eventType?: BehaviorTimelineEventType;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  await ensureBehaviorTimelineTable();

  const conditions = [eq(behaviorTimelineEvents.userId, filters.userId)];

  if (filters.chipId) {
    conditions.push(eq(behaviorTimelineEvents.chipId, filters.chipId));
  }

  if (filters.eventType) {
    conditions.push(eq(behaviorTimelineEvents.eventType, filters.eventType));
  }

  if (filters.dateFrom) {
    conditions.push(gte(behaviorTimelineEvents.occurredAt, filters.dateFrom));
  }

  if (filters.dateTo) {
    conditions.push(lte(behaviorTimelineEvents.occurredAt, filters.dateTo));
  }

  const rows = await db
    .select()
    .from(behaviorTimelineEvents)
    .where(and(...conditions))
    .orderBy(desc(behaviorTimelineEvents.occurredAt), desc(behaviorTimelineEvents.id))
    .limit(filters.limit ?? 200);

  return rows.map((row) => ({
    ...row,
    payload: parseBehaviorTimelinePayload(row.payload),
  }));
}

export async function createBehaviorMemorySnapshot(data: {
  userId: number;
  chipId: number;
  windowStart: Date;
  windowEnd: Date;
  sampleDays?: number;
  firstActionAt?: Date | null;
  lastActionAt?: Date | null;
  totalActions?: number;
  distinctActionTypes?: number;
  repetitionScore?: number;
  variationScore?: number;
  actionSequence?: unknown;
  activeHourBuckets?: unknown;
  responseDelayBuckets?: unknown;
  idleWindows?: unknown;
  patternSignature?: string | null;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureBehaviorMemoryTable();

  return db.insert(behaviorMemorySnapshots).values({
    userId: data.userId,
    chipId: data.chipId,
    windowStart: data.windowStart,
    windowEnd: data.windowEnd,
    sampleDays: data.sampleDays ?? 1,
    firstActionAt: data.firstActionAt ?? null,
    lastActionAt: data.lastActionAt ?? null,
    totalActions: data.totalActions ?? 0,
    distinctActionTypes: data.distinctActionTypes ?? 0,
    repetitionScore: data.repetitionScore ?? 0,
    variationScore: data.variationScore ?? 0,
    actionSequence: data.actionSequence === undefined ? null : JSON.stringify(data.actionSequence),
    activeHourBuckets: data.activeHourBuckets === undefined ? null : JSON.stringify(data.activeHourBuckets),
    responseDelayBuckets: data.responseDelayBuckets === undefined ? null : JSON.stringify(data.responseDelayBuckets),
    idleWindows: data.idleWindows === undefined ? null : JSON.stringify(data.idleWindows),
    patternSignature: data.patternSignature ?? null,
    payload: data.payload === undefined ? null : JSON.stringify(data.payload),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function listBehaviorMemorySnapshots(filters: {
  userId: number;
  chipId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  await ensureBehaviorMemoryTable();

  const conditions = [eq(behaviorMemorySnapshots.userId, filters.userId)];

  if (filters.chipId) {
    conditions.push(eq(behaviorMemorySnapshots.chipId, filters.chipId));
  }

  if (filters.dateFrom) {
    conditions.push(gte(behaviorMemorySnapshots.windowStart, filters.dateFrom));
  }

  if (filters.dateTo) {
    conditions.push(lte(behaviorMemorySnapshots.windowEnd, filters.dateTo));
  }

  const rows = await db
    .select()
    .from(behaviorMemorySnapshots)
    .where(and(...conditions))
    .orderBy(desc(behaviorMemorySnapshots.windowEnd), desc(behaviorMemorySnapshots.id))
    .limit(filters.limit ?? 30);

  return rows.map((row) => ({
    ...row,
    actionSequence: parseBehaviorMemoryField(row.actionSequence),
    activeHourBuckets: parseBehaviorMemoryField(row.activeHourBuckets),
    responseDelayBuckets: parseBehaviorMemoryField(row.responseDelayBuckets),
    idleWindows: parseBehaviorMemoryField(row.idleWindows),
    payload: parseBehaviorMemoryField(row.payload),
  }));
}

export async function createBehaviorOutcome(data: {
  userId: number;
  chipId: number;
  observationWindowStart: Date;
  observationWindowEnd: Date;
  predictedRisk: number;
  predictedCredibility: number;
  actualOutcome?: "unknown" | "healthy" | "warning" | "restriction" | "ban";
  restrictionOccurred?: boolean;
  warningOccurred?: boolean;
  banOccurred?: boolean;
  humanLikeOutcome?: "unknown" | "human_like" | "not_human_like" | "uncertain";
  validatedAt?: Date | null;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureBehaviorOutcomesTable();

  return db.insert(behaviorOutcomes).values({
    userId: data.userId,
    chipId: data.chipId,
    observationWindowStart: data.observationWindowStart,
    observationWindowEnd: data.observationWindowEnd,
    predictedRisk: data.predictedRisk,
    predictedCredibility: data.predictedCredibility,
    actualOutcome: data.actualOutcome ?? "unknown",
    restrictionOccurred: data.restrictionOccurred ? 1 : 0,
    warningOccurred: data.warningOccurred ? 1 : 0,
    banOccurred: data.banOccurred ? 1 : 0,
    humanLikeOutcome: data.humanLikeOutcome ?? "unknown",
    validatedAt: data.validatedAt ?? null,
    payload: data.payload === undefined ? null : JSON.stringify(data.payload),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function listBehaviorOutcomes(filters: {
  userId: number;
  chipId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  await ensureBehaviorOutcomesTable();

  const conditions = [eq(behaviorOutcomes.userId, filters.userId)];
  if (filters.chipId) conditions.push(eq(behaviorOutcomes.chipId, filters.chipId));
  if (filters.dateFrom) conditions.push(gte(behaviorOutcomes.observationWindowStart, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(behaviorOutcomes.observationWindowEnd, filters.dateTo));

  const rows = await db
    .select()
    .from(behaviorOutcomes)
    .where(and(...conditions))
    .orderBy(desc(behaviorOutcomes.observationWindowEnd), desc(behaviorOutcomes.id))
    .limit(filters.limit ?? 200);

  return rows.map((row) => ({
    ...row,
    restrictionOccurred: Boolean(row.restrictionOccurred),
    warningOccurred: Boolean(row.warningOccurred),
    banOccurred: Boolean(row.banOccurred),
    payload: parseBehaviorMemoryField(row.payload),
  }));
}

export async function createBehaviorOpportunityObservation(data: {
  userId: number;
  chipId: number;
  opportunityId: string;
  observedAt?: Date;
  reason: string;
  riskAtDecision: number;
  confidence: number;
  expectedGain: number;
  expectedRisk: number;
  decision?: "ACT_NOW" | "WAIT" | "DO_NOTHING";
  observedResultAfter24h?: string | null;
  observedResultAfter72h?: string | null;
  observedResultAfter7d?: string | null;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureBehaviorOpportunityObservationsTable();

  return db.insert(behaviorOpportunityObservations).values({
    userId: data.userId,
    chipId: data.chipId,
    opportunityId: data.opportunityId,
    observedAt: data.observedAt ?? new Date(),
    reason: data.reason,
    riskAtDecision: data.riskAtDecision,
    confidence: data.confidence,
    expectedGain: data.expectedGain,
    expectedRisk: data.expectedRisk,
    decision: data.decision ?? "DO_NOTHING",
    observedResultAfter24h: data.observedResultAfter24h ?? null,
    observedResultAfter72h: data.observedResultAfter72h ?? null,
    observedResultAfter7d: data.observedResultAfter7d ?? null,
    payload: data.payload === undefined ? null : JSON.stringify(data.payload),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function listBehaviorOpportunityObservations(filters: {
  userId: number;
  chipId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  await ensureBehaviorOpportunityObservationsTable();

  const conditions = [eq(behaviorOpportunityObservations.userId, filters.userId)];
  if (filters.chipId) conditions.push(eq(behaviorOpportunityObservations.chipId, filters.chipId));
  if (filters.dateFrom) conditions.push(gte(behaviorOpportunityObservations.observedAt, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(behaviorOpportunityObservations.observedAt, filters.dateTo));

  const rows = await db
    .select()
    .from(behaviorOpportunityObservations)
    .where(and(...conditions))
    .orderBy(desc(behaviorOpportunityObservations.observedAt), desc(behaviorOpportunityObservations.id))
    .limit(filters.limit ?? 200);

  return rows.map((row) => ({
    ...row,
    payload: parseBehaviorMemoryField(row.payload),
  }));
}

export async function createMaturationExperienceJournalEntry(data: {
  userId: number;
  chipId: number;
  chapterId: string;
  chapterType?: "snapshot" | "opportunity" | "recovery" | "silence";
  observedAt?: Date;
  contextHash?: string | null;
  strategyChosen?: string | null;
  actionTaken?: string | null;
  riskBefore: number;
  riskAfter: number;
  credibilityBefore: number;
  credibilityAfter: number;
  outcome24h?: string | null;
  outcome72h?: string | null;
  outcome7d?: string | null;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureMaturationExperienceJournalTable();

  return db.insert(maturationExperienceJournal).values({
    userId: data.userId,
    chipId: data.chipId,
    chapterId: data.chapterId,
    chapterType: data.chapterType ?? "snapshot",
    observedAt: data.observedAt ?? new Date(),
    contextHash: data.contextHash ?? null,
    strategyChosen: data.strategyChosen ?? null,
    actionTaken: data.actionTaken ?? null,
    riskBefore: data.riskBefore,
    riskAfter: data.riskAfter,
    credibilityBefore: data.credibilityBefore,
    credibilityAfter: data.credibilityAfter,
    outcome24h: data.outcome24h ?? null,
    outcome72h: data.outcome72h ?? null,
    outcome7d: data.outcome7d ?? null,
    payload: data.payload === undefined ? null : JSON.stringify(data.payload),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function listMaturationExperienceJournal(filters: {
  userId: number;
  chipId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  await ensureMaturationExperienceJournalTable();

  const conditions = [eq(maturationExperienceJournal.userId, filters.userId)];
  if (filters.chipId) conditions.push(eq(maturationExperienceJournal.chipId, filters.chipId));
  if (filters.dateFrom) conditions.push(gte(maturationExperienceJournal.observedAt, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(maturationExperienceJournal.observedAt, filters.dateTo));

  const rows = await db
    .select()
    .from(maturationExperienceJournal)
    .where(and(...conditions))
    .orderBy(desc(maturationExperienceJournal.observedAt), desc(maturationExperienceJournal.id))
    .limit(filters.limit ?? 200);

  return rows.map((row) => ({
    ...row,
    payload: parseBehaviorMemoryField(row.payload),
  }));
}

export async function upsertRelationshipMemory(data: {
  userId: number;
  chipId: number;
  counterpartKey: string;
  counterpartType?: "contact" | "group" | "unknown";
  stage?: "unknown" | "known" | "trust" | "recurring" | "inactive";
  firstInteractionAt?: Date | null;
  lastInteractionAt?: Date | null;
  trustScore: number;
  relationshipRisk: number;
  idealContactFrequencyHours: number;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureRelationshipMemoriesTable();

  return db
    .insert(relationshipMemories)
    .values({
      userId: data.userId,
      chipId: data.chipId,
      counterpartKey: data.counterpartKey,
      counterpartType: data.counterpartType ?? "unknown",
      stage: data.stage ?? "unknown",
      firstInteractionAt: data.firstInteractionAt ?? null,
      lastInteractionAt: data.lastInteractionAt ?? null,
      trustScore: data.trustScore,
      relationshipRisk: data.relationshipRisk,
      idealContactFrequencyHours: data.idealContactFrequencyHours,
      payload: data.payload === undefined ? null : JSON.stringify(data.payload),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        counterpartType: data.counterpartType ?? "unknown",
        stage: data.stage ?? "unknown",
        firstInteractionAt: data.firstInteractionAt ?? null,
        lastInteractionAt: data.lastInteractionAt ?? null,
        trustScore: data.trustScore,
        relationshipRisk: data.relationshipRisk,
        idealContactFrequencyHours: data.idealContactFrequencyHours,
        payload: data.payload === undefined ? null : JSON.stringify(data.payload),
        updatedAt: new Date(),
      },
    });
}

export async function listRelationshipMemories(filters: {
  userId: number;
  chipId?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  await ensureRelationshipMemoriesTable();

  const conditions = [eq(relationshipMemories.userId, filters.userId)];
  if (filters.chipId) conditions.push(eq(relationshipMemories.chipId, filters.chipId));

  const rows = await db
    .select()
    .from(relationshipMemories)
    .where(and(...conditions))
    .orderBy(desc(relationshipMemories.lastInteractionAt), desc(relationshipMemories.id))
    .limit(filters.limit ?? 500);

  return rows.map((row) => ({
    ...row,
    payload: parseBehaviorMemoryField(row.payload),
  }));
}

export async function upsertChipGroup(data: {
  userId: number;
  chipId: number;
  groupJid: string;
  groupName?: string | null;
  origin?: "internal" | "manual_invite" | "catalog" | "runtime_discovery";
  category?: string | null;
  joinedAt?: Date | null;
  leftAt?: Date | null;
  lastInteraction?: Date | null;
  role?: string | null;
  status?: "candidate" | "joined" | "left" | "blocked";
  inviteLink?: string | null;
  risk?: number;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureChipGroupsTable();
  return db.insert(chipGroups).values({
    userId: data.userId,
    chipId: data.chipId,
    groupJid: data.groupJid,
    groupName: data.groupName ?? null,
    origin: data.origin ?? "runtime_discovery",
    category: data.category ?? null,
    joinedAt: data.joinedAt ?? null,
    leftAt: data.leftAt ?? null,
    lastInteraction: data.lastInteraction ?? null,
    role: data.role ?? "member",
    status: data.status ?? "candidate",
    inviteLink: data.inviteLink ?? null,
    risk: data.risk ?? 0,
    payload: data.payload === undefined ? null : JSON.stringify(data.payload),
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      groupName: data.groupName ?? null,
      origin: data.origin ?? "runtime_discovery",
      category: data.category ?? null,
      joinedAt: data.joinedAt ?? null,
      leftAt: data.leftAt ?? null,
      lastInteraction: data.lastInteraction ?? null,
      role: data.role ?? "member",
      status: data.status ?? "candidate",
      inviteLink: data.inviteLink ?? null,
      risk: data.risk ?? 0,
      payload: data.payload === undefined ? null : JSON.stringify(data.payload),
      updatedAt: new Date(),
    },
  });
}

export async function listChipGroupsForChip(chipId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];

  await ensureChipGroupsTable();
  const rows = await db
    .select()
    .from(chipGroups)
    .where(and(eq(chipGroups.chipId, chipId), eq(chipGroups.userId, userId)))
    .orderBy(desc(chipGroups.updatedAt));

  return rows.map((row) => ({
    ...row,
    payload: parseBehaviorMemoryField(row.payload),
  }));
}

export async function listGroupCatalogEntries(filters?: {
  userId?: number;
  activeOnly?: boolean;
  ddd?: string;
  city?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  await ensureGroupCatalogTable();
  const conditions = [];
  if (filters?.userId !== undefined) {
    conditions.push(or(eq(groupCatalog.userId, filters.userId), sql`${groupCatalog.userId} IS NULL`)!);
  }
  if (filters?.activeOnly) {
    conditions.push(eq(groupCatalog.active, 1));
  }
  if (filters?.ddd) {
    conditions.push(eq(groupCatalog.ddd, filters.ddd));
  }
  if (filters?.city) {
    conditions.push(like(groupCatalog.city, filters.city));
  }

  const query = db.select().from(groupCatalog);
  const rows = conditions.length > 0 ? await query.where(and(...conditions)).orderBy(desc(groupCatalog.updatedAt)) : await query.orderBy(desc(groupCatalog.updatedAt));
  return rows;
}

export async function createGroupCatalogEntry(data: {
  userId?: number | null;
  category: string;
  city?: string | null;
  ddd?: string | null;
  link?: string | null;
  active?: number;
  risk?: number;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureGroupCatalogTable();
  return db.insert(groupCatalog).values({
    userId: data.userId ?? null,
    category: data.category,
    city: data.city ?? null,
    ddd: data.ddd ?? null,
    link: data.link ?? null,
    active: data.active ?? 1,
    risk: data.risk ?? 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function upsertChipRelationship(data: {
  userId: number;
  chipId: number;
  contact: string;
  interactions: number;
  lastSeen?: Date | null;
  trustScore?: number;
  conversationLevel?: number;
  firstInteraction?: Date | null;
  lastInteraction?: Date | null;
  favorite?: boolean | number;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureChipRelationshipsTable();
  return db.insert(chipRelationships).values({
    userId: data.userId,
    chipId: data.chipId,
    contact: data.contact,
    interactions: data.interactions,
    lastSeen: data.lastSeen ?? null,
    trustScore: data.trustScore ?? 0,
    conversationLevel: data.conversationLevel ?? 0,
    firstInteraction: data.firstInteraction ?? null,
    lastInteraction: data.lastInteraction ?? null,
    favorite: Number(data.favorite ?? 0),
    payload: data.payload === undefined ? null : JSON.stringify(data.payload),
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      interactions: data.interactions,
      lastSeen: data.lastSeen ?? null,
      trustScore: data.trustScore ?? 0,
      conversationLevel: data.conversationLevel ?? 0,
      firstInteraction: data.firstInteraction ?? null,
      lastInteraction: data.lastInteraction ?? null,
      favorite: Number(data.favorite ?? 0),
      payload: data.payload === undefined ? null : JSON.stringify(data.payload),
      updatedAt: new Date(),
    },
  });
}

export async function listChipRelationships(chipId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];

  await ensureChipRelationshipsTable();
  const rows = await db
    .select()
    .from(chipRelationships)
    .where(and(eq(chipRelationships.chipId, chipId), eq(chipRelationships.userId, userId)))
    .orderBy(desc(chipRelationships.trustScore), desc(chipRelationships.lastInteraction));

  return rows.map((row) => ({
    ...row,
    payload: parseBehaviorMemoryField(row.payload),
  }));
}

export async function upsertChipSocialGraphEntry(data: {
  userId: number;
  chipId: number;
  entityType: "contact" | "group";
  entityId: string;
  label?: string | null;
  trust?: number;
  interactionCount?: number;
  lastSeen?: Date | null;
  relationshipLevel?: number;
  favorite?: boolean | number;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureChipSocialGraphTable();
  return db.insert(chipSocialGraph).values({
    userId: data.userId,
    chipId: data.chipId,
    entityType: data.entityType,
    entityId: data.entityId,
    label: data.label ?? null,
    trust: data.trust ?? 0,
    interactionCount: data.interactionCount ?? 0,
    lastSeen: data.lastSeen ?? null,
    relationshipLevel: data.relationshipLevel ?? 0,
    favorite: Number(data.favorite ?? 0),
    payload: data.payload === undefined ? null : JSON.stringify(data.payload),
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      label: data.label ?? null,
      trust: data.trust ?? 0,
      interactionCount: data.interactionCount ?? 0,
      lastSeen: data.lastSeen ?? null,
      relationshipLevel: data.relationshipLevel ?? 0,
      favorite: Number(data.favorite ?? 0),
      payload: data.payload === undefined ? null : JSON.stringify(data.payload),
      updatedAt: new Date(),
    },
  });
}

export async function listChipSocialGraph(chipId: number, userId: number, entityType?: "contact" | "group") {
  const db = await getDb();
  if (!db) return [];

  await ensureChipSocialGraphTable();
  const conditions = [eq(chipSocialGraph.chipId, chipId), eq(chipSocialGraph.userId, userId)];
  if (entityType) conditions.push(eq(chipSocialGraph.entityType, entityType));

  const rows = await db
    .select()
    .from(chipSocialGraph)
    .where(and(...conditions))
    .orderBy(desc(chipSocialGraph.trust), desc(chipSocialGraph.updatedAt));

  return rows.map((row) => ({
    ...row,
    payload: parseBehaviorMemoryField(row.payload),
  }));
}

export async function upsertChipLearningMetric(data: {
  userId: number;
  chipId: number;
  actionKey: string;
  successCount: number;
  failureCount: number;
  successRate: number;
  failureRate: number;
  averageResponse: number;
  averageDelay: number;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureChipLearningMetricsTable();
  return db.insert(chipLearningMetrics).values({
    userId: data.userId,
    chipId: data.chipId,
    actionKey: data.actionKey,
    successCount: data.successCount,
    failureCount: data.failureCount,
    successRate: data.successRate,
    failureRate: data.failureRate,
    averageResponse: data.averageResponse,
    averageDelay: data.averageDelay,
    payload: data.payload === undefined ? null : JSON.stringify(data.payload),
    updatedAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      successCount: data.successCount,
      failureCount: data.failureCount,
      successRate: data.successRate,
      failureRate: data.failureRate,
      averageResponse: data.averageResponse,
      averageDelay: data.averageDelay,
      payload: data.payload === undefined ? null : JSON.stringify(data.payload),
      updatedAt: new Date(),
    },
  });
}

export async function listChipLearningMetrics(chipId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];

  await ensureChipLearningMetricsTable();
  const rows = await db
    .select()
    .from(chipLearningMetrics)
    .where(and(eq(chipLearningMetrics.chipId, chipId), eq(chipLearningMetrics.userId, userId)))
    .orderBy(desc(chipLearningMetrics.successRate), desc(chipLearningMetrics.updatedAt));

  return rows.map((row) => ({
    ...row,
    payload: parseBehaviorMemoryField(row.payload),
  }));
}

export async function upsertLearningHypothesis(data: {
  userId: number;
  hypothesisKey: string;
  status: "draft" | "candidate" | "validated" | "knowledge" | "deprecated" | "archived";
  title: string;
  confidence: number;
  sampleSize: number;
  successRate: number;
  contradictionRate: number;
  temporalStability: number;
  segmentConsistency: number;
  lastValidatedAt?: Date | null;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureLearningHypothesesTable();

  return db
    .insert(learningHypotheses)
    .values({
      userId: data.userId,
      hypothesisKey: data.hypothesisKey,
      status: data.status,
      title: data.title,
      confidence: data.confidence,
      sampleSize: data.sampleSize,
      successRate: data.successRate,
      contradictionRate: data.contradictionRate,
      temporalStability: data.temporalStability,
      segmentConsistency: data.segmentConsistency,
      lastValidatedAt: data.lastValidatedAt ?? null,
      payload: data.payload === undefined ? null : JSON.stringify(data.payload),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        status: data.status,
        title: data.title,
        confidence: data.confidence,
        sampleSize: data.sampleSize,
        successRate: data.successRate,
        contradictionRate: data.contradictionRate,
        temporalStability: data.temporalStability,
        segmentConsistency: data.segmentConsistency,
        lastValidatedAt: data.lastValidatedAt ?? null,
        payload: data.payload === undefined ? null : JSON.stringify(data.payload),
        updatedAt: new Date(),
      },
    });
}

export async function listLearningHypotheses(filters: {
  userId: number;
  status?: "draft" | "candidate" | "validated" | "knowledge" | "deprecated" | "archived";
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  await ensureLearningHypothesesTable();

  const conditions = [eq(learningHypotheses.userId, filters.userId)];
  if (filters.status) conditions.push(eq(learningHypotheses.status, filters.status));

  const rows = await db
    .select()
    .from(learningHypotheses)
    .where(and(...conditions))
    .orderBy(desc(learningHypotheses.updatedAt), desc(learningHypotheses.id))
    .limit(filters.limit ?? 300);

  return rows.map((row) => ({
    ...row,
    payload: parseBehaviorMemoryField(row.payload),
  }));
}

export async function upsertKnowledgeBaseItem(data: {
  userId: number;
  knowledgeKey: string;
  sourceHypothesisKey?: string | null;
  status: "candidate" | "active" | "decaying" | "retired" | "archived";
  title: string;
  confidence: number;
  usageCount: number;
  successRate: number;
  decayRate: number;
  expiresAt?: Date | null;
  lastValidatedAt?: Date | null;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureKnowledgeBaseItemsTable();

  return db
    .insert(knowledgeBaseItems)
    .values({
      userId: data.userId,
      knowledgeKey: data.knowledgeKey,
      sourceHypothesisKey: data.sourceHypothesisKey ?? null,
      status: data.status,
      title: data.title,
      confidence: data.confidence,
      usageCount: data.usageCount,
      successRate: data.successRate,
      decayRate: data.decayRate,
      expiresAt: data.expiresAt ?? null,
      lastValidatedAt: data.lastValidatedAt ?? null,
      payload: data.payload === undefined ? null : JSON.stringify(data.payload),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        sourceHypothesisKey: data.sourceHypothesisKey ?? null,
        status: data.status,
        title: data.title,
        confidence: data.confidence,
        usageCount: data.usageCount,
        successRate: data.successRate,
        decayRate: data.decayRate,
        expiresAt: data.expiresAt ?? null,
        lastValidatedAt: data.lastValidatedAt ?? null,
        payload: data.payload === undefined ? null : JSON.stringify(data.payload),
        updatedAt: new Date(),
      },
    });
}

export async function listKnowledgeBaseItems(filters: {
  userId: number;
  status?: "candidate" | "active" | "decaying" | "retired" | "archived";
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  await ensureKnowledgeBaseItemsTable();

  const conditions = [eq(knowledgeBaseItems.userId, filters.userId)];
  if (filters.status) conditions.push(eq(knowledgeBaseItems.status, filters.status));

  const rows = await db
    .select()
    .from(knowledgeBaseItems)
    .where(and(...conditions))
    .orderBy(desc(knowledgeBaseItems.updatedAt), desc(knowledgeBaseItems.id))
    .limit(filters.limit ?? 300);

  return rows.map((row) => ({
    ...row,
    payload: parseBehaviorMemoryField(row.payload),
  }));
}

export async function createLearningEngineEvent(data: {
  userId: number;
  chipId?: number | null;
  eventType: "observed" | "validated" | "promoted" | "revalidated" | "retired" | "contradicted";
  referenceKey: string;
  observedAt?: Date;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureLearningEngineEventsTable();

  return db.insert(learningEngineEvents).values({
    userId: data.userId,
    chipId: data.chipId ?? null,
    eventType: data.eventType,
    referenceKey: data.referenceKey,
    observedAt: data.observedAt ?? new Date(),
    payload: data.payload === undefined ? null : JSON.stringify(data.payload),
    createdAt: new Date(),
  });
}

export async function createEcosystemEvent(data: {
  userId: number;
  sourceChipId?: number | null;
  targetChipId?: number | null;
  eventType: string;
  referenceKey: string;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureEcosystemEventsTable();
  return db.insert(ecosystemEvents).values({
    userId: data.userId,
    sourceChipId: data.sourceChipId ?? null,
    targetChipId: data.targetChipId ?? null,
    eventType: data.eventType,
    referenceKey: data.referenceKey,
    payload: data.payload === undefined ? null : JSON.stringify(data.payload),
    createdAt: new Date(),
  });
}

export async function listEcosystemEvents(filters: {
  userId: number;
  sourceChipId?: number;
  targetChipId?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  await ensureEcosystemEventsTable();
  const conditions = [eq(ecosystemEvents.userId, filters.userId)];
  if (filters.sourceChipId) conditions.push(eq(ecosystemEvents.sourceChipId, filters.sourceChipId));
  if (filters.targetChipId) conditions.push(eq(ecosystemEvents.targetChipId, filters.targetChipId));

  const rows = await db
    .select()
    .from(ecosystemEvents)
    .where(and(...conditions))
    .orderBy(desc(ecosystemEvents.createdAt), desc(ecosystemEvents.id))
    .limit(filters.limit ?? 300);

  return rows.map((row) => ({
    ...row,
    payload: parseBehaviorMemoryField(row.payload),
  }));
}

export async function upsertWorkerHeartbeat(data: {
  workerId: string;
  runtime: string;
  hostname: string;
  pid: number;
  queueName: string;
  status: "starting" | "running" | "degraded" | "stopped";
  metadata?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureWorkerHeartbeatsTable();
  return db.insert(workerHeartbeats).values({
    workerId: data.workerId,
    runtime: data.runtime,
    hostname: data.hostname,
    pid: data.pid,
    queueName: data.queueName,
    status: data.status,
    lastHeartbeatAt: new Date(),
    startedAt: new Date(),
    payload: data.metadata === undefined ? null : JSON.stringify(data.metadata),
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      runtime: data.runtime,
      hostname: data.hostname,
      pid: data.pid,
      queueName: data.queueName,
      status: data.status,
      lastHeartbeatAt: new Date(),
      payload: data.metadata === undefined ? null : JSON.stringify(data.metadata),
      updatedAt: new Date(),
    },
  });
}

export async function listWorkerHeartbeats(filters?: {
  runtime?: string;
  status?: "starting" | "running" | "degraded" | "stopped";
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  await ensureWorkerHeartbeatsTable();
  const conditions = [];
  if (filters?.runtime) conditions.push(eq(workerHeartbeats.runtime, filters.runtime));
  if (filters?.status) conditions.push(eq(workerHeartbeats.status, filters.status));

  const query = db.select().from(workerHeartbeats);
  const rows =
    conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(workerHeartbeats.updatedAt)).limit(filters?.limit ?? 100)
      : await query.orderBy(desc(workerHeartbeats.updatedAt)).limit(filters?.limit ?? 100);

  return rows.map((row) => ({
    ...row,
    payload: parseBehaviorMemoryField(row.payload),
  }));
}

export type SystemConfigValueType = "string" | "number" | "boolean" | "json";

export async function upsertSystemConfig(data: {
  configKey: string;
  valueType: SystemConfigValueType;
  valueText?: string | null;
  valueNumber?: number | null;
  valueBoolean?: boolean | number | null;
  description?: string | null;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureSystemConfigsTable();
  return db.insert(systemConfigs).values({
    configKey: data.configKey,
    valueType: data.valueType,
    valueText: data.valueText ?? null,
    valueNumber: data.valueNumber ?? null,
    valueBoolean: data.valueBoolean === undefined || data.valueBoolean === null ? null : Number(data.valueBoolean),
    description: data.description ?? null,
    payload: data.payload === undefined ? null : JSON.stringify(data.payload),
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      valueType: data.valueType,
      valueText: data.valueText ?? null,
      valueNumber: data.valueNumber ?? null,
      valueBoolean: data.valueBoolean === undefined || data.valueBoolean === null ? null : Number(data.valueBoolean),
      description: data.description ?? null,
      payload: data.payload === undefined ? null : JSON.stringify(data.payload),
      updatedAt: new Date(),
    },
  });
}

export async function getSystemConfigByKey(configKey: string) {
  const db = await getDb();
  if (!db) return null;

  await ensureSystemConfigsTable();
  const rows = await db.select().from(systemConfigs).where(eq(systemConfigs.configKey, configKey)).limit(1);
  if (!rows.length) return null;

  return {
    ...rows[0],
    payload: parseBehaviorMemoryField(rows[0].payload),
  };
}

export async function listSystemConfigs(limit = 200) {
  const db = await getDb();
  if (!db) return [];

  await ensureSystemConfigsTable();
  const rows = await db.select().from(systemConfigs).orderBy(desc(systemConfigs.updatedAt)).limit(limit);
  return rows.map((row) => ({
    ...row,
    payload: parseBehaviorMemoryField(row.payload),
  }));
}

export type AuditEventResult = "success" | "failed" | "skipped";

export async function createAuditEvent(data: {
  userId?: number | null;
  chipId?: number | null;
  engine: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  beforeState?: unknown;
  afterState?: unknown;
  result?: AuditEventResult;
  errorMessage?: string | null;
  durationMs?: number | null;
  workerId?: string | null;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureAuditEventsTable();
  return db.insert(auditEvents).values({
    userId: data.userId ?? null,
    chipId: data.chipId ?? null,
    engine: data.engine,
    action: data.action,
    entityType: data.entityType ?? null,
    entityId: data.entityId ?? null,
    beforeState: data.beforeState === undefined ? null : JSON.stringify(data.beforeState),
    afterState: data.afterState === undefined ? null : JSON.stringify(data.afterState),
    result: data.result ?? "success",
    errorMessage: data.errorMessage ?? null,
    durationMs: data.durationMs ?? null,
    workerId: data.workerId ?? null,
    payload: data.payload === undefined ? null : JSON.stringify(data.payload),
    createdAt: new Date(),
  });
}

export async function listAuditEvents(filters?: {
  userId?: number;
  chipId?: number;
  engine?: string;
  workerId?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  await ensureAuditEventsTable();
  const conditions = [];
  if (filters?.userId) conditions.push(eq(auditEvents.userId, filters.userId));
  if (filters?.chipId) conditions.push(eq(auditEvents.chipId, filters.chipId));
  if (filters?.engine) conditions.push(eq(auditEvents.engine, filters.engine));
  if (filters?.workerId) conditions.push(eq(auditEvents.workerId, filters.workerId));

  const query = db.select().from(auditEvents);
  const rows =
    conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(auditEvents.createdAt)).limit(filters?.limit ?? 300)
      : await query.orderBy(desc(auditEvents.createdAt)).limit(filters?.limit ?? 300);

  return rows.map((row) => ({
    ...row,
    beforeState: parseBehaviorMemoryField(row.beforeState),
    afterState: parseBehaviorMemoryField(row.afterState),
    payload: parseBehaviorMemoryField(row.payload),
  }));
}

export async function upsertClusterNode(data: {
  nodeId: string;
  hostname: string;
  pid: number;
  role: string;
  status: "starting" | "running" | "draining" | "offline";
  version?: string | null;
  isLeader?: boolean | number;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;
  await ensureClusterNodesTable();

  return db.insert(clusterNodes).values({
    nodeId: data.nodeId,
    hostname: data.hostname,
    pid: data.pid,
    role: data.role,
    status: data.status,
    version: data.version ?? null,
    isLeader: Number(data.isLeader ?? 0),
    lastHeartbeatAt: new Date(),
    payload: data.payload === undefined ? null : JSON.stringify(data.payload),
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      hostname: data.hostname,
      pid: data.pid,
      role: data.role,
      status: data.status,
      version: data.version ?? null,
      isLeader: Number(data.isLeader ?? 0),
      lastHeartbeatAt: new Date(),
      payload: data.payload === undefined ? null : JSON.stringify(data.payload),
      updatedAt: new Date(),
    },
  });
}

export async function listClusterNodes(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  await ensureClusterNodesTable();
  const rows = await db.select().from(clusterNodes).orderBy(desc(clusterNodes.updatedAt)).limit(limit);
  return rows.map((row) => ({ ...row, payload: parseBehaviorMemoryField(row.payload) }));
}

export async function upsertLeaderLease(data: {
  leaseKey: string;
  leaderNodeId: string;
  leaseToken: string;
  expiresAt: Date;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;
  await ensureLeaderLeasesTable();

  return db.insert(leaderLeases).values({
    leaseKey: data.leaseKey,
    leaderNodeId: data.leaderNodeId,
    leaseToken: data.leaseToken,
    expiresAt: data.expiresAt,
    payload: data.payload === undefined ? null : JSON.stringify(data.payload),
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      leaderNodeId: data.leaderNodeId,
      leaseToken: data.leaseToken,
      expiresAt: data.expiresAt,
      payload: data.payload === undefined ? null : JSON.stringify(data.payload),
      updatedAt: new Date(),
    },
  });
}

export async function getLeaderLease(leaseKey: string) {
  const db = await getDb();
  if (!db) return null;
  await ensureLeaderLeasesTable();
  const rows = await db.select().from(leaderLeases).where(eq(leaderLeases.leaseKey, leaseKey)).limit(1);
  if (!rows.length) return null;
  return { ...rows[0], payload: parseBehaviorMemoryField(rows[0].payload) };
}

export async function upsertDistributedChipSession(data: {
  userId: number;
  chipId: number;
  ownerNodeId: string;
  phoneNumber?: string | null;
  sessionStatus: "connected" | "disconnected" | "recovering" | "failed" | "orphaned";
  connectionState?: string | null;
  healthScore?: number;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;
  await ensureDistributedChipSessionsTable();

  return db.insert(distributedChipSessions).values({
    userId: data.userId,
    chipId: data.chipId,
    ownerNodeId: data.ownerNodeId,
    phoneNumber: data.phoneNumber ?? null,
    sessionStatus: data.sessionStatus,
    connectionState: data.connectionState ?? null,
    healthScore: data.healthScore ?? 0,
    lastHeartbeatAt: new Date(),
    payload: data.payload === undefined ? null : JSON.stringify(data.payload),
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      userId: data.userId,
      ownerNodeId: data.ownerNodeId,
      phoneNumber: data.phoneNumber ?? null,
      sessionStatus: data.sessionStatus,
      connectionState: data.connectionState ?? null,
      healthScore: data.healthScore ?? 0,
      lastHeartbeatAt: new Date(),
      payload: data.payload === undefined ? null : JSON.stringify(data.payload),
      updatedAt: new Date(),
    },
  });
}

export async function listDistributedChipSessions(filters?: {
  ownerNodeId?: string;
  sessionStatus?: "connected" | "disconnected" | "recovering" | "failed" | "orphaned";
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  await ensureDistributedChipSessionsTable();
  const conditions = [];
  if (filters?.ownerNodeId) conditions.push(eq(distributedChipSessions.ownerNodeId, filters.ownerNodeId));
  if (filters?.sessionStatus) conditions.push(eq(distributedChipSessions.sessionStatus, filters.sessionStatus));
  const query = db.select().from(distributedChipSessions);
  const rows =
    conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(distributedChipSessions.updatedAt)).limit(filters?.limit ?? 200)
      : await query.orderBy(desc(distributedChipSessions.updatedAt)).limit(filters?.limit ?? 200);
  return rows.map((row) => ({ ...row, payload: parseBehaviorMemoryField(row.payload) }));
}

export async function createClusterBackupSnapshot(data: {
  snapshotKey: string;
  scope?: string;
  status?: "ready" | "restored" | "failed";
  payload: unknown;
}) {
  const db = await getDb();
  if (!db) return null;
  await ensureClusterBackupSnapshotsTable();
  return db.insert(clusterBackupSnapshots).values({
    snapshotKey: data.snapshotKey,
    scope: data.scope ?? "cluster",
    status: data.status ?? "ready",
    payload: JSON.stringify(data.payload),
    createdAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      scope: data.scope ?? "cluster",
      status: data.status ?? "ready",
      payload: JSON.stringify(data.payload),
    },
  });
}

export async function markClusterBackupRestored(snapshotKey: string, status: "restored" | "failed") {
  const db = await getDb();
  if (!db) return null;
  await ensureClusterBackupSnapshotsTable();
  return db.update(clusterBackupSnapshots).set({
    status,
    restoredAt: new Date(),
  }).where(eq(clusterBackupSnapshots.snapshotKey, snapshotKey));
}

export async function listClusterBackupSnapshots(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  await ensureClusterBackupSnapshotsTable();
  const rows = await db.select().from(clusterBackupSnapshots).orderBy(desc(clusterBackupSnapshots.createdAt)).limit(limit);
  return rows.map((row) => ({ ...row, payload: parseBehaviorMemoryField(row.payload) }));
}

export async function listLearningEngineEvents(filters: {
  userId: number;
  chipId?: number;
  referenceKey?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  await ensureLearningEngineEventsTable();

  const conditions = [eq(learningEngineEvents.userId, filters.userId)];
  if (filters.chipId) conditions.push(eq(learningEngineEvents.chipId, filters.chipId));
  if (filters.referenceKey) conditions.push(eq(learningEngineEvents.referenceKey, filters.referenceKey));

  const rows = await db
    .select()
    .from(learningEngineEvents)
    .where(and(...conditions))
    .orderBy(desc(learningEngineEvents.observedAt), desc(learningEngineEvents.id))
    .limit(filters.limit ?? 300);

  return rows.map((row) => ({
    ...row,
    payload: parseBehaviorMemoryField(row.payload),
  }));
}

export async function upsertFleetLearningCohort(data: {
  userId: number;
  cohortKey: string;
  status: "emerging" | "stable" | "elite" | "critical";
  title: string;
  chipCount: number;
  averageSuccessRate: number;
  averageRiskScore: number;
  averageCredibilityScore: number;
  lastComputedAt?: Date | null;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureFleetLearningCohortsTable();

  return db
    .insert(fleetLearningCohorts)
    .values({
      userId: data.userId,
      cohortKey: data.cohortKey,
      status: data.status,
      title: data.title,
      chipCount: data.chipCount,
      averageSuccessRate: data.averageSuccessRate,
      averageRiskScore: data.averageRiskScore,
      averageCredibilityScore: data.averageCredibilityScore,
      lastComputedAt: data.lastComputedAt ?? null,
      payload: data.payload === undefined ? null : JSON.stringify(data.payload),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        status: data.status,
        title: data.title,
        chipCount: data.chipCount,
        averageSuccessRate: data.averageSuccessRate,
        averageRiskScore: data.averageRiskScore,
        averageCredibilityScore: data.averageCredibilityScore,
        lastComputedAt: data.lastComputedAt ?? null,
        payload: data.payload === undefined ? null : JSON.stringify(data.payload),
        updatedAt: new Date(),
      },
    });
}

export async function listFleetLearningCohorts(filters: {
  userId: number;
  status?: "emerging" | "stable" | "elite" | "critical";
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  await ensureFleetLearningCohortsTable();

  const conditions = [eq(fleetLearningCohorts.userId, filters.userId)];
  if (filters.status) conditions.push(eq(fleetLearningCohorts.status, filters.status));

  const rows = await db
    .select()
    .from(fleetLearningCohorts)
    .where(and(...conditions))
    .orderBy(desc(fleetLearningCohorts.updatedAt), desc(fleetLearningCohorts.id))
    .limit(filters.limit ?? 200);

  return rows.map((row) => ({
    ...row,
    payload: parseBehaviorMemoryField(row.payload),
  }));
}

export async function upsertFleetLearningPattern(data: {
  userId: number;
  patternKey: string;
  cohortKey: string;
  status: "candidate" | "promoted" | "active" | "retired";
  title: string;
  confidence: number;
  sampleSize: number;
  successRate: number;
  riskScore: number;
  recommendationType: string;
  lastValidatedAt?: Date | null;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureFleetLearningPatternsTable();

  return db
    .insert(fleetLearningPatterns)
    .values({
      userId: data.userId,
      patternKey: data.patternKey,
      cohortKey: data.cohortKey,
      status: data.status,
      title: data.title,
      confidence: data.confidence,
      sampleSize: data.sampleSize,
      successRate: data.successRate,
      riskScore: data.riskScore,
      recommendationType: data.recommendationType,
      lastValidatedAt: data.lastValidatedAt ?? null,
      payload: data.payload === undefined ? null : JSON.stringify(data.payload),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        cohortKey: data.cohortKey,
        status: data.status,
        title: data.title,
        confidence: data.confidence,
        sampleSize: data.sampleSize,
        successRate: data.successRate,
        riskScore: data.riskScore,
        recommendationType: data.recommendationType,
        lastValidatedAt: data.lastValidatedAt ?? null,
        payload: data.payload === undefined ? null : JSON.stringify(data.payload),
        updatedAt: new Date(),
      },
    });
}

export async function listFleetLearningPatterns(filters: {
  userId: number;
  status?: "candidate" | "promoted" | "active" | "retired";
  cohortKey?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  await ensureFleetLearningPatternsTable();

  const conditions = [eq(fleetLearningPatterns.userId, filters.userId)];
  if (filters.status) conditions.push(eq(fleetLearningPatterns.status, filters.status));
  if (filters.cohortKey) conditions.push(eq(fleetLearningPatterns.cohortKey, filters.cohortKey));

  const rows = await db
    .select()
    .from(fleetLearningPatterns)
    .where(and(...conditions))
    .orderBy(desc(fleetLearningPatterns.updatedAt), desc(fleetLearningPatterns.id))
    .limit(filters.limit ?? 300);

  return rows.map((row) => ({
    ...row,
    payload: parseBehaviorMemoryField(row.payload),
  }));
}

export async function createFleetKnowledgePromotion(data: {
  userId: number;
  sourcePatternKey: string;
  targetKnowledgeKey: string;
  action: "observe" | "promote" | "revalidate" | "retire";
  observedAt?: Date;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureFleetKnowledgePromotionsTable();

  return db.insert(fleetKnowledgePromotions).values({
    userId: data.userId,
    sourcePatternKey: data.sourcePatternKey,
    targetKnowledgeKey: data.targetKnowledgeKey,
    action: data.action,
    observedAt: data.observedAt ?? new Date(),
    payload: data.payload === undefined ? null : JSON.stringify(data.payload),
    createdAt: new Date(),
  });
}

export async function listFleetKnowledgePromotions(filters: {
  userId: number;
  sourcePatternKey?: string;
  targetKnowledgeKey?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  await ensureFleetKnowledgePromotionsTable();

  const conditions = [eq(fleetKnowledgePromotions.userId, filters.userId)];
  if (filters.sourcePatternKey) conditions.push(eq(fleetKnowledgePromotions.sourcePatternKey, filters.sourcePatternKey));
  if (filters.targetKnowledgeKey) conditions.push(eq(fleetKnowledgePromotions.targetKnowledgeKey, filters.targetKnowledgeKey));

  const rows = await db
    .select()
    .from(fleetKnowledgePromotions)
    .where(and(...conditions))
    .orderBy(desc(fleetKnowledgePromotions.observedAt), desc(fleetKnowledgePromotions.id))
    .limit(filters.limit ?? 300);

  return rows.map((row) => ({
    ...row,
    payload: parseBehaviorMemoryField(row.payload),
  }));
}

export async function getLatestBehaviorMemorySnapshot(userId: number, chipId: number) {
  const rows = await listBehaviorMemorySnapshots({
    userId,
    chipId,
    limit: 1,
  });

  return rows[0] ?? null;
}

export async function upsertChipHealth(data: {
  userId: number;
  chipId: number;
  healthScore: number;
  reconnectCount: number;
  disconnectCount: number;
  lastDisconnect?: Date | null;
  sessionAge: number;
  lastReceive?: Date | null;
  lastSend?: Date | null;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureChipHealthTable();

  return db.insert(chipHealth).values({
    userId: data.userId,
    chipId: data.chipId,
    healthScore: data.healthScore,
    reconnectCount: data.reconnectCount,
    disconnectCount: data.disconnectCount,
    lastDisconnect: data.lastDisconnect ?? null,
    sessionAge: data.sessionAge,
    lastReceive: data.lastReceive ?? null,
    lastSend: data.lastSend ?? null,
    updatedAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      healthScore: data.healthScore,
      reconnectCount: data.reconnectCount,
      disconnectCount: data.disconnectCount,
      lastDisconnect: data.lastDisconnect ?? null,
      sessionAge: data.sessionAge,
      lastReceive: data.lastReceive ?? null,
      lastSend: data.lastSend ?? null,
      updatedAt: new Date(),
    },
  });
}

export async function getChipHealthSnapshot(userId: number, chipId: number) {
  const db = await getDb();
  if (!db) return null;

  await ensureChipHealthTable();

  const result = await db
    .select()
    .from(chipHealth)
    .where(and(eq(chipHealth.userId, userId), eq(chipHealth.chipId, chipId)))
    .limit(1);

  return result[0] ?? null;
}

export async function upsertChipBehaviorScore(data: {
  userId: number;
  chipId: number;
  humanScore: number;
  riskScore: number;
  evidenceQuality?: number;
  evidenceCoverage?: number;
  evidenceCoverageDetail?: unknown;
  evidenceNaturalness?: number;
  evidenceDiversity?: number;
  evidenceConsistency?: number;
  evidenceSocialPresence?: number;
  sentCount: number;
  receivedCount: number;
  groupJoinCount: number;
  readCount: number;
  distinctConversations: number;
  activeMinutes: number;
  idleMinutes: number;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureChipBehaviorScoresTable();

  return db.insert(chipBehaviorScores).values({
    userId: data.userId,
    chipId: data.chipId,
    humanScore: data.humanScore,
    riskScore: data.riskScore,
    evidenceQuality: data.evidenceQuality ?? 0,
    evidenceCoverage: data.evidenceCoverage ?? 0,
    evidenceNaturalness: data.evidenceNaturalness ?? 0,
    evidenceDiversity: data.evidenceDiversity ?? 0,
    evidenceConsistency: data.evidenceConsistency ?? 0,
    evidenceSocialPresence: data.evidenceSocialPresence ?? 0,
    evidenceCoverageDetail:
      data.evidenceCoverageDetail === undefined ? null : JSON.stringify(data.evidenceCoverageDetail),
    sentCount: data.sentCount,
    receivedCount: data.receivedCount,
    groupJoinCount: data.groupJoinCount,
    readCount: data.readCount,
    distinctConversations: data.distinctConversations,
    activeMinutes: data.activeMinutes,
    idleMinutes: data.idleMinutes,
    updatedAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      humanScore: data.humanScore,
      riskScore: data.riskScore,
      evidenceQuality: data.evidenceQuality ?? 0,
      evidenceCoverage: data.evidenceCoverage ?? 0,
      evidenceNaturalness: data.evidenceNaturalness ?? 0,
      evidenceDiversity: data.evidenceDiversity ?? 0,
      evidenceConsistency: data.evidenceConsistency ?? 0,
      evidenceSocialPresence: data.evidenceSocialPresence ?? 0,
      evidenceCoverageDetail:
        data.evidenceCoverageDetail === undefined ? null : JSON.stringify(data.evidenceCoverageDetail),
      sentCount: data.sentCount,
      receivedCount: data.receivedCount,
      groupJoinCount: data.groupJoinCount,
      readCount: data.readCount,
      distinctConversations: data.distinctConversations,
      activeMinutes: data.activeMinutes,
      idleMinutes: data.idleMinutes,
      updatedAt: new Date(),
    },
  });
}

export async function getChipBehaviorScore(userId: number, chipId: number) {
  const db = await getDb();
  if (!db) return null;

  await ensureChipBehaviorScoresTable();

  const result = await db
    .select()
    .from(chipBehaviorScores)
    .where(and(eq(chipBehaviorScores.userId, userId), eq(chipBehaviorScores.chipId, chipId)))
    .limit(1);

  return result[0] ?? null;
}

export async function upsertChipRiskState(data: {
  userId: number;
  chipId: number;
  spamRisk: number;
  banRisk: number;
  humanScore: number;
  socialScore: number;
  routineScore: number;
  conversationScore: number;
  presenceScore: number;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureChipRiskStateTable();
  return db.insert(chipRiskState).values({
    userId: data.userId,
    chipId: data.chipId,
    spamRisk: data.spamRisk,
    banRisk: data.banRisk,
    humanScore: data.humanScore,
    socialScore: data.socialScore,
    routineScore: data.routineScore,
    conversationScore: data.conversationScore,
    presenceScore: data.presenceScore,
    payload: data.payload === undefined ? null : JSON.stringify(data.payload),
    updatedAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      spamRisk: data.spamRisk,
      banRisk: data.banRisk,
      humanScore: data.humanScore,
      socialScore: data.socialScore,
      routineScore: data.routineScore,
      conversationScore: data.conversationScore,
      presenceScore: data.presenceScore,
      payload: data.payload === undefined ? null : JSON.stringify(data.payload),
      updatedAt: new Date(),
    },
  });
}

export async function getChipRiskState(userId: number, chipId: number) {
  const db = await getDb();
  if (!db) return null;

  await ensureChipRiskStateTable();
  const result = await db
    .select()
    .from(chipRiskState)
    .where(and(eq(chipRiskState.userId, userId), eq(chipRiskState.chipId, chipId)))
    .limit(1);

  if (!result[0]) return null;
  return {
    ...result[0],
    payload: parseBehaviorMemoryField(result[0].payload),
  };
}

export async function upsertChipRoutineState(data: {
  userId: number;
  chipId: number;
  weekday: number;
  currentMode: string;
  nextActionAt?: Date | null;
  lastWindowStartedAt?: Date | null;
  lastWindowEndedAt?: Date | null;
  actionsToday?: number;
  pausesToday?: number;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureChipRoutineStateTable();
  return db.insert(chipRoutineState).values({
    userId: data.userId,
    chipId: data.chipId,
    weekday: data.weekday,
    currentMode: data.currentMode,
    nextActionAt: data.nextActionAt ?? null,
    lastWindowStartedAt: data.lastWindowStartedAt ?? null,
    lastWindowEndedAt: data.lastWindowEndedAt ?? null,
    actionsToday: data.actionsToday ?? 0,
    pausesToday: data.pausesToday ?? 0,
    payload: data.payload === undefined ? null : JSON.stringify(data.payload),
    updatedAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      weekday: data.weekday,
      currentMode: data.currentMode,
      nextActionAt: data.nextActionAt ?? null,
      lastWindowStartedAt: data.lastWindowStartedAt ?? null,
      lastWindowEndedAt: data.lastWindowEndedAt ?? null,
      actionsToday: data.actionsToday ?? 0,
      pausesToday: data.pausesToday ?? 0,
      payload: data.payload === undefined ? null : JSON.stringify(data.payload),
      updatedAt: new Date(),
    },
  });
}

export async function getChipRoutineState(userId: number, chipId: number) {
  const db = await getDb();
  if (!db) return null;

  await ensureChipRoutineStateTable();
  const result = await db
    .select()
    .from(chipRoutineState)
    .where(and(eq(chipRoutineState.userId, userId), eq(chipRoutineState.chipId, chipId)))
    .limit(1);

  if (!result[0]) return null;
  return {
    ...result[0],
    payload: parseBehaviorMemoryField(result[0].payload),
  };
}

export async function upsertChipIdentityEvolution(data: {
  userId: number;
  chipId: number;
  generation?: number;
  lastNameChangeAt?: Date | null;
  lastAboutChangeAt?: Date | null;
  lastPhotoChangeAt?: Date | null;
  currentDisplayName?: string | null;
  currentAbout?: string | null;
  currentPhotoAsset?: string | null;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureChipIdentityEvolutionTable();
  return db.insert(chipIdentityEvolution).values({
    userId: data.userId,
    chipId: data.chipId,
    generation: data.generation ?? 1,
    lastNameChangeAt: data.lastNameChangeAt ?? null,
    lastAboutChangeAt: data.lastAboutChangeAt ?? null,
    lastPhotoChangeAt: data.lastPhotoChangeAt ?? null,
    currentDisplayName: data.currentDisplayName ?? null,
    currentAbout: data.currentAbout ?? null,
    currentPhotoAsset: data.currentPhotoAsset ?? null,
    payload: data.payload === undefined ? null : JSON.stringify(data.payload),
    updatedAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      generation: data.generation ?? 1,
      lastNameChangeAt: data.lastNameChangeAt ?? null,
      lastAboutChangeAt: data.lastAboutChangeAt ?? null,
      lastPhotoChangeAt: data.lastPhotoChangeAt ?? null,
      currentDisplayName: data.currentDisplayName ?? null,
      currentAbout: data.currentAbout ?? null,
      currentPhotoAsset: data.currentPhotoAsset ?? null,
      payload: data.payload === undefined ? null : JSON.stringify(data.payload),
      updatedAt: new Date(),
    },
  });
}

export async function getChipIdentityEvolution(userId: number, chipId: number) {
  const db = await getDb();
  if (!db) return null;

  await ensureChipIdentityEvolutionTable();
  const result = await db
    .select()
    .from(chipIdentityEvolution)
    .where(and(eq(chipIdentityEvolution.userId, userId), eq(chipIdentityEvolution.chipId, chipId)))
    .limit(1);

  if (!result[0]) return null;
  return {
    ...result[0],
    payload: parseBehaviorMemoryField(result[0].payload),
  };
}

export async function upsertChipCertificationState(data: {
  userId: number;
  chipId: number;
  maturityLevel: number;
  maturityLabel: string;
  decision: "APPROVED" | "BLOCKED";
  humanScore: number;
  socialScore: number;
  routineScore: number;
  trustScore: number;
  spamRisk: number;
  banRisk: number;
  payload?: unknown;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureChipCertificationStateTable();
  return db.insert(chipCertificationState).values({
    userId: data.userId,
    chipId: data.chipId,
    maturityLevel: data.maturityLevel,
    maturityLabel: data.maturityLabel,
    decision: data.decision,
    humanScore: data.humanScore,
    socialScore: data.socialScore,
    routineScore: data.routineScore,
    trustScore: data.trustScore,
    spamRisk: data.spamRisk,
    banRisk: data.banRisk,
    payload: data.payload === undefined ? null : JSON.stringify(data.payload),
    updatedAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      maturityLevel: data.maturityLevel,
      maturityLabel: data.maturityLabel,
      decision: data.decision,
      humanScore: data.humanScore,
      socialScore: data.socialScore,
      routineScore: data.routineScore,
      trustScore: data.trustScore,
      spamRisk: data.spamRisk,
      banRisk: data.banRisk,
      payload: data.payload === undefined ? null : JSON.stringify(data.payload),
      updatedAt: new Date(),
    },
  });
}

export async function getChipCertificationState(userId: number, chipId: number) {
  const db = await getDb();
  if (!db) return null;

  await ensureChipCertificationStateTable();
  const result = await db
    .select()
    .from(chipCertificationState)
    .where(and(eq(chipCertificationState.userId, userId), eq(chipCertificationState.chipId, chipId)))
    .limit(1);

  if (!result[0]) return null;
  return {
    ...result[0],
    payload: parseBehaviorMemoryField(result[0].payload),
  };
}

export async function upsertChipCertification(data: {
  userId: number;
  chipId: number;
  status: CertificationStatus;
  usable: boolean;
  reason?: string | null;
  approvedAt?: Date | null;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureChipCertificationsTable();

  return db.insert(chipCertifications).values({
    userId: data.userId,
    chipId: data.chipId,
    status: data.status,
    usable: data.usable ? 1 : 0,
    reason: data.reason ?? null,
    approvedAt: data.approvedAt ?? null,
    updatedAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      status: data.status,
      usable: data.usable ? 1 : 0,
      reason: data.reason ?? null,
      approvedAt: data.approvedAt ?? null,
      updatedAt: new Date(),
    },
  });
}

export async function getChipCertification(userId: number, chipId: number) {
  const db = await getDb();
  if (!db) return null;

  await ensureChipCertificationsTable();

  const result = await db
    .select()
    .from(chipCertifications)
    .where(and(eq(chipCertifications.userId, userId), eq(chipCertifications.chipId, chipId)))
    .limit(1);

  return result[0] ?? null;
}

export async function getChipPolicyStats(userId: number, chipId: number) {
  const db = await getDb();
  if (!db) {
    return {
      inboundCount: 0,
      outboundCount: 0,
      todayActionCount: 0,
      todayActionTypes: [] as string[],
      lastInboundAt: null as Date | null,
      lastOutboundAt: null as Date | null,
    };
  }

  const activityRows = await db
    .select({
      actionType: activityLogs.actionType,
      createdAt: activityLogs.createdAt,
    })
    .from(activityLogs)
    .where(and(eq(activityLogs.userId, userId), eq(activityLogs.chipId, chipId)))
    .orderBy(desc(activityLogs.createdAt));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const outboundTypes = new Set(["message_sent", "image_sent", "audio_sent", "reaction_sent"]);

  let inboundCount = 0;
  let outboundCount = 0;
  let lastInboundAt: Date | null = null;
  let lastOutboundAt: Date | null = null;
  const todayActionTypes: string[] = [];

  for (const row of activityRows) {
    const actionType = row.actionType ?? "";
    const createdAt = row.createdAt ? new Date(row.createdAt) : null;

    if (actionType === "message_received") {
      inboundCount += 1;
      if (!lastInboundAt && createdAt) {
        lastInboundAt = createdAt;
      }
    }

    if (outboundTypes.has(actionType)) {
      outboundCount += 1;
      if (!lastOutboundAt && createdAt) {
        lastOutboundAt = createdAt;
      }
    }

    if (createdAt && createdAt >= todayStart) {
      todayActionTypes.push(actionType);
    }
  }

  return {
    inboundCount,
    outboundCount,
    todayActionCount: todayActionTypes.length,
    todayActionTypes,
    lastInboundAt,
    lastOutboundAt,
  };
}

export async function createBehaviorDecisionLog(data: {
  userId: number;
  chipId: number;
  phase: string;
  trustScore?: number | null;
  riskScore?: number | null;
  dailyBudgetUsed: number;
  dailyBudgetTotal: number;
  sessionId?: string | null;
  requestedAction: string;
  decision: string;
  reason: string;
  delayMs?: number | null;
  nextCheckAt?: Date | null;
  engineVersion: string;
  policyFingerprint?: string | null;
  checksJson?: string | null;
  contributorsJson?: string | null;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureBehaviorDecisionLogTable();

  return db.insert(behaviorDecisionLog).values({
    userId: data.userId,
    chipId: data.chipId,
    phase: data.phase,
    trustScore: data.trustScore ?? null,
    riskScore: data.riskScore ?? null,
    dailyBudgetUsed: data.dailyBudgetUsed,
    dailyBudgetTotal: data.dailyBudgetTotal,
    sessionId: data.sessionId ?? null,
    requestedAction: data.requestedAction,
    decision: data.decision,
    reason: data.reason,
    delayMs: data.delayMs ?? null,
    nextCheckAt: data.nextCheckAt ?? null,
    engineVersion: data.engineVersion,
    policyFingerprint: data.policyFingerprint ?? null,
    checksJson: data.checksJson ?? null,
    contributorsJson: data.contributorsJson ?? null,
    createdAt: new Date(),
  });
}

export async function upsertBehaviorSnapshot(data: {
  userId: number;
  chipId: number;
  phase: string;
  trustScore?: number | null;
  riskScore?: number | null;
  dailyBudgetUsed: number;
  dailyBudgetTotal: number;
  inboundCount: number;
  outboundCount: number;
  sessionId?: string | null;
  lastDecision?: string | null;
  lastReason?: string | null;
  nextCheckAt?: Date | null;
  engineVersion: string;
  policyFingerprint?: string | null;
  snapshotJson?: string | null;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureBehaviorSnapshotsTable();

  return db.insert(behaviorSnapshots).values({
    userId: data.userId,
    chipId: data.chipId,
    phase: data.phase,
    trustScore: data.trustScore ?? null,
    riskScore: data.riskScore ?? null,
    dailyBudgetUsed: data.dailyBudgetUsed,
    dailyBudgetTotal: data.dailyBudgetTotal,
    inboundCount: data.inboundCount,
    outboundCount: data.outboundCount,
    sessionId: data.sessionId ?? null,
    lastDecision: data.lastDecision ?? null,
    lastReason: data.lastReason ?? null,
    nextCheckAt: data.nextCheckAt ?? null,
    engineVersion: data.engineVersion,
    policyFingerprint: data.policyFingerprint ?? null,
    snapshotJson: data.snapshotJson ?? null,
    updatedAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      phase: data.phase,
      trustScore: data.trustScore ?? null,
      riskScore: data.riskScore ?? null,
      dailyBudgetUsed: data.dailyBudgetUsed,
      dailyBudgetTotal: data.dailyBudgetTotal,
      inboundCount: data.inboundCount,
      outboundCount: data.outboundCount,
      sessionId: data.sessionId ?? null,
      lastDecision: data.lastDecision ?? null,
      lastReason: data.lastReason ?? null,
      nextCheckAt: data.nextCheckAt ?? null,
      engineVersion: data.engineVersion,
      policyFingerprint: data.policyFingerprint ?? null,
      snapshotJson: data.snapshotJson ?? null,
      updatedAt: new Date(),
    },
  });
}

export async function getLatestBehaviorDecisionLog(chipId: number) {
  const db = await getDb();
  if (!db) return null;

  await ensureBehaviorDecisionLogTable();

  const result = await db.select().from(behaviorDecisionLog).where(eq(behaviorDecisionLog.chipId, chipId)).orderBy(desc(behaviorDecisionLog.id)).limit(1);
  return result[0] ?? null;
}

export async function listBehaviorDecisionLogs(chipId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];

  await ensureBehaviorDecisionLogTable();

  return db
    .select()
    .from(behaviorDecisionLog)
    .where(eq(behaviorDecisionLog.chipId, chipId))
    .orderBy(desc(behaviorDecisionLog.id))
    .limit(limit);
}

export async function getBehaviorSnapshot(chipId: number) {
  const db = await getDb();
  if (!db) return null;

  await ensureBehaviorSnapshotsTable();

  const result = await db.select().from(behaviorSnapshots).where(eq(behaviorSnapshots.chipId, chipId)).limit(1);
  return result[0] ?? null;
}

export async function listCertifiedChips(userId: number) {
  const db = await getDb();
  if (!db) return [];

  await ensureChipHealthTable();
  await ensureChipBehaviorScoresTable();
  await ensureChipCertificationsTable();

  return db
    .select({
      chipId: whatsappChips.id,
      chipName: whatsappChips.chipName,
      phoneNumber: whatsappChips.phoneNumber,
      status: chipCertifications.status,
      usable: chipCertifications.usable,
      health: chipHealth.healthScore,
      human: chipBehaviorScores.humanScore,
      risk: chipBehaviorScores.riskScore,
      updatedAt: chipCertifications.updatedAt,
    })
    .from(chipCertifications)
    .innerJoin(whatsappChips, eq(chipCertifications.chipId, whatsappChips.id))
    .leftJoin(chipHealth, eq(chipHealth.chipId, whatsappChips.id))
    .leftJoin(chipBehaviorScores, eq(chipBehaviorScores.chipId, whatsappChips.id))
    .where(and(eq(chipCertifications.userId, userId), eq(chipCertifications.usable, 1)))
    .orderBy(desc(chipCertifications.updatedAt));
}

export async function getUserMaturationProfiles(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(maturationProfiles).where(eq(maturationProfiles.userId, userId));
}

export async function getMaturationProfile(userId: number, profileName: "suave" | "normal" | "ultra") {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(maturationProfiles)
    .where(and(eq(maturationProfiles.userId, userId), eq(maturationProfiles.profileName, profileName)))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function createMaturationProfile(data: {
  userId: number;
  profileName: "suave" | "normal" | "ultra";
  minMessageDelay: number;
  maxMessageDelay: number;
  messageFrequencyPerDay: number;
  typingIndicatorDuration: number;
  audioSimulationDuration: number;
  reactionProbability: number;
  imageSendProbability: number;
}) {
  const db = await getDb();
  if (!db) return null;

  try {
    return await db.insert(maturationProfiles).values(data);
  } catch (error) {
    console.error("[Database] Failed to create maturation profile:", error);
    throw error;
  }
}

export async function updateMaturationProfile(
  userId: number,
  profileName: "suave" | "normal" | "ultra",
  data: Partial<{
    minMessageDelay: number;
    maxMessageDelay: number;
    messageFrequencyPerDay: number;
    typingIndicatorDuration: number;
    audioSimulationDuration: number;
    reactionProbability: number;
    imageSendProbability: number;
  }>
) {
  const db = await getDb();
  if (!db) return null;

  try {
    return await db
      .update(maturationProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(maturationProfiles.userId, userId), eq(maturationProfiles.profileName, profileName)));
  } catch (error) {
    console.error("[Database] Failed to update maturation profile:", error);
    throw error;
  }
}

export async function getUserScheduledTasks(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(scheduledTasks).where(eq(scheduledTasks.userId, userId));
}

export async function getUserSubscription(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(userSubscriptions).where(eq(userSubscriptions.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getUserPlan(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const subscription = await getUserSubscription(userId);
  if (!subscription) return null;

  const result = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, subscription.planId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ============================================
// VALIDATION HELPERS
// ============================================

export async function validateChipOwnership(chipId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.select().from(whatsappChips).where(and(eq(whatsappChips.id, chipId), eq(whatsappChips.userId, userId))).limit(1);
  return result.length > 0;
}

export async function validateChipsLimit(userId: number): Promise<{ allowed: boolean; current: number; limit: number }> {
  const db = await getDb();
  if (!db) return { allowed: false, current: 0, limit: 0 };

  const plan = await getUserPlan(userId);
  if (!plan) return { allowed: false, current: 0, limit: 0 };

  const chips = await getUserChips(userId);
  const current = chips.length;
  const limit = plan.maxChips;

  return {
    allowed: current < limit,
    current,
    limit,
  };
}

export async function validateTasksLimit(userId: number): Promise<{ allowed: boolean; current: number; limit: number }> {
  const db = await getDb();
  if (!db) return { allowed: false, current: 0, limit: 0 };

  const plan = await getUserPlan(userId);
  if (!plan) return { allowed: false, current: 0, limit: 0 };

  const tasks = await getUserScheduledTasks(userId);
  const current = tasks.length;
  const limit = plan.maxScheduledTasks;

  return {
    allowed: current < limit,
    current,
    limit,
  };
}

// ============================================
// ADMIN HELPERS
// ============================================

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];

  await ensureUserProfileImageColumn();
  return db.select().from(users);
}

export async function updateOwnUserProfile(
  userId: number,
  data: Partial<{
    name: string | null;
    email: string | null;
    profileImageUrl: string | null;
  }>
) {
  const db = await getDb();
  if (!db) return null;

  await ensureUserProfileImageColumn();

  try {
    return await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId));
  } catch (error) {
    console.error("[Database] Failed to update own user profile:", error);
    throw error;
  }
}

export async function getAllSubscriptionPlans() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, 1));
}

export async function createDefaultSubscription(userId: number, planId: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(userSubscriptions).values({
      userId,
      planId,
      status: "trial",
      trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
    });

    return result;
  } catch (error) {
    console.error("[Database] Failed to create subscription:", error);
    throw error;
  }
}

export async function updateUserAdminAccount(
  userId: number,
  data: Partial<{
    role: "user" | "admin";
    isActive: number;
  }>
) {
  const db = await getDb();
  if (!db) return null;

  await ensureUserProfileImageColumn();

  try {
    return await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId));
  } catch (error) {
    console.error("[Database] Failed to update admin user account:", error);
    throw error;
  }
}

export async function updateUserAdminSubscription(
  userId: number,
  data: Partial<{
    planId: number;
    status: "active" | "cancelled" | "expired" | "trial";
    trialEndDate: Date | null;
    subscriptionEndDate: Date | null;
    autoRenew: number;
  }>
) {
  const db = await getDb();
  if (!db) return null;

  try {
    return await db
      .update(userSubscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userSubscriptions.userId, userId));
  } catch (error) {
    console.error("[Database] Failed to update admin subscription:", error);
    throw error;
  }
}

// ============================================
// MESSAGE TEMPLATES & TARGETS
// ============================================

export async function getUserMessageTemplates(
  userId: number,
  category?: "dispatch" | "maturation" | "general"
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(messageTemplates.userId, userId)];
  if (category) {
    conditions.push(eq(messageTemplates.category, category));
  }

  return db
    .select()
    .from(messageTemplates)
    .where(and(...conditions))
    .orderBy(desc(messageTemplates.updatedAt));
}

export async function getMessageTemplateById(templateId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(messageTemplates).where(eq(messageTemplates.id, templateId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createMessageTemplate(data: {
  userId: number;
  templateName: string;
  category?: "dispatch" | "maturation" | "general";
  content: string;
  isActive?: number;
}) {
  const db = await getDb();
  if (!db) return null;

  try {
    return await db.insert(messageTemplates).values({
      userId: data.userId,
      templateName: data.templateName,
      category: data.category ?? "general",
      content: data.content,
      isActive: data.isActive ?? 1,
    });
  } catch (error) {
    console.error("[Database] Failed to create message template:", error);
    throw error;
  }
}

export async function updateMessageTemplate(
  templateId: number,
  data: Partial<{
    templateName: string;
    category: "dispatch" | "maturation" | "general";
    content: string;
    isActive: number;
  }>
) {
  const db = await getDb();
  if (!db) return null;

  try {
    return await db
      .update(messageTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(messageTemplates.id, templateId));
  } catch (error) {
    console.error("[Database] Failed to update message template:", error);
    throw error;
  }
}

export async function deleteMessageTemplate(templateId: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    return await db.delete(messageTemplates).where(eq(messageTemplates.id, templateId));
  } catch (error) {
    console.error("[Database] Failed to delete message template:", error);
    throw error;
  }
}

export async function getActiveMessageTemplateContents(
  userId: number,
  category: "dispatch" | "maturation" | "general" = "maturation"
) {
  const db = await getDb();
  if (!db) return [];

  const templates = await db
    .select()
    .from(messageTemplates)
    .where(
      and(
        eq(messageTemplates.userId, userId),
        eq(messageTemplates.isActive, 1),
        or(eq(messageTemplates.category, category), eq(messageTemplates.category, "general"))!
      )
    )
    .orderBy(desc(messageTemplates.updatedAt));

  return templates.map((template) => template.content.trim()).filter(Boolean);
}

export async function getUserMaturationTargets(
  userId: number,
  targetType?: "number" | "group" | "chip"
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(maturationTargets.userId, userId)];
  if (targetType) {
    conditions.push(eq(maturationTargets.targetType, targetType));
  }

  return db
    .select()
    .from(maturationTargets)
    .where(and(...conditions))
    .orderBy(desc(maturationTargets.updatedAt));
}

export async function getMaturationTargetById(targetId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(maturationTargets).where(eq(maturationTargets.id, targetId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createMaturationTarget(data: {
  userId: number;
  targetName: string;
  targetType: "number" | "group" | "chip";
  targetValue: string;
  notes?: string | null;
  isActive?: number;
}) {
  const db = await getDb();
  if (!db) return null;

  try {
    return await db.insert(maturationTargets).values({
      userId: data.userId,
      targetName: data.targetName,
      targetType: data.targetType,
      targetValue: data.targetValue,
      notes: data.notes ?? null,
      isActive: data.isActive ?? 1,
    });
  } catch (error) {
    console.error("[Database] Failed to create maturation target:", error);
    throw error;
  }
}

export async function updateMaturationTarget(
  targetId: number,
  data: Partial<{
    targetName: string;
    targetType: "number" | "group" | "chip";
    targetValue: string;
    notes: string | null;
    isActive: number;
  }>
) {
  const db = await getDb();
  if (!db) return null;

  try {
    return await db
      .update(maturationTargets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(maturationTargets.id, targetId));
  } catch (error) {
    console.error("[Database] Failed to update maturation target:", error);
    throw error;
  }
}

export async function deleteMaturationTarget(targetId: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    return await db.delete(maturationTargets).where(eq(maturationTargets.id, targetId));
  } catch (error) {
    console.error("[Database] Failed to delete maturation target:", error);
    throw error;
  }
}

// ============================================
// EXECUTION JOBS & ATTEMPTS
// ============================================

export async function createExecutionJob(data: {
  userId: number;
  chipId: number;
  executionType: "dispatch" | "maturation";
  targetType: "number" | "group" | "list" | "chip";
  templateId?: number | null;
  profileName?: "suave" | "normal" | "ultra";
  totalTargets: number;
  plannedMessages: number;
  payload?: string;
}) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(executionJobs).values({
      userId: data.userId,
      chipId: data.chipId,
      executionType: data.executionType,
      targetType: data.targetType,
      status: "running",
      templateId: data.templateId ?? null,
      profileName: data.profileName ?? "normal",
      totalTargets: data.totalTargets,
      plannedMessages: data.plannedMessages,
      payload: data.payload,
      startedAt: new Date(),
    });

    return result;
  } catch (error) {
    console.error("[Database] Failed to create execution job:", error);
    throw error;
  }
}

export async function updateExecutionJob(
  jobId: number,
  data: Partial<{
    status: "pending" | "running" | "completed" | "failed" | "partial";
    totalMessagesSent: number;
    successCount: number;
    failureCount: number;
    errorMessage: string | null;
    finishedAt: Date | null;
    payload: string;
  }>
) {
  const db = await getDb();
  if (!db) return null;

  try {
    return await db
      .update(executionJobs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(executionJobs.id, jobId));
  } catch (error) {
    console.error("[Database] Failed to update execution job:", error);
    throw error;
  }
}

export async function createExecutionAttempt(data: {
  jobId: number;
  userId: number;
  chipId: number;
  targetType: "number" | "group" | "list" | "chip";
  targetValue: string;
  actionType: "message" | "reaction";
  attemptOrder: number;
  messageContent?: string;
}) {
  const db = await getDb();
  if (!db) return null;

  try {
    return await db.insert(executionAttempts).values({
      jobId: data.jobId,
      userId: data.userId,
      chipId: data.chipId,
      targetType: data.targetType,
      targetValue: data.targetValue,
      actionType: data.actionType,
      attemptOrder: data.attemptOrder,
      messageContent: data.messageContent,
      status: "pending",
    });
  } catch (error) {
    console.error("[Database] Failed to create execution attempt:", error);
    throw error;
  }
}

export async function updateExecutionAttempt(
  attemptId: number,
  data: Partial<{
    providerMessageId: string | null;
    status: "pending" | "success" | "failed";
    errorMessage: string | null;
    executedAt: Date | null;
  }>
) {
  const db = await getDb();
  if (!db) return null;

  try {
    return await db
      .update(executionAttempts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(executionAttempts.id, attemptId));
  } catch (error) {
    console.error("[Database] Failed to update execution attempt:", error);
    throw error;
  }
}

export async function getExecutionJobById(jobId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(executionJobs).where(eq(executionJobs.id, jobId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function listUserExecutionJobs(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(executionJobs)
    .where(eq(executionJobs.userId, userId))
    .orderBy(desc(executionJobs.createdAt))
    .limit(limit);
}

export async function countPendingExecutionJobsForChip(chipId: number) {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(executionJobs)
    .where(
      and(
        eq(executionJobs.chipId, chipId),
        or(eq(executionJobs.status, "pending"), eq(executionJobs.status, "running"))
      )
    );

  return Number(result[0]?.count ?? 0);
}

export async function listExecutionAttemptsByJob(jobId: number, limit = 200) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(executionAttempts)
    .where(eq(executionAttempts.jobId, jobId))
    .orderBy(desc(executionAttempts.createdAt))
    .limit(limit);
}

export async function createBehaviorActionExecution(data: {
  id: string;
  decisionId: string;
  userId: number;
  chipId: number;
  requestedAction: string;
  targetType: "number" | "group" | "list" | "chip";
  targetValue: string;
  attempt?: number;
  recoverable?: boolean;
  maxAttempts?: number;
  nextRetryAt?: Date | null;
  lastRetryAt?: Date | null;
  payload?: string | null;
}) {
  const db = await getDb();
  if (!db) return null;

  await ensureBehaviorActionExecutionTable();

  return db.insert(behaviorActionExecution).values({
    id: data.id,
    decisionId: data.decisionId,
    userId: data.userId,
    chipId: data.chipId,
    requestedAction: data.requestedAction,
    targetType: data.targetType,
    targetValue: data.targetValue,
    status: "PENDING",
    budgetState: "NOT_RESERVED",
    attempt: data.attempt ?? 1,
    recoverable: data.recoverable === false ? 0 : 1,
    maxAttempts: data.maxAttempts ?? 3,
    nextRetryAt: data.nextRetryAt ?? null,
    lastRetryAt: data.lastRetryAt ?? null,
    payload: data.payload ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function updateBehaviorActionExecution(
  executionId: string,
  data: Partial<{
    messageId: string | null;
    status: "PENDING" | "SENDING" | "ACKED" | "FAILED" | "RETRYING";
    budgetState: "NOT_RESERVED" | "RESERVED" | "COMMITTED" | "RELEASED";
    attempt: number;
    recoverable: number;
    maxAttempts: number;
    nextRetryAt: Date | null;
    lastRetryAt: Date | null;
    payload: string | null;
    error: string | null;
    sentAt: Date | null;
    ackAt: Date | null;
  }>,
) {
  const db = await getDb();
  if (!db) return null;

  await ensureBehaviorActionExecutionTable();

  return db
    .update(behaviorActionExecution)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(behaviorActionExecution.id, executionId));
}

export async function getBehaviorActionExecutionByDecisionId(decisionId: string) {
  const db = await getDb();
  if (!db) return null;

  await ensureBehaviorActionExecutionTable();

  const rows = await db
    .select()
    .from(behaviorActionExecution)
    .where(eq(behaviorActionExecution.decisionId, decisionId))
    .orderBy(desc(behaviorActionExecution.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function getBehaviorActionExecutionById(executionId: string) {
  const db = await getDb();
  if (!db) return null;

  await ensureBehaviorActionExecutionTable();

  const rows = await db
    .select()
    .from(behaviorActionExecution)
    .where(eq(behaviorActionExecution.id, executionId))
    .limit(1);

  return rows[0] ?? null;
}

export async function listBehaviorActionExecutionsByChip(chipId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];

  await ensureBehaviorActionExecutionTable();

  return db
    .select()
    .from(behaviorActionExecution)
    .where(eq(behaviorActionExecution.chipId, chipId))
    .orderBy(desc(behaviorActionExecution.createdAt))
    .limit(limit);
}

export async function listRecoverableBehaviorActionExecutions(now = new Date(), limit = 50) {
  const db = await getDb();
  if (!db) return [];

  await ensureBehaviorActionExecutionTable();

  return db
    .select()
    .from(behaviorActionExecution)
    .where(
      and(
        eq(behaviorActionExecution.status, "FAILED"),
        eq(behaviorActionExecution.recoverable, 1),
        or(lte(behaviorActionExecution.nextRetryAt, now), sql`${behaviorActionExecution.nextRetryAt} IS NULL`),
      ),
    )
    .orderBy(behaviorActionExecution.createdAt)
    .limit(limit);
}

export async function listRecentAttemptMessagesForRotation(
  userId: number,
  chipId: number,
  executionType: "dispatch" | "maturation",
  limit = 5
) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      messageContent: executionAttempts.messageContent,
      createdAt: executionAttempts.createdAt,
    })
    .from(executionAttempts)
    .innerJoin(executionJobs, eq(executionAttempts.jobId, executionJobs.id))
    .where(
      and(
        eq(executionAttempts.userId, userId),
        eq(executionAttempts.chipId, chipId),
        eq(executionAttempts.actionType, "message"),
        eq(executionJobs.executionType, executionType)
      )
    )
    .orderBy(desc(executionAttempts.createdAt))
    .limit(limit);

  return rows.map((row) => row.messageContent?.trim()).filter(Boolean) as string[];
}

export async function getMessageRotationContext(
  userId: number,
  chipId: number,
  executionType: "dispatch" | "maturation",
  targetValue?: string,
  limit = 20
) {
  const db = await getDb();
  if (!db) {
    return {
      recentMessages: [] as string[],
      recentMessagesForTarget: [] as string[],
      recentUsageCounts: {} as Record<string, number>,
    };
  }

  const rows = await db
    .select({
      messageContent: executionAttempts.messageContent,
      targetValue: executionAttempts.targetValue,
      createdAt: executionAttempts.createdAt,
    })
    .from(executionAttempts)
    .innerJoin(executionJobs, eq(executionAttempts.jobId, executionJobs.id))
    .where(
      and(
        eq(executionAttempts.userId, userId),
        eq(executionAttempts.chipId, chipId),
        eq(executionAttempts.actionType, "message"),
        eq(executionJobs.executionType, executionType)
      )
    )
    .orderBy(desc(executionAttempts.createdAt))
    .limit(limit);

  const recentMessages: string[] = [];
  const recentMessagesForTarget: string[] = [];
  const recentUsageCounts: Record<string, number> = {};

  for (const row of rows) {
    const message = row.messageContent?.trim();
    if (!message) continue;

    recentMessages.push(message);
    recentUsageCounts[message] = (recentUsageCounts[message] || 0) + 1;

    if (targetValue && row.targetValue?.trim() === targetValue) {
      recentMessagesForTarget.push(message);
    }
  }

  return {
    recentMessages,
    recentMessagesForTarget,
    recentUsageCounts,
  };
}

export async function getTargetOperationalSnapshot(
  userId: number,
  chipId: number,
  targetValue: string,
  limit = 100
) {
  const db = await getDb();
  if (!db) {
    return {
      lastSentAt: null as Date | null,
      sentLastHour: 0,
      sentLastDay: 0,
      recentSuccesses: [] as Date[],
    };
  }

  const rows = await db
    .select({
      executedAt: executionAttempts.executedAt,
      createdAt: executionAttempts.createdAt,
    })
    .from(executionAttempts)
    .where(
      and(
        eq(executionAttempts.userId, userId),
        eq(executionAttempts.chipId, chipId),
        eq(executionAttempts.targetValue, targetValue),
        eq(executionAttempts.actionType, "message"),
        eq(executionAttempts.status, "success")
      )
    )
    .orderBy(desc(executionAttempts.createdAt))
    .limit(limit);

  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const timestamps = rows
    .map((row) => row.executedAt || row.createdAt)
    .filter(Boolean)
    .map((value) => new Date(value as Date));

  return {
    lastSentAt: timestamps[0] || null,
    sentLastHour: timestamps.filter((date) => date.getTime() >= hourAgo).length,
    sentLastDay: timestamps.filter((date) => date.getTime() >= dayAgo).length,
    recentSuccesses: timestamps,
  };
}

export async function resolveUserMaturationTargets(
  userId: number,
  options?: { excludeChipId?: number; targetType?: "number" | "group" | "chip" }
) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(maturationTargets.userId, userId), eq(maturationTargets.isActive, 1)];
  if (options?.targetType) {
    conditions.push(eq(maturationTargets.targetType, options.targetType));
  }

  const targets = await db
    .select()
    .from(maturationTargets)
    .where(and(...conditions))
    .orderBy(desc(maturationTargets.updatedAt));

  const resolvedTargets = new Set<string>();

  for (const target of targets) {
    if (target.targetType === "chip") {
      const chipId = Number(target.targetValue);
      if (Number.isNaN(chipId) || chipId === options?.excludeChipId) continue;

      const chip = await getChipById(chipId);
      if (chip?.userId === userId && chip.phoneNumber) {
        try {
          resolvedTargets.add(normalizeTargetValue(chip.phoneNumber.trim(), "number").normalizedValue);
        } catch {
          // ignora chip com número malformado
        }
      }
      continue;
    }

    try {
      resolvedTargets.add(normalizeTargetValue(target.targetValue.trim(), target.targetType).normalizedValue);
    } catch {
      // ignora target inválido legado
    }
  }

  return Array.from(resolvedTargets).filter(Boolean);
}


// ============================================
// CHIP MANAGEMENT

export async function updateChipStatus(chipId: number, status: "conectado" | "maturando" | "desconectado") {
  const db = await getDb();
  if (!db) return null;

  try {
    return await db.update(whatsappChips).set({ status, updatedAt: new Date() }).where(eq(whatsappChips.id, chipId));
  } catch (error) {
    console.error("[Database] Failed to update chip status:", error);
    throw error;
  }
}

export async function updateChipPauseState(chipId: number, isPaused: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    return await db
      .update(whatsappChips)
      .set({ isPaused, updatedAt: new Date() })
      .where(eq(whatsappChips.id, chipId));
  } catch (error) {
    console.error("[Database] Failed to update chip pause state:", error);
    throw error;
  }
}

export async function updateChipPhoneNumber(chipId: number, phoneNumber: string | null) {
  const db = await getDb();
  if (!db) return null;

  try {
    return await db
      .update(whatsappChips)
      .set({ phoneNumber, updatedAt: new Date() })
      .where(eq(whatsappChips.id, chipId));
  } catch (error) {
    console.error("[Database] Failed to update chip phone number:", error);
    throw error;
  }
}

export async function createActivityLog(data: {
  userId?: number;
  chipId: number;
  actionType: "message_sent" | "image_sent" | "audio_sent" | "reaction_sent" | "message_received" | "connection" | "disconnection" | "error";
  targetNumber?: string;
  targetGroup?: string;
  messageContent?: string;
  status?: "success" | "failed" | "pending";
  errorMessage?: string;
}) {
  const db = await getDb();
  if (!db) return null;

  try {
    // Get chip to find userId if not provided
    let userId = data.userId;
    if (!userId) {
      const chip = await db.select().from(whatsappChips).where(eq(whatsappChips.id, data.chipId)).limit(1);
      if (chip.length > 0) {
        userId = chip[0].userId;
      }
    }

    if (!userId) {
      throw new Error("Cannot create activity log without userId");
    }

    return await db.insert(activityLogs).values({
      userId,
      chipId: data.chipId,
      actionType: data.actionType,
      targetNumber: data.targetNumber,
      targetGroup: data.targetGroup,
      messageContent: data.messageContent,
      status: data.status || "pending",
      errorMessage: data.errorMessage,
    });
  } catch (error) {
    console.error("[Database] Failed to create activity log:", error);
    throw error;
  }
}


// ============================================
// SCHEDULED TASKS MANAGEMENT
// ============================================

export async function createScheduledTask(data: {
  userId: number;
  chipId: number;
  taskName: string;
  targetType: "group" | "number" | "list";
  targetData: string;
  messageTemplate?: string;
  scheduleCron?: string;
  scheduleTime?: string;
  intervalSeconds?: number;
  isActive?: number;
}) {
  const db = await getDb();
  if (!db) return null;

  try {
    return await db.insert(scheduledTasks).values({
      userId: data.userId,
      chipId: data.chipId,
      taskName: data.taskName,
      targetType: data.targetType,
      targetData: data.targetData,
      messageTemplate: data.messageTemplate,
      scheduleCron: data.scheduleCron,
      scheduleTime: data.scheduleTime,
      intervalSeconds: data.intervalSeconds || 5,
      isActive: data.isActive ?? 1,
    });
  } catch (error) {
    console.error("[Database] Failed to create scheduled task:", error);
    throw error;
  }
}

export async function updateScheduledTask(taskId: number, data: Partial<{
  taskName: string;
  messageTemplate: string;
  scheduleCron: string;
  scheduleTime: string;
  intervalSeconds: number;
  isActive: number;
}>) {
  const db = await getDb();
  if (!db) return null;

  try {
    return await db.update(scheduledTasks).set({ ...data, updatedAt: new Date() }).where(eq(scheduledTasks.id, taskId));
  } catch (error) {
    console.error("[Database] Failed to update scheduled task:", error);
    throw error;
  }
}


export async function getScheduledTaskById(taskId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(scheduledTasks).where(eq(scheduledTasks.id, taskId)).limit(1);
  return result.length > 0 ? result[0] : null;
}


export async function getChipActivityLogs(chipId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(activityLogs).where(eq(activityLogs.chipId, chipId)).limit(limit);
}

export async function createChip(data: {
  userId: number;
  chipName: string;
  phoneNumber?: string;
  maturationProfile?: "suave" | "normal" | "ultra";
  status?: "conectado" | "maturando" | "desconectado";
}) {
  const db = await getDb();
  if (!db) return null;

  let insertId = 0;
  try {
    const result = await db.insert(whatsappChips).values({
      userId: data.userId,
      chipName: data.chipName,
      phoneNumber: data.phoneNumber,
      maturationProfile: data.maturationProfile || "normal",
      status: data.status || "desconectado",
      isPaused: 0,
    });

    insertId = Number((result as any).insertId ?? (result as any)[0]?.insertId ?? 0);
    if (!insertId) {
      throw new Error("Chip criado, mas não foi possível identificar o ID gerado");
    }

    await ensureChipPersonaTable();
    const personaDraft = generateRandomPersonaDraft({
      chipId: insertId,
      chipName: data.chipName,
      phoneNumber: data.phoneNumber ?? null,
    });

    await db.insert(chipPersona).values({
      chipId: insertId,
      displayName: personaDraft.displayName,
      homeState: personaDraft.homeState,
      homeCity: personaDraft.homeCity,
      primaryDDD: personaDraft.primaryDDD,
      secondaryDDDs: JSON.stringify(personaDraft.secondaryDDDs),
      profession: personaDraft.profession,
      ageRange: personaDraft.ageRange,
      socialProfile: personaDraft.socialProfile,
      wakeHour: personaDraft.wakeHour,
      sleepHour: personaDraft.sleepHour,
      weekendProfile: personaDraft.weekendProfile,
      interests: JSON.stringify(personaDraft.interests),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return await getChipById(insertId);
  } catch (error) {
    if (insertId > 0) {
      try {
        await db.delete(chipPersona).where(eq(chipPersona.chipId, insertId));
      } catch {}
      try {
        await db.delete(whatsappChips).where(eq(whatsappChips.id, insertId));
      } catch (cleanupError) {
        console.warn("[Database] Failed to rollback chip after persona failure:", cleanupError);
      }
    }
    console.error("[Database] Failed to create chip:", error);
    throw error;
  }
}

export async function deleteChip(chipId: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    await ensureChipHealthTable();
    await ensureChipBehaviorScoresTable();
    await ensureChipRiskStateTable();
    await ensureChipRoutineStateTable();
    await ensureChipIdentityEvolutionTable();
    await ensureChipCertificationStateTable();
    await ensureChipGroupsTable();
    await ensureChipRelationshipsTable();
    await ensureChipSocialGraphTable();
    await ensureChipLearningMetricsTable();
    await ensureEcosystemEventsTable();
    await ensureAuditEventsTable();
    await ensureChipCertificationsTable();
    await ensureChipPersonaTable();
    await ensureBehaviorMemoryTable();
    await db.delete(activityLogs).where(eq(activityLogs.chipId, chipId));
    await db.delete(behaviorTimelineEvents).where(eq(behaviorTimelineEvents.chipId, chipId));
    await db.delete(behaviorMemorySnapshots).where(eq(behaviorMemorySnapshots.chipId, chipId));
    await db.delete(chipHealth).where(eq(chipHealth.chipId, chipId));
    await db.delete(chipBehaviorScores).where(eq(chipBehaviorScores.chipId, chipId));
    await db.delete(chipRiskState).where(eq(chipRiskState.chipId, chipId));
    await db.delete(chipRoutineState).where(eq(chipRoutineState.chipId, chipId));
    await db.delete(chipIdentityEvolution).where(eq(chipIdentityEvolution.chipId, chipId));
    await db.delete(chipCertificationState).where(eq(chipCertificationState.chipId, chipId));
    await db.delete(chipGroups).where(eq(chipGroups.chipId, chipId));
    await db.delete(chipRelationships).where(eq(chipRelationships.chipId, chipId));
    await db.delete(chipSocialGraph).where(eq(chipSocialGraph.chipId, chipId));
    await db.delete(chipLearningMetrics).where(eq(chipLearningMetrics.chipId, chipId));
    await db.delete(ecosystemEvents).where(or(eq(ecosystemEvents.sourceChipId, chipId), eq(ecosystemEvents.targetChipId, chipId)));
    await db.delete(auditEvents).where(eq(auditEvents.chipId, chipId));
    await db.delete(chipCertifications).where(eq(chipCertifications.chipId, chipId));
    await db.delete(chipPersona).where(eq(chipPersona.chipId, chipId));
    await db.delete(scheduledTasks).where(eq(scheduledTasks.chipId, chipId));
    const jobs = await db.select({ id: executionJobs.id }).from(executionJobs).where(eq(executionJobs.chipId, chipId));
    for (const job of jobs) {
      await db.delete(executionAttempts).where(eq(executionAttempts.jobId, job.id));
    }
    await db.delete(executionJobs).where(eq(executionJobs.chipId, chipId));
    await db.delete(maturationTargets).where(
      and(eq(maturationTargets.targetType, "chip"), eq(maturationTargets.targetValue, String(chipId)))
    );
    return await db.delete(whatsappChips).where(eq(whatsappChips.id, chipId));
  } catch (error) {
    console.error("[Database] Failed to delete chip:", error);
    throw error;
  }
}
