import type { Observation } from "../../domain/observation";
import type { ObservationRepositoryPort } from "../../ports/ObservationRepositoryPort";
import { telemetry } from "../../telemetry";

type MemoryObservationState = {
  observation: Observation;
  status: "PENDING" | "PROCESSING" | "PROCESSED" | "FAILED";
  claimedBy?: string;
  lastError?: string;
  leaseExpiresAt?: Date;
};

export class MemoryObservationRepository implements ObservationRepositoryPort {
  private readonly store = new Map<string, MemoryObservationState>();

  async save(observation: Observation): Promise<void> {
    await telemetry.withSpan(
      "repository.save",
      async () => {
        const current = this.store.get(observation.id);
        this.store.set(observation.id, {
          observation,
          status: current?.status ?? "PENDING",
          claimedBy: current?.claimedBy,
          lastError: current?.lastError,
          leaseExpiresAt: current?.leaseExpiresAt,
        });
      },
      {
        attributes: {
          "observation.id": observation.id,
        },
      },
    );
  }

  async findById(id: string): Promise<Observation | null> {
    return telemetry.withSpan(
      "repository.findById",
      async () => this.store.get(id)?.observation ?? null,
      {
        attributes: {
          "observation.id": id,
        },
      },
    );
  }

  async claimPending(limit: number, workerId: string): Promise<Observation[]> {
    return telemetry.withSpan(
      "repository.claimPending",
      async (span) => {
        const claimed: Observation[] = [];

        for (const [id, entry] of Array.from(this.store.entries())) {
          if (claimed.length >= limit) break;
          const leaseExpired = entry.status === "PROCESSING" && entry.leaseExpiresAt && entry.leaseExpiresAt < new Date();
          if (entry.status !== "PENDING" && entry.status !== "FAILED" && !leaseExpired) continue;

          this.store.set(id, {
            ...entry,
            status: "PROCESSING",
            claimedBy: workerId,
            leaseExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
          });
          claimed.push(entry.observation);
        }

        telemetry.addEvent(span, "observations_claimed", { count: claimed.length });
        return claimed;
      },
      {
        attributes: {
          "queue.batch_size": limit,
        },
      },
    );
  }

  async completeProcessing(id: string, success: boolean, error?: string): Promise<void> {
    await telemetry.withSpan(
      "repository.completeProcessing",
      async () => {
        const current = this.store.get(id);
        if (!current) return;
        this.store.set(id, {
          observation: current.observation,
          status: success ? "PROCESSED" : "FAILED",
          claimedBy: undefined,
          lastError: error,
          leaseExpiresAt: undefined,
        });
      },
      {
        attributes: {
          "observation.id": id,
          "processing.success": success,
        },
      },
    );
  }

  clear(): void {
    this.store.clear();
  }
}
