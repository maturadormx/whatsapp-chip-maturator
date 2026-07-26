import fs from "node:fs";
import path from "node:path";

export type MarketingCampaignTargetType = "number" | "group" | "list";
export type MarketingCampaignProfile = "suave" | "normal" | "ultra";
export type MarketingCampaignRotationStrategy = "round_robin" | "random" | "least_usage";

export interface MarketingCampaignTargetEntry {
  value: string;
  name?: string;
  tag?: string;
}

export interface MarketingCampaignRecord {
  id: string;
  userId: number;
  name: string;
  targetType: MarketingCampaignTargetType;
  targetsText: string;
  targetEntries: MarketingCampaignTargetEntry[];
  selectedChipIds: number[];
  messageTemplate: string;
  templateId?: number | null;
  profile: MarketingCampaignProfile;
  intervalSeconds: number;
  maxMessagesPerTarget: number;
  rotationStrategy: MarketingCampaignRotationStrategy;
  rotationLookbackHours: number;
  selectedTagFilter?: string;
  scheduleEnabled?: boolean;
  scheduleTime?: string;
  queueStatus?: "pending" | "executing" | "paused" | "finalized";
  retryCount?: number;
  maxRetries?: number;
  retryDelayMinutes?: number;
  nextRetryAt?: string;
  lastQueueEventAt?: string;
  timeWindowStart?: string;
  timeWindowEnd?: string;
  lastExecutedAt?: string;
  lastExecutionStatus?: "success" | "skipped" | "failed" | "paused_risk";
  autoPausedAt?: string;
  autoPauseReason?: string;
  createdAt: string;
  updatedAt: string;
}

const marketingCampaignsFilePath = path.resolve(process.cwd(), "server", "marketing-campaigns.json");
let cachedCampaigns: MarketingCampaignRecord[] | null = null;

function readMarketingCampaignsFile() {
  if (cachedCampaigns) return cachedCampaigns;

  try {
    if (fs.existsSync(marketingCampaignsFilePath)) {
      const parsed = JSON.parse(fs.readFileSync(marketingCampaignsFilePath, "utf-8")) as MarketingCampaignRecord[];
      cachedCampaigns = Array.isArray(parsed) ? parsed : [];
      return cachedCampaigns;
    }
  } catch (error) {
    console.error("[MarketingCampaigns] Falha ao ler campanhas salvas.", error);
  }

  cachedCampaigns = [];
  return cachedCampaigns;
}

function writeMarketingCampaignsFile(records: MarketingCampaignRecord[]) {
  fs.writeFileSync(marketingCampaignsFilePath, JSON.stringify(records, null, 2), "utf-8");
  cachedCampaigns = records;
}

function sanitizeTargetEntries(entries: MarketingCampaignTargetEntry[]) {
  return entries
    .map((entry) => ({
      value: String(entry.value || "").trim(),
      name: entry.name?.trim() || undefined,
      tag: entry.tag?.trim() || undefined,
    }))
    .filter((entry) => entry.value.length > 0);
}

export function listMarketingCampaigns(userId: number) {
  return readMarketingCampaignsFile()
    .filter((campaign) => campaign.userId === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function saveMarketingCampaign(
  userId: number,
  input: Omit<MarketingCampaignRecord, "id" | "userId" | "createdAt" | "updatedAt"> & { id?: string }
) {
  const campaigns = readMarketingCampaignsFile();
  const now = new Date().toISOString();
  const existingIndex = input.id ? campaigns.findIndex((campaign) => campaign.id === input.id && campaign.userId === userId) : -1;

  const nextRecord: MarketingCampaignRecord = {
    id: existingIndex >= 0 ? campaigns[existingIndex].id : `campaign_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    name: input.name.trim(),
    targetType: input.targetType,
    targetsText: input.targetsText,
    targetEntries: sanitizeTargetEntries(input.targetEntries),
    selectedChipIds: input.selectedChipIds,
    messageTemplate: input.messageTemplate,
    templateId: input.templateId ?? null,
    profile: input.profile,
    intervalSeconds: input.intervalSeconds,
    maxMessagesPerTarget: input.maxMessagesPerTarget,
    rotationStrategy: input.rotationStrategy,
    rotationLookbackHours: input.rotationLookbackHours,
    selectedTagFilter: input.selectedTagFilter?.trim() || undefined,
    scheduleEnabled: Boolean(input.scheduleEnabled),
    scheduleTime: input.scheduleTime?.trim() || undefined,
    queueStatus: existingIndex >= 0 ? campaigns[existingIndex].queueStatus : input.scheduleEnabled ? "pending" : "finalized",
    retryCount: existingIndex >= 0 ? campaigns[existingIndex].retryCount ?? 0 : 0,
    maxRetries: input.maxRetries ?? (existingIndex >= 0 ? campaigns[existingIndex].maxRetries ?? 2 : 2),
    retryDelayMinutes: input.retryDelayMinutes ?? (existingIndex >= 0 ? campaigns[existingIndex].retryDelayMinutes ?? 30 : 30),
    nextRetryAt: existingIndex >= 0 ? campaigns[existingIndex].nextRetryAt : undefined,
    lastQueueEventAt: existingIndex >= 0 ? campaigns[existingIndex].lastQueueEventAt : undefined,
    timeWindowStart: input.timeWindowStart?.trim() || (existingIndex >= 0 ? campaigns[existingIndex].timeWindowStart : undefined),
    timeWindowEnd: input.timeWindowEnd?.trim() || (existingIndex >= 0 ? campaigns[existingIndex].timeWindowEnd : undefined),
    lastExecutedAt: existingIndex >= 0 ? campaigns[existingIndex].lastExecutedAt : undefined,
    lastExecutionStatus: existingIndex >= 0 ? campaigns[existingIndex].lastExecutionStatus : undefined,
    autoPausedAt: existingIndex >= 0 ? campaigns[existingIndex].autoPausedAt : undefined,
    autoPauseReason: existingIndex >= 0 ? campaigns[existingIndex].autoPauseReason : undefined,
    createdAt: existingIndex >= 0 ? campaigns[existingIndex].createdAt : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    campaigns[existingIndex] = nextRecord;
  } else {
    campaigns.push(nextRecord);
  }

  writeMarketingCampaignsFile(campaigns);
  return nextRecord;
}

export function deleteMarketingCampaign(userId: number, campaignId: string) {
  const campaigns = readMarketingCampaignsFile();
  const nextRecords = campaigns.filter((campaign) => !(campaign.userId === userId && campaign.id === campaignId));
  writeMarketingCampaignsFile(nextRecords);
  return { success: true } as const;
}

export function listAllMarketingCampaigns() {
  return [...readMarketingCampaignsFile()];
}

export function updateMarketingCampaignRuntime(
  campaignId: string,
  patch: Partial<
    Pick<
      MarketingCampaignRecord,
      | "lastExecutedAt"
      | "lastExecutionStatus"
      | "scheduleEnabled"
      | "autoPausedAt"
      | "autoPauseReason"
      | "updatedAt"
      | "queueStatus"
      | "retryCount"
      | "nextRetryAt"
      | "lastQueueEventAt"
    >
  >
) {
  const campaigns = readMarketingCampaignsFile();
  const index = campaigns.findIndex((campaign) => campaign.id === campaignId);
  if (index < 0) return null;

  campaigns[index] = {
    ...campaigns[index],
    ...patch,
    updatedAt: patch.updatedAt || new Date().toISOString(),
  };
  writeMarketingCampaignsFile(campaigns);
  return campaigns[index];
}
