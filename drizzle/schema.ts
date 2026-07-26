import { index, int, mediumtext, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  profileImageUrl: mediumtext("profileImageUrl"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Subscription Plans
 * Defines available plans with limits
 */
export const subscriptionPlans = mysqlTable("subscription_plans", {
  id: int("id").autoincrement().primaryKey(),
  planName: varchar("planName", { length: 100 }).notNull().unique(),
  description: text("description"),
  maxChips: int("maxChips").notNull(),
  maxMessagesPerMonth: int("maxMessagesPerMonth").notNull(),
  maxScheduledTasks: int("maxScheduledTasks").notNull(),
  priceMonthly: int("priceMonthly").notNull(),
  priceYearly: int("priceYearly"),
  features: text("features"),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

/**
 * User Subscriptions
 * Tracks which plan each user is subscribed to
 */
export const userSubscriptions = mysqlTable("user_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique().references(() => users.id),
  planId: int("planId").notNull().references(() => subscriptionPlans.id),
  status: mysqlEnum("status", ["active", "cancelled", "expired", "trial"]).default("trial").notNull(),
  currentChipsCount: int("currentChipsCount").default(0).notNull(),
  currentMessagesThisMonth: int("currentMessagesThisMonth").default(0).notNull(),
  currentTasksCount: int("currentTasksCount").default(0).notNull(),
  subscriptionStartDate: timestamp("subscriptionStartDate").defaultNow().notNull(),
  subscriptionEndDate: timestamp("subscriptionEndDate"),
  trialEndDate: timestamp("trialEndDate"),
  autoRenew: int("autoRenew").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = typeof userSubscriptions.$inferInsert;

/**
 * WhatsApp Chip Management
 * Stores all connected WhatsApp chips and their session data
 */
export const whatsappChips = mysqlTable("whatsapp_chips", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipName: varchar("chipName", { length: 255 }).notNull(),
  phoneNumber: varchar("phoneNumber", { length: 20 }),
  status: mysqlEnum("status", ["conectado", "maturando", "desconectado"]).default("desconectado").notNull(),
  maturationProfile: mysqlEnum("maturationProfile", ["suave", "normal", "ultra"]).default("normal").notNull(),
  sessionData: text("sessionData"),
  qrCode: text("qrCode"),
  isPaused: int("isPaused").default(0).notNull(),
  lastActivity: timestamp("lastActivity"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WhatsappChip = typeof whatsappChips.$inferSelect;
export type InsertWhatsappChip = typeof whatsappChips.$inferInsert;

/**
 * Chip Persona
 * Identidade persistente que ancora o comportamento do chip.
 */
export const chipPersona = mysqlTable("chip_persona", {
  id: int("id").autoincrement().primaryKey(),
  chipId: int("chipId").notNull().unique().references(() => whatsappChips.id),
  displayName: varchar("displayName", { length: 120 }).notNull(),
  homeState: varchar("homeState", { length: 60 }).notNull(),
  homeCity: varchar("homeCity", { length: 120 }).notNull(),
  primaryDDD: varchar("primaryDDD", { length: 4 }).notNull(),
  secondaryDDDs: text("secondaryDDDs"),
  profession: varchar("profession", { length: 120 }).notNull(),
  ageRange: varchar("ageRange", { length: 40 }).notNull(),
  socialProfile: varchar("socialProfile", { length: 80 }).notNull(),
  wakeHour: int("wakeHour").default(8).notNull(),
  sleepHour: int("sleepHour").default(22).notNull(),
  weekendProfile: varchar("weekendProfile", { length: 80 }).notNull(),
  interests: text("interests"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChipPersonaRow = typeof chipPersona.$inferSelect;
export type InsertChipPersonaRow = typeof chipPersona.$inferInsert;

/**
 * Chip Event History
 * Stream oficial append-only do domínio do chip.
 * Não depende da projeção operacional atual de whatsapp_chips.
 */
export const chipEventHistory = mysqlTable(
  "chip_event_history",
  {
    id: int("id").autoincrement().primaryKey(),
    eventId: varchar("eventId", { length: 191 }).notNull(),
    chipId: varchar("chipId", { length: 191 }).notNull(),
    eventType: varchar("eventType", { length: 100 }).notNull(),
    eventVersion: int("eventVersion").notNull(),
    sequence: int("sequence").notNull(),
    occurredAt: timestamp("occurredAt").notNull(),
    recordedAt: timestamp("recordedAt").defaultNow().notNull(),
    payload: mediumtext("payload").notNull(),
    metadata: mediumtext("metadata"),
  },
  (table) => ({
    eventIdUnique: uniqueIndex("ux_chip_event_history_eventId").on(table.eventId),
    chipSequenceUnique: uniqueIndex("ux_chip_event_history_chipId_sequence").on(table.chipId, table.sequence),
    chipSequenceIndex: index("ix_chip_event_history_chipId_sequence").on(table.chipId, table.sequence),
  })
);

export type ChipEventHistoryRow = typeof chipEventHistory.$inferSelect;
export type InsertChipEventHistoryRow = typeof chipEventHistory.$inferInsert;

/**
 * Chip State Projections
 * Read model derivado do histórico oficial para consultas rápidas.
 */
export const chipStateProjections = mysqlTable(
  "chip_state_projections",
  {
    id: int("id").autoincrement().primaryKey(),
    chipId: varchar("chipId", { length: 191 }).notNull(),
    currentState: varchar("currentState", { length: 64 }),
    previousState: varchar("previousState", { length: 64 }),
    lastSequence: int("lastSequence"),
    inconsistencyCount: int("inconsistencyCount").default(0).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    chipIdUnique: uniqueIndex("ux_chip_state_projections_chipId").on(table.chipId),
  })
);

export type ChipStateProjectionRow = typeof chipStateProjections.$inferSelect;
export type InsertChipStateProjectionRow = typeof chipStateProjections.$inferInsert;

/**
 * Chip Worker Checkpoints
 * Cursor persistido por worker para consumo assíncrono de fatos oficiais.
 */
export const chipWorkerCheckpoints = mysqlTable(
  "chip_worker_checkpoints",
  {
    id: int("id").autoincrement().primaryKey(),
    workerName: varchar("workerName", { length: 120 }).notNull(),
    lastOffset: int("lastOffset").default(0).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    workerNameUnique: uniqueIndex("ux_chip_worker_checkpoints_workerName").on(table.workerName),
  })
);

export type ChipWorkerCheckpointRow = typeof chipWorkerCheckpoints.$inferSelect;
export type InsertChipWorkerCheckpointRow = typeof chipWorkerCheckpoints.$inferInsert;

/**
 * Chip Audit Evidences
 * Evidências append-only da Auditoria. Nunca sofrem atualização in-place.
 */
export const chipAuditEvidences = mysqlTable(
  "chip_audit_evidences",
  {
    id: int("id").autoincrement().primaryKey(),
    evidenceId: varchar("evidenceId", { length: 191 }).notNull(),
    chipId: varchar("chipId", { length: 191 }).notNull(),
    evidenceType: varchar("evidenceType", { length: 64 }).notNull(),
    recordedAt: timestamp("recordedAt").defaultNow().notNull(),
    payload: mediumtext("payload").notNull(),
  },
  (table) => ({
    evidenceIdUnique: uniqueIndex("ux_chip_audit_evidences_evidenceId").on(table.evidenceId),
    chipIdRecordedAtIndex: index("ix_chip_audit_evidences_chipId_recordedAt").on(table.chipId, table.recordedAt),
  })
);

export type ChipAuditEvidenceRow = typeof chipAuditEvidences.$inferSelect;
export type InsertChipAuditEvidenceRow = typeof chipAuditEvidences.$inferInsert;

/**
 * Maturation Profiles Configuration
 * Defines behavior parameters for each maturation level
 */
export const maturationProfiles = mysqlTable("maturation_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  profileName: mysqlEnum("profileName", ["suave", "normal", "ultra"]).notNull(),
  minMessageDelay: int("minMessageDelay").default(5000).notNull(),
  maxMessageDelay: int("maxMessageDelay").default(15000).notNull(),
  messageFrequencyPerDay: int("messageFrequencyPerDay").default(10).notNull(),
  typingIndicatorDuration: int("typingIndicatorDuration").default(2000).notNull(),
  audioSimulationDuration: int("audioSimulationDuration").default(3000).notNull(),
  reactionProbability: int("reactionProbability").default(30).notNull(),
  imageSendProbability: int("imageSendProbability").default(20).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MaturationProfile = typeof maturationProfiles.$inferSelect;
export type InsertMaturationProfile = typeof maturationProfiles.$inferInsert;

/**
 * Scheduled Tasks
 * Stores scheduled message broadcasts
 */
export const scheduledTasks = mysqlTable("scheduled_tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().references(() => whatsappChips.id),
  taskName: varchar("taskName", { length: 255 }).notNull(),
  targetType: mysqlEnum("targetType", ["group", "number", "list"]).notNull(),
  targetData: text("targetData").notNull(),
  messageTemplate: text("messageTemplate"),
  scheduleCron: varchar("scheduleCron", { length: 100 }),
  scheduleTime: varchar("scheduleTime", { length: 50 }),
  intervalSeconds: int("intervalSeconds").default(5).notNull(),
  isActive: int("isActive").default(1).notNull(),
  lastExecutedAt: timestamp("lastExecutedAt"),
  lastRunStatus: varchar("lastRunStatus", { length: 32 }),
  lastRunError: text("lastRunError"),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScheduledTask = typeof scheduledTasks.$inferSelect;
export type InsertScheduledTask = typeof scheduledTasks.$inferInsert;

/**
 * Activity Logs
 * Complete history of all chip activities
 */
export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().references(() => whatsappChips.id),
  actionType: mysqlEnum("actionType", ["message_sent", "image_sent", "audio_sent", "reaction_sent", "message_received", "connection", "disconnection", "error"]).notNull(),
  targetNumber: varchar("targetNumber", { length: 20 }),
  targetGroup: varchar("targetGroup", { length: 255 }),
  messageContent: text("messageContent"),
  status: mysqlEnum("status", ["success", "failed", "pending"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

/**
 * Behavior Timeline Events
 * Event store mínimo e auditável para reconstruir o comportamento real do chip.
 */
export const behaviorTimelineEvents = mysqlTable("behavior_timeline_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().references(() => whatsappChips.id),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  source: varchar("source", { length: 64 }).notNull(),
  direction: varchar("direction", { length: 20 }),
  remoteJid: varchar("remoteJid", { length: 255 }),
  remoteType: varchar("remoteType", { length: 20 }),
  remoteLabel: varchar("remoteLabel", { length: 255 }),
  messageId: varchar("messageId", { length: 128 }),
  relatedMessageId: varchar("relatedMessageId", { length: 128 }),
  ackType: varchar("ackType", { length: 64 }),
  groupJid: varchar("groupJid", { length: 255 }),
  groupSubject: varchar("groupSubject", { length: 255 }),
  contentPreview: text("contentPreview"),
  payload: mediumtext("payload"),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BehaviorTimelineEvent = typeof behaviorTimelineEvents.$inferSelect;
export type InsertBehaviorTimelineEvent = typeof behaviorTimelineEvents.$inferInsert;

/**
 * Behavior Memory Snapshots
 * Camada intermediária entre evidência bruta e identidade futura.
 * Guarda resumos de histórico, repetição e variação sem alterar o motor atual.
 */
export const behaviorMemorySnapshots = mysqlTable("behavior_memory_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().references(() => whatsappChips.id),
  windowStart: timestamp("windowStart").notNull(),
  windowEnd: timestamp("windowEnd").notNull(),
  sampleDays: int("sampleDays").default(1).notNull(),
  firstActionAt: timestamp("firstActionAt"),
  lastActionAt: timestamp("lastActionAt"),
  totalActions: int("totalActions").default(0).notNull(),
  distinctActionTypes: int("distinctActionTypes").default(0).notNull(),
  repetitionScore: int("repetitionScore").default(0).notNull(),
  variationScore: int("variationScore").default(0).notNull(),
  actionSequence: text("actionSequence"),
  activeHourBuckets: text("activeHourBuckets"),
  responseDelayBuckets: text("responseDelayBuckets"),
  idleWindows: text("idleWindows"),
  patternSignature: varchar("patternSignature", { length: 255 }),
  payload: mediumtext("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BehaviorMemorySnapshot = typeof behaviorMemorySnapshots.$inferSelect;
export type InsertBehaviorMemorySnapshot = typeof behaviorMemorySnapshots.$inferInsert;

/**
 * Behavior Outcomes
 * Verdade-terreno observada para confrontar previsões do pipeline com o que de fato aconteceu.
 */
export const behaviorOutcomes = mysqlTable("behavior_outcomes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().references(() => whatsappChips.id),
  observationWindowStart: timestamp("observationWindowStart").notNull(),
  observationWindowEnd: timestamp("observationWindowEnd").notNull(),
  predictedRisk: int("predictedRisk").default(0).notNull(),
  predictedCredibility: int("predictedCredibility").default(0).notNull(),
  actualOutcome: mysqlEnum("actualOutcome", ["unknown", "healthy", "warning", "restriction", "ban"]).default("unknown").notNull(),
  restrictionOccurred: int("restrictionOccurred").default(0).notNull(),
  warningOccurred: int("warningOccurred").default(0).notNull(),
  banOccurred: int("banOccurred").default(0).notNull(),
  humanLikeOutcome: mysqlEnum("humanLikeOutcome", ["unknown", "human_like", "not_human_like", "uncertain"])
    .default("unknown")
    .notNull(),
  validatedAt: timestamp("validatedAt"),
  payload: mediumtext("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BehaviorOutcome = typeof behaviorOutcomes.$inferSelect;
export type InsertBehaviorOutcome = typeof behaviorOutcomes.$inferInsert;

/**
 * Behavior Opportunity Observations
 * Histórico de oportunidades observadas e do custo de decidir não agir.
 */
export const behaviorOpportunityObservations = mysqlTable("behavior_opportunity_observations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().references(() => whatsappChips.id),
  opportunityId: varchar("opportunityId", { length: 128 }).notNull(),
  observedAt: timestamp("observedAt").defaultNow().notNull(),
  reason: text("reason").notNull(),
  riskAtDecision: int("riskAtDecision").default(0).notNull(),
  confidence: int("confidence").default(0).notNull(),
  expectedGain: int("expectedGain").default(0).notNull(),
  expectedRisk: int("expectedRisk").default(0).notNull(),
  decision: mysqlEnum("decision", ["ACT_NOW", "WAIT", "DO_NOTHING"]).default("DO_NOTHING").notNull(),
  observedResultAfter24h: text("observedResultAfter24h"),
  observedResultAfter72h: text("observedResultAfter72h"),
  observedResultAfter7d: text("observedResultAfter7d"),
  payload: mediumtext("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BehaviorOpportunityObservation = typeof behaviorOpportunityObservations.$inferSelect;
export type InsertBehaviorOpportunityObservation = typeof behaviorOpportunityObservations.$inferInsert;

/**
 * Maturation Experience Journal
 * Memória longitudinal de experiências observadas e decisões da maturação.
 */
export const maturationExperienceJournal = mysqlTable("maturation_experience_journal", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().references(() => whatsappChips.id),
  chapterId: varchar("chapterId", { length: 128 }).notNull(),
  chapterType: mysqlEnum("chapterType", ["snapshot", "opportunity", "recovery", "silence"]).default("snapshot").notNull(),
  observedAt: timestamp("observedAt").defaultNow().notNull(),
  contextHash: varchar("contextHash", { length: 128 }),
  strategyChosen: varchar("strategyChosen", { length: 128 }),
  actionTaken: varchar("actionTaken", { length: 128 }),
  riskBefore: int("riskBefore").default(0).notNull(),
  riskAfter: int("riskAfter").default(0).notNull(),
  credibilityBefore: int("credibilityBefore").default(0).notNull(),
  credibilityAfter: int("credibilityAfter").default(0).notNull(),
  outcome24h: text("outcome24h"),
  outcome72h: text("outcome72h"),
  outcome7d: text("outcome7d"),
  payload: mediumtext("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MaturationExperienceJournalEntry = typeof maturationExperienceJournal.$inferSelect;
export type InsertMaturationExperienceJournalEntry = typeof maturationExperienceJournal.$inferInsert;

/**
 * Relationship Memories
 * Estado observado atual por relacionamento entre chip e contraparte.
 */
export const relationshipMemories = mysqlTable("relationship_memories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().references(() => whatsappChips.id),
  counterpartKey: varchar("counterpartKey", { length: 191 }).notNull(),
  counterpartType: mysqlEnum("counterpartType", ["contact", "group", "unknown"]).default("unknown").notNull(),
  stage: mysqlEnum("stage", ["unknown", "known", "trust", "recurring", "inactive"]).default("unknown").notNull(),
  firstInteractionAt: timestamp("firstInteractionAt"),
  lastInteractionAt: timestamp("lastInteractionAt"),
  trustScore: int("trustScore").default(0).notNull(),
  relationshipRisk: int("relationshipRisk").default(0).notNull(),
  idealContactFrequencyHours: int("idealContactFrequencyHours").default(0).notNull(),
  payload: mediumtext("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RelationshipMemory = typeof relationshipMemories.$inferSelect;
export type InsertRelationshipMemory = typeof relationshipMemories.$inferInsert;

/**
 * Chip Groups
 * Participação social do chip em grupos observados ou criados.
 */
export const chipGroups = mysqlTable("chip_groups", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().references(() => whatsappChips.id),
  groupJid: varchar("groupJid", { length: 255 }).notNull(),
  groupName: varchar("groupName", { length: 255 }),
  origin: mysqlEnum("origin", ["internal", "manual_invite", "catalog", "runtime_discovery"]).default("runtime_discovery").notNull(),
  category: varchar("category", { length: 120 }),
  joinedAt: timestamp("joinedAt"),
  leftAt: timestamp("leftAt"),
  lastInteraction: timestamp("lastInteraction"),
  role: varchar("role", { length: 40 }).default("member").notNull(),
  status: mysqlEnum("status", ["candidate", "joined", "left", "blocked"]).default("candidate").notNull(),
  inviteLink: text("inviteLink"),
  risk: int("risk").default(0).notNull(),
  payload: mediumtext("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChipGroup = typeof chipGroups.$inferSelect;
export type InsertChipGroup = typeof chipGroups.$inferInsert;

/**
 * Group Catalog
 * Lista curada e reutilizável de grupos candidatos.
 */
export const groupCatalog = mysqlTable("group_catalog", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  category: varchar("category", { length: 120 }).notNull(),
  city: varchar("city", { length: 120 }),
  ddd: varchar("ddd", { length: 4 }),
  link: text("link"),
  active: int("active").default(1).notNull(),
  risk: int("risk").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GroupCatalogEntry = typeof groupCatalog.$inferSelect;
export type InsertGroupCatalogEntry = typeof groupCatalog.$inferInsert;

/**
 * Chip Relationships
 * Memória operacional resumida por contato.
 */
export const chipRelationships = mysqlTable("chip_relationships", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().references(() => whatsappChips.id),
  contact: varchar("contact", { length: 191 }).notNull(),
  interactions: int("interactions").default(0).notNull(),
  lastSeen: timestamp("lastSeen"),
  trustScore: int("trustScore").default(0).notNull(),
  conversationLevel: int("conversationLevel").default(0).notNull(),
  firstInteraction: timestamp("firstInteraction"),
  lastInteraction: timestamp("lastInteraction"),
  favorite: int("favorite").default(0).notNull(),
  payload: mediumtext("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChipRelationship = typeof chipRelationships.$inferSelect;
export type InsertChipRelationship = typeof chipRelationships.$inferInsert;

/**
 * Chip Social Graph
 * Memória relacional explícita entre contatos, grupos e afinidades.
 */
export const chipSocialGraph = mysqlTable("chip_social_graph", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().references(() => whatsappChips.id),
  entityType: mysqlEnum("entityType", ["contact", "group"]).notNull(),
  entityId: varchar("entityId", { length: 191 }).notNull(),
  label: varchar("label", { length: 255 }),
  trust: int("trust").default(0).notNull(),
  interactionCount: int("interactionCount").default(0).notNull(),
  lastSeen: timestamp("lastSeen"),
  relationshipLevel: int("relationshipLevel").default(0).notNull(),
  favorite: int("favorite").default(0).notNull(),
  payload: mediumtext("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChipSocialGraph = typeof chipSocialGraph.$inferSelect;
export type InsertChipSocialGraph = typeof chipSocialGraph.$inferInsert;

/**
 * Learning Hypotheses
 * Hipóteses observacionais geradas e revalidadas pelo domínio de aprendizado.
 */
export const learningHypotheses = mysqlTable("learning_hypotheses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  hypothesisKey: varchar("hypothesisKey", { length: 191 }).notNull(),
  status: mysqlEnum("status", ["draft", "candidate", "validated", "knowledge", "deprecated", "archived"]).default("draft").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  confidence: int("confidence").default(0).notNull(),
  sampleSize: int("sampleSize").default(0).notNull(),
  successRate: int("successRate").default(0).notNull(),
  contradictionRate: int("contradictionRate").default(0).notNull(),
  temporalStability: int("temporalStability").default(0).notNull(),
  segmentConsistency: int("segmentConsistency").default(0).notNull(),
  lastValidatedAt: timestamp("lastValidatedAt"),
  payload: mediumtext("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LearningHypothesis = typeof learningHypotheses.$inferSelect;
export type InsertLearningHypothesis = typeof learningHypotheses.$inferInsert;

/**
 * Knowledge Base Items
 * Conhecimento vivo derivado de hipóteses validadas e sujeito a decaimento.
 */
export const knowledgeBaseItems = mysqlTable("knowledge_base_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  knowledgeKey: varchar("knowledgeKey", { length: 191 }).notNull(),
  sourceHypothesisKey: varchar("sourceHypothesisKey", { length: 191 }),
  status: mysqlEnum("status", ["candidate", "active", "decaying", "retired", "archived"]).default("candidate").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  confidence: int("confidence").default(0).notNull(),
  usageCount: int("usageCount").default(0).notNull(),
  successRate: int("successRate").default(0).notNull(),
  decayRate: int("decayRate").default(0).notNull(),
  expiresAt: timestamp("expiresAt"),
  lastValidatedAt: timestamp("lastValidatedAt"),
  payload: mediumtext("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KnowledgeBaseItem = typeof knowledgeBaseItems.$inferSelect;
export type InsertKnowledgeBaseItem = typeof knowledgeBaseItems.$inferInsert;

/**
 * Learning Engine Events
 * Trilha auditável das observações, promoções, revalidações e aposentadorias.
 */
export const learningEngineEvents = mysqlTable("learning_engine_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").references(() => whatsappChips.id),
  eventType: mysqlEnum("eventType", ["observed", "validated", "promoted", "revalidated", "retired", "contradicted"]).notNull(),
  referenceKey: varchar("referenceKey", { length: 191 }).notNull(),
  observedAt: timestamp("observedAt").defaultNow().notNull(),
  payload: mediumtext("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LearningEngineEvent = typeof learningEngineEvents.$inferSelect;
export type InsertLearningEngineEvent = typeof learningEngineEvents.$inferInsert;

/**
 * Fleet Learning Cohorts
 * Coortes agregadas da frota para aprender por perfil de maturação, exposição e risco.
 */
export const fleetLearningCohorts = mysqlTable("fleet_learning_cohorts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  cohortKey: varchar("cohortKey", { length: 191 }).notNull(),
  status: mysqlEnum("status", ["emerging", "stable", "elite", "critical"]).default("emerging").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  chipCount: int("chipCount").default(0).notNull(),
  averageSuccessRate: int("averageSuccessRate").default(0).notNull(),
  averageRiskScore: int("averageRiskScore").default(0).notNull(),
  averageCredibilityScore: int("averageCredibilityScore").default(0).notNull(),
  lastComputedAt: timestamp("lastComputedAt"),
  payload: mediumtext("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FleetLearningCohort = typeof fleetLearningCohorts.$inferSelect;
export type InsertFleetLearningCohort = typeof fleetLearningCohorts.$inferInsert;

/**
 * Fleet Learning Patterns
 * Padrões observados na frota que podem ser promovidos a conhecimento compartilhado.
 */
export const fleetLearningPatterns = mysqlTable("fleet_learning_patterns", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  patternKey: varchar("patternKey", { length: 191 }).notNull(),
  cohortKey: varchar("cohortKey", { length: 191 }).notNull(),
  status: mysqlEnum("status", ["candidate", "promoted", "active", "retired"]).default("candidate").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  confidence: int("confidence").default(0).notNull(),
  sampleSize: int("sampleSize").default(0).notNull(),
  successRate: int("successRate").default(0).notNull(),
  riskScore: int("riskScore").default(0).notNull(),
  recommendationType: varchar("recommendationType", { length: 120 }).notNull(),
  lastValidatedAt: timestamp("lastValidatedAt"),
  payload: mediumtext("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FleetLearningPattern = typeof fleetLearningPatterns.$inferSelect;
export type InsertFleetLearningPattern = typeof fleetLearningPatterns.$inferInsert;

/**
 * Fleet Knowledge Promotions
 * Trilha auditável de promoção do aprendizado da frota para a base de conhecimento.
 */
export const fleetKnowledgePromotions = mysqlTable("fleet_knowledge_promotions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  sourcePatternKey: varchar("sourcePatternKey", { length: 191 }).notNull(),
  targetKnowledgeKey: varchar("targetKnowledgeKey", { length: 191 }).notNull(),
  action: mysqlEnum("action", ["observe", "promote", "revalidate", "retire"]).notNull(),
  observedAt: timestamp("observedAt").defaultNow().notNull(),
  payload: mediumtext("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FleetKnowledgePromotion = typeof fleetKnowledgePromotions.$inferSelect;
export type InsertFleetKnowledgePromotion = typeof fleetKnowledgePromotions.$inferInsert;

/**
 * Chip Health
 * Snapshot operacional simples para medir estabilidade real da sessão.
 */
export const chipHealth = mysqlTable("chip_health", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().unique().references(() => whatsappChips.id),
  healthScore: int("healthScore").default(0).notNull(),
  reconnectCount: int("reconnectCount").default(0).notNull(),
  disconnectCount: int("disconnectCount").default(0).notNull(),
  lastDisconnect: timestamp("lastDisconnect"),
  sessionAge: int("sessionAge").default(0).notNull(),
  lastReceive: timestamp("lastReceive"),
  lastSend: timestamp("lastSend"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChipHealth = typeof chipHealth.$inferSelect;
export type InsertChipHealth = typeof chipHealth.$inferInsert;

/**
 * Chip Behavior Scores
 * Primeira camada de score baseada apenas na timeline real.
 */
export const chipBehaviorScores = mysqlTable("chip_behavior_scores", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().unique().references(() => whatsappChips.id),
  humanScore: int("humanScore").default(0).notNull(),
  riskScore: int("riskScore").default(100).notNull(),
  evidenceQuality: int("evidenceQuality").default(0).notNull(),
  evidenceCoverage: int("evidenceCoverage").default(0).notNull(),
  evidenceNaturalness: int("evidenceNaturalness").default(0).notNull(),
  evidenceDiversity: int("evidenceDiversity").default(0).notNull(),
  evidenceConsistency: int("evidenceConsistency").default(0).notNull(),
  evidenceSocialPresence: int("evidenceSocialPresence").default(0).notNull(),
  evidenceCoverageDetail: mediumtext("evidenceCoverageDetail"),
  sentCount: int("sentCount").default(0).notNull(),
  receivedCount: int("receivedCount").default(0).notNull(),
  groupJoinCount: int("groupJoinCount").default(0).notNull(),
  readCount: int("readCount").default(0).notNull(),
  distinctConversations: int("distinctConversations").default(0).notNull(),
  activeMinutes: int("activeMinutes").default(0).notNull(),
  idleMinutes: int("idleMinutes").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChipBehaviorScore = typeof chipBehaviorScores.$inferSelect;
export type InsertChipBehaviorScore = typeof chipBehaviorScores.$inferInsert;

/**
 * Chip Risk State
 * Snapshot dedicado do RiskEngine que alimenta certificação e observabilidade.
 */
export const chipRiskState = mysqlTable("chip_risk_state", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().unique().references(() => whatsappChips.id),
  spamRisk: int("spamRisk").default(0).notNull(),
  banRisk: int("banRisk").default(0).notNull(),
  humanScore: int("humanScore").default(0).notNull(),
  socialScore: int("socialScore").default(0).notNull(),
  routineScore: int("routineScore").default(0).notNull(),
  conversationScore: int("conversationScore").default(0).notNull(),
  presenceScore: int("presenceScore").default(0).notNull(),
  payload: mediumtext("payload"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChipRiskState = typeof chipRiskState.$inferSelect;
export type InsertChipRiskState = typeof chipRiskState.$inferInsert;

/**
 * Chip Routine State
 * Agenda operacional do chip por janela e frequência.
 */
export const chipRoutineState = mysqlTable("chip_routine_state", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().unique().references(() => whatsappChips.id),
  weekday: int("weekday").default(0).notNull(),
  currentMode: varchar("currentMode", { length: 60 }).default("idle").notNull(),
  nextActionAt: timestamp("nextActionAt"),
  lastWindowStartedAt: timestamp("lastWindowStartedAt"),
  lastWindowEndedAt: timestamp("lastWindowEndedAt"),
  actionsToday: int("actionsToday").default(0).notNull(),
  pausesToday: int("pausesToday").default(0).notNull(),
  payload: mediumtext("payload"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChipRoutineState = typeof chipRoutineState.$inferSelect;
export type InsertChipRoutineState = typeof chipRoutineState.$inferInsert;

/**
 * Chip Identity Evolution
 * Histórico resumido da evolução do perfil do chip.
 */
export const chipIdentityEvolution = mysqlTable("chip_identity_evolution", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().unique().references(() => whatsappChips.id),
  generation: int("generation").default(1).notNull(),
  lastNameChangeAt: timestamp("lastNameChangeAt"),
  lastAboutChangeAt: timestamp("lastAboutChangeAt"),
  lastPhotoChangeAt: timestamp("lastPhotoChangeAt"),
  currentDisplayName: varchar("currentDisplayName", { length: 120 }),
  currentAbout: text("currentAbout"),
  currentPhotoAsset: varchar("currentPhotoAsset", { length: 255 }),
  payload: mediumtext("payload"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChipIdentityEvolution = typeof chipIdentityEvolution.$inferSelect;
export type InsertChipIdentityEvolution = typeof chipIdentityEvolution.$inferInsert;

/**
 * Chip Learning Metrics
 * Métricas adaptativas por ação para o planner.
 */
export const chipLearningMetrics = mysqlTable("chip_learning_metrics", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().references(() => whatsappChips.id),
  actionKey: varchar("actionKey", { length: 100 }).notNull(),
  successCount: int("successCount").default(0).notNull(),
  failureCount: int("failureCount").default(0).notNull(),
  successRate: int("successRate").default(0).notNull(),
  failureRate: int("failureRate").default(0).notNull(),
  averageResponse: int("averageResponse").default(0).notNull(),
  averageDelay: int("averageDelay").default(0).notNull(),
  payload: mediumtext("payload"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChipLearningMetric = typeof chipLearningMetrics.$inferSelect;
export type InsertChipLearningMetric = typeof chipLearningMetrics.$inferInsert;

/**
 * Ecosystem Events
 * Auditoria do coordenador interno entre chips.
 */
export const ecosystemEvents = mysqlTable("ecosystem_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  sourceChipId: int("sourceChipId").references(() => whatsappChips.id),
  targetChipId: int("targetChipId").references(() => whatsappChips.id),
  eventType: varchar("eventType", { length: 80 }).notNull(),
  referenceKey: varchar("referenceKey", { length: 191 }).notNull(),
  payload: mediumtext("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EcosystemEvent = typeof ecosystemEvents.$inferSelect;
export type InsertEcosystemEvent = typeof ecosystemEvents.$inferInsert;

/**
 * Worker Heartbeats
 * Batimento persistente dos workers distribuídos para operação e troubleshooting.
 */
export const workerHeartbeats = mysqlTable(
  "worker_heartbeats",
  {
    id: int("id").autoincrement().primaryKey(),
    workerId: varchar("workerId", { length: 191 }).notNull(),
    runtime: varchar("runtime", { length: 100 }).notNull(),
    hostname: varchar("hostname", { length: 191 }).notNull(),
    pid: int("pid").notNull(),
    queueName: varchar("queueName", { length: 120 }).notNull(),
    status: mysqlEnum("status", ["starting", "running", "degraded", "stopped"]).default("starting").notNull(),
    lastHeartbeatAt: timestamp("lastHeartbeatAt").defaultNow().notNull(),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    payload: mediumtext("payload"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    uniqWorkerHeartbeat: uniqueIndex("uniq_worker_heartbeat").on(table.workerId),
    idxWorkerHeartbeatStatus: index("idx_worker_heartbeat_status").on(table.status),
    idxWorkerHeartbeatRuntime: index("idx_worker_heartbeat_runtime").on(table.runtime),
  }),
);

export type WorkerHeartbeat = typeof workerHeartbeats.$inferSelect;
export type InsertWorkerHeartbeat = typeof workerHeartbeats.$inferInsert;

/**
 * System Configs
 * Configurações dinâmicas da plataforma carregadas sem recompilar.
 */
export const systemConfigs = mysqlTable(
  "system_configs",
  {
    id: int("id").autoincrement().primaryKey(),
    configKey: varchar("configKey", { length: 191 }).notNull(),
    valueType: mysqlEnum("valueType", ["string", "number", "boolean", "json"]).default("string").notNull(),
    valueText: text("valueText"),
    valueNumber: int("valueNumber"),
    valueBoolean: int("valueBoolean"),
    description: text("description"),
    payload: mediumtext("payload"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    uniqSystemConfig: uniqueIndex("uniq_system_config").on(table.configKey),
  }),
);

export type SystemConfig = typeof systemConfigs.$inferSelect;
export type InsertSystemConfig = typeof systemConfigs.$inferInsert;

/**
 * Audit Events
 * Trilha transversal para explicar decisões, execuções e mudanças operacionais.
 */
export const auditEvents = mysqlTable("audit_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  chipId: int("chipId").references(() => whatsappChips.id),
  engine: varchar("engine", { length: 120 }).notNull(),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entityType", { length: 80 }),
  entityId: varchar("entityId", { length: 191 }),
  beforeState: mediumtext("beforeState"),
  afterState: mediumtext("afterState"),
  result: mysqlEnum("result", ["success", "failed", "skipped"]).default("success").notNull(),
  errorMessage: text("errorMessage"),
  durationMs: int("durationMs"),
  workerId: varchar("workerId", { length: 191 }),
  payload: mediumtext("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditEvent = typeof auditEvents.$inferSelect;
export type InsertAuditEvent = typeof auditEvents.$inferInsert;

/**
 * Cluster Nodes
 * Registro dos nós ativos da plataforma distribuída.
 */
export const clusterNodes = mysqlTable(
  "cluster_nodes",
  {
    id: int("id").autoincrement().primaryKey(),
    nodeId: varchar("nodeId", { length: 191 }).notNull(),
    hostname: varchar("hostname", { length: 191 }).notNull(),
    pid: int("pid").notNull(),
    role: varchar("role", { length: 80 }).default("worker").notNull(),
    status: mysqlEnum("status", ["starting", "running", "draining", "offline"]).default("starting").notNull(),
    version: varchar("version", { length: 40 }),
    isLeader: int("isLeader").default(0).notNull(),
    lastHeartbeatAt: timestamp("lastHeartbeatAt").defaultNow().notNull(),
    payload: mediumtext("payload"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    uniqClusterNode: uniqueIndex("uniq_cluster_node").on(table.nodeId),
    idxClusterNodeStatus: index("idx_cluster_node_status").on(table.status),
  }),
);

export type ClusterNode = typeof clusterNodes.$inferSelect;
export type InsertClusterNode = typeof clusterNodes.$inferInsert;

/**
 * Leader Leases
 * Lease distribuído para componentes globais como scheduler e recovery.
 */
export const leaderLeases = mysqlTable(
  "leader_leases",
  {
    id: int("id").autoincrement().primaryKey(),
    leaseKey: varchar("leaseKey", { length: 120 }).notNull(),
    leaderNodeId: varchar("leaderNodeId", { length: 191 }).notNull(),
    leaseToken: varchar("leaseToken", { length: 191 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    payload: mediumtext("payload"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    uniqLeaderLease: uniqueIndex("uniq_leader_lease").on(table.leaseKey),
    idxLeaderLeaseExpires: index("idx_leader_lease_expires").on(table.expiresAt),
  }),
);

export type LeaderLease = typeof leaderLeases.$inferSelect;
export type InsertLeaderLease = typeof leaderLeases.$inferInsert;

/**
 * Distributed Chip Sessions
 * Registro compartilhado do dono atual e saúde da sessão do chip entre nós.
 */
export const distributedChipSessions = mysqlTable(
  "distributed_chip_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    chipId: int("chipId").notNull().references(() => whatsappChips.id),
    ownerNodeId: varchar("ownerNodeId", { length: 191 }).notNull(),
    phoneNumber: varchar("phoneNumber", { length: 30 }),
    sessionStatus: mysqlEnum("sessionStatus", ["connected", "disconnected", "recovering", "failed", "orphaned"]).default("disconnected").notNull(),
    connectionState: varchar("connectionState", { length: 80 }),
    healthScore: int("healthScore").default(0).notNull(),
    lastHeartbeatAt: timestamp("lastHeartbeatAt").defaultNow().notNull(),
    payload: mediumtext("payload"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    uniqDistributedChipSession: uniqueIndex("uniq_distributed_chip_session").on(table.chipId),
    idxDistributedOwner: index("idx_distributed_owner").on(table.ownerNodeId),
    idxDistributedStatus: index("idx_distributed_status").on(table.sessionStatus),
  }),
);

export type DistributedChipSession = typeof distributedChipSessions.$inferSelect;
export type InsertDistributedChipSession = typeof distributedChipSessions.$inferInsert;

/**
 * Cluster Backup Snapshots
 * Snapshots operacionais de cluster, sessões e chips para restore.
 */
export const clusterBackupSnapshots = mysqlTable(
  "cluster_backup_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    snapshotKey: varchar("snapshotKey", { length: 191 }).notNull(),
    scope: varchar("scope", { length: 80 }).default("cluster").notNull(),
    status: mysqlEnum("status", ["ready", "restored", "failed"]).default("ready").notNull(),
    payload: mediumtext("payload").notNull(),
    restoredAt: timestamp("restoredAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    uniqClusterBackupSnapshot: uniqueIndex("uniq_cluster_backup_snapshot").on(table.snapshotKey),
    idxClusterBackupScope: index("idx_cluster_backup_scope").on(table.scope),
  }),
);

export type ClusterBackupSnapshot = typeof clusterBackupSnapshots.$inferSelect;
export type InsertClusterBackupSnapshot = typeof clusterBackupSnapshots.$inferInsert;

/**
 * Chip Certification State
 * Veredito detalhado do CertificationEngine.
 */
export const chipCertificationState = mysqlTable("chip_certification_state", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().unique().references(() => whatsappChips.id),
  maturityLevel: int("maturityLevel").default(0).notNull(),
  maturityLabel: varchar("maturityLabel", { length: 60 }).default("Nível 0 - Novo").notNull(),
  decision: mysqlEnum("decision", ["APPROVED", "BLOCKED"]).default("BLOCKED").notNull(),
  humanScore: int("humanScore").default(0).notNull(),
  socialScore: int("socialScore").default(0).notNull(),
  routineScore: int("routineScore").default(0).notNull(),
  trustScore: int("trustScore").default(0).notNull(),
  spamRisk: int("spamRisk").default(0).notNull(),
  banRisk: int("banRisk").default(0).notNull(),
  payload: mediumtext("payload"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChipCertificationState = typeof chipCertificationState.$inferSelect;
export type InsertChipCertificationState = typeof chipCertificationState.$inferInsert;

/**
 * Observation Runtime Records
 * Persistência do pipeline inbound/scheduler.
 */
export const observationRuntimeRecords = mysqlTable("observation_runtime_records", {
  id: varchar("id", { length: 191 }).primaryKey(),
  source: varchar("source", { length: 120 }).notNull(),
  eventType: varchar("eventType", { length: 191 }).notNull(),
  payload: mediumtext("payload").notNull(),
  timestamp: varchar("timestamp", { length: 64 }).notNull(),
  correlationId: varchar("correlationId", { length: 191 }),
  processingStatus: mysqlEnum("processingStatus", ["PENDING", "PROCESSING", "PROCESSED", "FAILED"]).default("PENDING").notNull(),
  claimedBy: varchar("claimedBy", { length: 191 }),
  claimedAt: timestamp("claimedAt"),
  leaseExpiresAt: timestamp("leaseExpiresAt"),
  processedAt: timestamp("processedAt"),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  statusIdx: index("observation_runtime_records_status_idx").on(table.processingStatus),
  claimedByIdx: index("observation_runtime_records_claimed_by_idx").on(table.claimedBy),
  correlationIdx: index("observation_runtime_records_correlation_idx").on(table.correlationId),
  leaseIdx: index("observation_runtime_records_lease_idx").on(table.leaseExpiresAt),
}));

export type ObservationRuntimeRecord = typeof observationRuntimeRecords.$inferSelect;
export type InsertObservationRuntimeRecord = typeof observationRuntimeRecords.$inferInsert;

/**
 * Observation Runtime Events
 * Event Store mínimo do pipeline inbound.
 */
export const observationRuntimeEvents = mysqlTable("observation_runtime_events", {
  id: int("id").autoincrement().primaryKey(),
  stream: varchar("stream", { length: 191 }).notNull(),
  version: int("version").notNull(),
  type: varchar("type", { length: 120 }).notNull(),
  occurredAt: varchar("occurredAt", { length: 64 }).notNull(),
  payload: mediumtext("payload").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  streamIdx: index("observation_runtime_events_stream_idx").on(table.stream),
  streamVersionUnique: uniqueIndex("observation_runtime_events_stream_version_uidx").on(table.stream, table.version),
}));

export type ObservationRuntimeEvent = typeof observationRuntimeEvents.$inferSelect;
export type InsertObservationRuntimeEvent = typeof observationRuntimeEvents.$inferInsert;

/**
 * Chip Certification
 * Estado de aprovação do chip dentro do Maturator.
 */
export const chipCertifications = mysqlTable("chip_certifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().unique().references(() => whatsappChips.id),
  status: mysqlEnum("status", ["NOVO", "EM_MATURACAO", "EM_OBSERVACAO", "APROVADO", "RESTRITO", "REPROVADO"])
    .default("NOVO")
    .notNull(),
  usable: int("usable").default(0).notNull(),
  reason: text("reason"),
  approvedAt: timestamp("approvedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChipCertification = typeof chipCertifications.$inferSelect;
export type InsertChipCertification = typeof chipCertifications.$inferInsert;

/**
 * Behavior Decision Log
 * Registro append-only da decisão da política comportamental.
 */
export const behaviorDecisionLog = mysqlTable(
  "behavior_decision_log",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    chipId: int("chipId").notNull().references(() => whatsappChips.id),
    phase: varchar("phase", { length: 32 }).notNull(),
    trustScore: int("trustScore"),
    riskScore: int("riskScore"),
    dailyBudgetUsed: int("dailyBudgetUsed").default(0).notNull(),
    dailyBudgetTotal: int("dailyBudgetTotal").default(0).notNull(),
    sessionId: varchar("sessionId", { length: 191 }),
    requestedAction: varchar("requestedAction", { length: 64 }).notNull(),
    decision: varchar("decision", { length: 32 }).notNull(),
    reason: text("reason").notNull(),
    delayMs: int("delayMs"),
    nextCheckAt: timestamp("nextCheckAt"),
    engineVersion: varchar("engineVersion", { length: 64 }).notNull(),
    policyFingerprint: varchar("policyFingerprint", { length: 128 }),
    checksJson: mediumtext("checksJson"),
    contributorsJson: mediumtext("contributorsJson"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    chipCreatedAtIndex: index("ix_behavior_decision_log_chipId_createdAt").on(table.chipId, table.createdAt),
    createdAtIndex: index("ix_behavior_decision_log_createdAt").on(table.createdAt),
  })
);

export type BehaviorDecisionLog = typeof behaviorDecisionLog.$inferSelect;
export type InsertBehaviorDecisionLog = typeof behaviorDecisionLog.$inferInsert;

/**
 * Behavior Snapshot
 * Estado atual observado do chip para exibição e comparação rápida.
 */
export const behaviorSnapshots = mysqlTable("behavior_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().unique().references(() => whatsappChips.id),
  phase: varchar("phase", { length: 32 }).notNull(),
  trustScore: int("trustScore"),
  riskScore: int("riskScore"),
  dailyBudgetUsed: int("dailyBudgetUsed").default(0).notNull(),
  dailyBudgetTotal: int("dailyBudgetTotal").default(0).notNull(),
  inboundCount: int("inboundCount").default(0).notNull(),
  outboundCount: int("outboundCount").default(0).notNull(),
  sessionId: varchar("sessionId", { length: 191 }),
  lastDecision: varchar("lastDecision", { length: 32 }),
  lastReason: text("lastReason"),
  nextCheckAt: timestamp("nextCheckAt"),
  engineVersion: varchar("engineVersion", { length: 64 }).notNull(),
  policyFingerprint: varchar("policyFingerprint", { length: 128 }),
  snapshotJson: mediumtext("snapshotJson"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BehaviorSnapshot = typeof behaviorSnapshots.$inferSelect;
export type InsertBehaviorSnapshot = typeof behaviorSnapshots.$inferInsert;

/**
 * Message Templates
 * Biblioteca de mensagens reutilizáveis para disparo e maturação.
 */
export const messageTemplates = mysqlTable("message_templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  templateName: varchar("templateName", { length: 150 }).notNull(),
  category: mysqlEnum("category", ["dispatch", "maturation", "general"]).default("general").notNull(),
  content: text("content").notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = typeof messageTemplates.$inferInsert;

/**
 * Maturation Targets
 * Alvos reais para maturação e campanhas.
 */
export const maturationTargets = mysqlTable("maturation_targets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  targetName: varchar("targetName", { length: 150 }).notNull(),
  targetType: mysqlEnum("targetType", ["number", "group", "chip"]).notNull(),
  targetValue: varchar("targetValue", { length: 255 }).notNull(),
  notes: text("notes"),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MaturationTarget = typeof maturationTargets.$inferSelect;
export type InsertMaturationTarget = typeof maturationTargets.$inferInsert;

/**
 * Execution Jobs
 * Rastreia execuções operacionais de disparo e maturação.
 */
export const executionJobs = mysqlTable("execution_jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().references(() => whatsappChips.id),
  executionType: mysqlEnum("executionType", ["dispatch", "maturation"]).notNull(),
  targetType: mysqlEnum("targetType", ["number", "group", "list", "chip"]).notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "partial"]).default("pending").notNull(),
  templateId: int("templateId"),
  profileName: mysqlEnum("profileName", ["suave", "normal", "ultra"]).default("normal").notNull(),
  totalTargets: int("totalTargets").default(0).notNull(),
  plannedMessages: int("plannedMessages").default(0).notNull(),
  totalMessagesSent: int("totalMessagesSent").default(0).notNull(),
  successCount: int("successCount").default(0).notNull(),
  failureCount: int("failureCount").default(0).notNull(),
  payload: text("payload"),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExecutionJob = typeof executionJobs.$inferSelect;
export type InsertExecutionJob = typeof executionJobs.$inferInsert;

/**
 * Execution Attempts
 * Guarda cada tentativa individual de envio/reação ligada a um job.
 */
export const executionAttempts = mysqlTable("execution_attempts", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").notNull().references(() => executionJobs.id),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().references(() => whatsappChips.id),
  targetType: mysqlEnum("targetType", ["number", "group", "list", "chip"]).notNull(),
  targetValue: varchar("targetValue", { length: 255 }).notNull(),
  actionType: mysqlEnum("actionType", ["message", "reaction"]).notNull(),
  attemptOrder: int("attemptOrder").default(1).notNull(),
  messageContent: text("messageContent"),
  providerMessageId: varchar("providerMessageId", { length: 128 }),
  status: mysqlEnum("status", ["pending", "success", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  executedAt: timestamp("executedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExecutionAttempt = typeof executionAttempts.$inferSelect;
export type InsertExecutionAttempt = typeof executionAttempts.$inferInsert;

/**
 * Behavior Action Execution
 * Ledger oficial da execução comportamental, separado da decisão.
 */
export const behaviorActionExecution = mysqlTable("behavior_action_execution", {
  id: varchar("id", { length: 64 }).primaryKey(),
  decisionId: varchar("decisionId", { length: 64 }).notNull(),
  userId: int("userId").notNull().references(() => users.id),
  chipId: int("chipId").notNull().references(() => whatsappChips.id),
  requestedAction: varchar("requestedAction", { length: 64 }).notNull(),
  targetType: mysqlEnum("targetType", ["number", "group", "list", "chip"]).notNull(),
  targetValue: varchar("targetValue", { length: 255 }).notNull(),
  messageId: varchar("messageId", { length: 128 }),
  status: mysqlEnum("status", ["PENDING", "SENDING", "ACKED", "FAILED", "RETRYING"]).default("PENDING").notNull(),
  budgetState: mysqlEnum("budgetState", ["NOT_RESERVED", "RESERVED", "COMMITTED", "RELEASED"]).default("NOT_RESERVED").notNull(),
  attempt: int("attempt").default(1).notNull(),
  recoverable: int("recoverable").default(1).notNull(),
  maxAttempts: int("maxAttempts").default(3).notNull(),
  nextRetryAt: timestamp("nextRetryAt"),
  lastRetryAt: timestamp("lastRetryAt"),
  payload: text("payload"),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  sentAt: timestamp("sentAt"),
  ackAt: timestamp("ackAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BehaviorActionExecution = typeof behaviorActionExecution.$inferSelect;
export type InsertBehaviorActionExecution = typeof behaviorActionExecution.$inferInsert;

export const behaviorBudgetReservations = mysqlTable(
  "behavior_budget_reservations",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    executionId: varchar("executionId", { length: 64 }).notNull(),
    attempt: int("attempt").notNull(),
    userId: int("userId").notNull().references(() => users.id),
    amount: int("amount").notNull(),
    status: mysqlEnum("status", ["RESERVED", "COMMITTED", "RELEASED"]).default("RESERVED").notNull(),
    reason: text("reason"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    committedAt: timestamp("committedAt"),
    releasedAt: timestamp("releasedAt"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    uxExecutionAttempt: uniqueIndex("ux_behavior_budget_execution_attempt").on(table.executionId, table.attempt),
    ixUserStatusCreated: index("ix_behavior_budget_user_status_created").on(table.userId, table.status, table.createdAt),
  }),
);

export type BehaviorBudgetReservation = typeof behaviorBudgetReservations.$inferSelect;
export type InsertBehaviorBudgetReservation = typeof behaviorBudgetReservations.$inferInsert;

/**
 * Admin Audit Logs
 * Trilhas administrativas (mudança de papel, status, assinatura e planos).
 * Mantém histórico mínimo para governança.
 */
export const adminAuditLogs = mysqlTable("admin_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  adminUserId: int("adminUserId").notNull().references(() => users.id),
  targetUserId: int("targetUserId").references(() => users.id),
  entity: varchar("entity", { length: 60 }).notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  payload: text("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLogs.$inferInsert;
