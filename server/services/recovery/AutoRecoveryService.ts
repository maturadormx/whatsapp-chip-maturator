import { recordAuditEvent } from "../audit/AuditEngine";
import { getInternalEventBus } from "../events/InternalEventBus";
import { getDistributedLockService } from "../locking/DistributedLockService";
import { withRetry } from "../hardening/RetryPolicy";
import { restoreChipSessionsOnStartup, getChipHealth } from "../whatsappService";
import { getAllChips } from "../../db";
import { startPassiveBehaviorEngine } from "../passiveBehaviorEngine";

export async function runAutoRecoveryCycle() {
  return getDistributedLockService().withLock<{
    success: boolean;
    skipped: boolean;
    error?: string;
  }>({
    key: "locks:auto_recovery_cycle",
    ttlMs: 120_000,
    onSkipped: async () => ({ success: true, skipped: true }),
    task: async () => {
      try {
        await withRetry({
          attempts: 2,
          backoffMs: 1_000,
          operation: async () => {
            await restoreChipSessionsOnStartup();
            await startPassiveBehaviorEngine();
          },
        });

        await recordAuditEvent({
          engine: "AutoRecoveryService",
          action: "startup_recovery_completed",
          payload: {
            pid: process.pid,
          },
        }).catch(() => null);

        await getInternalEventBus().publish({
          type: "auto_recovery.completed",
          source: "AutoRecoveryService",
          payload: {
            pid: process.pid,
          },
        });

        return { success: true, skipped: false };
      } catch (error) {
        await recordAuditEvent({
          engine: "AutoRecoveryService",
          action: "startup_recovery_failed",
          result: "failed",
          errorMessage: error instanceof Error ? error.message : String(error),
        }).catch(() => null);

        await getInternalEventBus().publish({
          type: "auto_recovery.failed",
          source: "AutoRecoveryService",
          payload: {
            error: error instanceof Error ? error.message : String(error),
            pid: process.pid,
          },
        });

        return { success: false, skipped: false, error: String(error) };
      }
    },
  });
}

export async function inspectRecoveryCandidates() {
  const chips = await getAllChips();
  const results = await Promise.all(
    chips.map(async (chip) => ({
      chipId: chip.id,
      chipName: chip.chipName,
      health: await getChipHealth(chip.id, chip.userId, chip.phoneNumber),
    })),
  );

  return results.filter((item) => !item.health.connected || item.health.healthScore < 50);
}
