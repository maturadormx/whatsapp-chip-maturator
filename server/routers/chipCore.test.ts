import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { InMemoryChipEventStore } from "../domain/chip";
import { buildChipCoreRouter } from "./chipCore";
import { createChipCoreApiService } from "../services/chipCoreApiService";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "test",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

describe("Chip Core Router", () => {
  it("executa o fluxo CreateChip -> PairChip -> GetCurrentState -> ReplayHistory", async () => {
    const service = createChipCoreApiService(new InMemoryChipEventStore());
    const router = buildChipCoreRouter(service);
    const caller = router.createCaller(createAuthContext().ctx);

    const created = await caller.createChip({
      chipId: "7f41c5a6-6f6d-4b63-9045-a2f0b4fd96cb",
      createdBy: "system",
      sprint: 0,
    });

    expect(created.event.event_type).toBe("chip_created");
    expect(created.event.sequence).toBe(1);

    const paired = await caller.pairChip({
      chipId: "7f41c5a6-6f6d-4b63-9045-a2f0b4fd96cb",
      pairedWith: "+5511999999999",
    });

    expect(paired.event.sequence).toBe(2);

    await caller.appendEvent({
      chip_id: "7f41c5a6-6f6d-4b63-9045-a2f0b4fd96cb",
      event_type: "chip_state_changed",
      event_version: 1,
      payload: {
        from_state: "PAREADO",
        to_state: "NOVO",
        trigger: "evolved",
      },
    });

    const currentState = await caller.getCurrentState({
      chipId: "7f41c5a6-6f6d-4b63-9045-a2f0b4fd96cb",
    });

    expect(currentState.current_state).toBe("NOVO");
    expect(currentState.inconsistencies).toEqual([]);

    const replay = await caller.replayHistory({
      chipId: "7f41c5a6-6f6d-4b63-9045-a2f0b4fd96cb",
    });

    expect(replay.history.events).toHaveLength(3);
    expect(replay.replay.current_state).toBe("NOVO");
  });

  it("expõe leitura parcial do histórico", async () => {
    const service = createChipCoreApiService(new InMemoryChipEventStore());
    const router = buildChipCoreRouter(service);
    const caller = router.createCaller(createAuthContext().ctx);

    const chipId = "4f8c9918-6c54-45a4-89e7-620b60ee0608";

    await caller.createChip({ chipId, createdBy: "system", sprint: 0 });
    await caller.pairChip({ chipId, pairedWith: "+5511999999999" });

    const history = await caller.getChipHistory({
      chipId,
      fromSequence: 2,
      limit: 1,
    });

    expect(history.mode).toBe("partial");
    expect(history.events).toHaveLength(1);
    expect(history.events[0]?.event_type).toBe("chip_paired");
  });

  it("rejeita transição inválida na API antes de persistir", async () => {
    const service = createChipCoreApiService(new InMemoryChipEventStore());
    const router = buildChipCoreRouter(service);
    const caller = router.createCaller(createAuthContext().ctx);

    await caller.createChip({
      chipId: "0e89d7d1-8d95-4e0d-a642-4d4dedb66799",
      createdBy: "system",
      sprint: 0,
    });

    await expect(
      caller.appendEvent({
        chip_id: "0e89d7d1-8d95-4e0d-a642-4d4dedb66799",
        event_type: "recovery_started",
        event_version: 1,
        payload: {
          incident_id: "inc-1",
          action: "refresh_token",
          attempt: 1,
        },
      })
    ).rejects.toMatchObject<Partial<TRPCError>>({
      code: "BAD_REQUEST",
    });
  });

  it("permite encerramento definitivo do chip", async () => {
    const service = createChipCoreApiService(new InMemoryChipEventStore());
    const router = buildChipCoreRouter(service);
    const caller = router.createCaller(createAuthContext().ctx);

    const chipId = "bcce26c2-b964-4337-a08c-34ddc5feb3f3";
    await caller.createChip({ chipId, createdBy: "system", sprint: 0 });

    const closed = await caller.closeChip({
      chipId,
      reason: "fim_da_vida",
      closedBy: "operator",
    });

    expect(closed.replay.current_state).toBe("ENCERRADO");
  });
});
