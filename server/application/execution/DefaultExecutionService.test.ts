import { describe, expect, it, vi } from "vitest";
import { DefaultExecutionService } from "./DefaultExecutionService";

describe("DefaultExecutionService", () => {
  it("devolve o ExecutionPlan recebido", async () => {
    const service = new DefaultExecutionService();

    const plan = await service.execute({
      id: "plan-1",
      factId: "fact-1",
      actions: [
        {
          type: "alert",
          payload: { severity: "critical" },
        },
      ],
      metadata: { factType: "test.event" },
      createdAt: "2026-07-20T10:00:00.000Z",
    });

    expect(plan).toEqual({
      id: "plan-1",
      factId: "fact-1",
      actions: [
        {
          type: "alert",
          payload: { severity: "critical" },
        },
      ],
      metadata: { factType: "test.event" },
      createdAt: "2026-07-20T10:00:00.000Z",
    });
  });

  it("chama onPlanCreated após criar o plano", async () => {
    const onPlanCreated = vi.fn();
    const service = new DefaultExecutionService({
      onPlanCreated,
    });

    await service.execute({
      id: "plan-1",
      factId: "fact-1",
      actions: [],
      metadata: {},
      createdAt: "2026-07-20T10:00:00.000Z",
    });

    expect(onPlanCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "plan-1",
      }),
    );
  });
});
