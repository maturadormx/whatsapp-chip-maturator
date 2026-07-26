import { NormalizedBehaviorEvidence } from "./evidenceNormalizerService";

export const EVIDENCE_CATALOG_VERSION = 1;

export type EvidenceCatalogType =
  | "HUMAN_REPLY"
  | "HUMAN_INITIATED_CONVERSATION"
  | "GROUP_INTERACTION"
  | "STATUS_INTERACTION"
  | "PROFILE_ACTIVITY"
  | "SOCIAL_DISCOVERY"
  | "PASSIVE_ACTIVITY"
  | "ACTIVE_ACTIVITY"
  | "SYSTEM_ACTIVITY"
  | "UNKNOWN_ACTIVITY";

export type CatalogedEvidence = NormalizedBehaviorEvidence & {
  catalog: EvidenceCatalogType;
  activityClass: "passive" | "active" | "social" | "system" | "unknown";
  catalogVersion: number;
};

export function classifyEvidence(evidence: NormalizedBehaviorEvidence): CatalogedEvidence {
  if (evidence.direction === "system") {
    return { ...evidence, catalog: "SYSTEM_ACTIVITY", activityClass: "system", catalogVersion: EVIDENCE_CATALOG_VERSION };
  }

  if (evidence.type.includes("status")) {
    return { ...evidence, catalog: "STATUS_INTERACTION", activityClass: "passive", catalogVersion: EVIDENCE_CATALOG_VERSION };
  }

  if (evidence.type.includes("group") || evidence.remoteType === "group") {
    return { ...evidence, catalog: "GROUP_INTERACTION", activityClass: "social", catalogVersion: EVIDENCE_CATALOG_VERSION };
  }

  if (evidence.type.includes("profile") || evidence.type.includes("about")) {
    return { ...evidence, catalog: "PROFILE_ACTIVITY", activityClass: "passive", catalogVersion: EVIDENCE_CATALOG_VERSION };
  }

  if (evidence.type.includes("discover")) {
    return { ...evidence, catalog: "SOCIAL_DISCOVERY", activityClass: "social", catalogVersion: EVIDENCE_CATALOG_VERSION };
  }

  if (evidence.direction === "incoming") {
    return { ...evidence, catalog: "HUMAN_REPLY", activityClass: "active", catalogVersion: EVIDENCE_CATALOG_VERSION };
  }

  if (evidence.direction === "outgoing" && evidence.initiatedBy === "chip") {
    return {
      ...evidence,
      catalog: evidence.responseDelayMinutes == null ? "HUMAN_INITIATED_CONVERSATION" : "ACTIVE_ACTIVITY",
      activityClass: "active",
      catalogVersion: EVIDENCE_CATALOG_VERSION,
    };
  }

  if (evidence.type.includes("read") || evidence.type.includes("view")) {
    return { ...evidence, catalog: "PASSIVE_ACTIVITY", activityClass: "passive", catalogVersion: EVIDENCE_CATALOG_VERSION };
  }

  return { ...evidence, catalog: "UNKNOWN_ACTIVITY", activityClass: "unknown", catalogVersion: EVIDENCE_CATALOG_VERSION };
}

export function catalogEvidenceBatch(evidenceList: NormalizedBehaviorEvidence[]) {
  return evidenceList.map(classifyEvidence);
}
