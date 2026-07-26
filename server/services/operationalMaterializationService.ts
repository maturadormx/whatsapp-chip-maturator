import {
  materializeAndGetCertifiedPool,
  materializeAndGetChipOperationalSummary,
  materializeChip,
  materializeFleet,
} from "./operationalMaterializer";

type MaterializationOptions = {
  windowHours?: number;
};

export async function ensureFreshChip(chipId: number, userId: number, options?: MaterializationOptions) {
  return materializeChip(chipId, userId, options);
}

export async function ensureFreshFleet(userId: number, options?: MaterializationOptions) {
  return materializeFleet(userId, options);
}

export async function ensureFreshCertifiedPool(userId: number) {
  return materializeAndGetCertifiedPool(userId);
}

export async function ensureFreshChipOperationalSummary(
  userId: number,
  chipId: number,
  options?: MaterializationOptions
) {
  return materializeAndGetChipOperationalSummary(userId, chipId, options);
}
