import { describe, expect, it, vi } from "vitest";
import { ObservationPipeline } from "./ObservationPipeline";

describe("ObservationPipeline", () => {
  function createLogger() {
    return {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  }

  function createEventStore() {
    return {
      append: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue([]),
    };
  }

  it("persiste Observation, grava eventos, avalia regras e executa plano na ordem correta", async () => {
    const repository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      claimPending: vi.fn(),
      completeProcessing: vi.fn().mockResolvedValue(undefined),
    };
    const logger = createLogger();
    const eventStore = createEventStore();
    const ruleEngine = {
      evaluate: vi.fn().mockResolvedValue([
        {
          type: "alert",
          payload: { severity: "critical", factId: "fact-1" },
        },
      ]),
    };
    const executionService = {
      execute: vi.fn().mockResolvedValue({
        id: "plan-1",
        factId: "fact-1",
        actions: [
          {
            type: "alert",
            payload: { severity: "critical", factId: "fact-1" },
          },
        ],
        metadata: {},
        createdAt: "2026-07-20T10:00:00.000Z",
      }),
    };
    const createFact = vi.fn().mockReturnValue({
      id: "fact-1",
      observationId: "obs-1",
      type: "test.event",
      data: { foo: "bar" },
      timestamp: "2026-07-20T10:00:00.000Z",
    });

    const pipeline = new ObservationPipeline({
      repository: repository as any,
      createFact,
      logger: logger as any,
      eventStore: eventStore as any,
      ruleEngine: ruleEngine as any,
      executionService: executionService as any,
    });

    await pipeline.process({
      id: "obs-1",
      source: "webhook",
      eventType: "test.event",
      payload: { foo: "bar" },
      timestamp: "2026-07-20T10:00:00.000Z",
    });

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.completeProcessing).toHaveBeenCalledWith("obs-1", true);
    expect(createFact).toHaveBeenCalledTimes(1);
    expect(eventStore.append).toHaveBeenCalledTimes(2);
    expect(ruleEngine.evaluate).toHaveBeenCalledTimes(1);
    expect(executionService.execute).toHaveBeenCalledTimes(1);

    const saveOrder = (repository.save as any).mock.invocationCallOrder[0];
    const observationEventOrder = (eventStore.append as any).mock.invocationCallOrder[0];
    const createFactOrder = (createFact as any).mock.invocationCallOrder[0];
    const factEventOrder = (eventStore.append as any).mock.invocationCallOrder[1];
    const ruleOrder = (ruleEngine.evaluate as any).mock.invocationCallOrder[0];
    const executeOrder = (executionService.execute as any).mock.invocationCallOrder[0];
    expect(saveOrder).toBeLessThan(createFactOrder);
    expect(saveOrder).toBeLessThan(observationEventOrder);
    expect(createFactOrder).toBeLessThan(factEventOrder);
    expect(factEventOrder).toBeLessThan(ruleOrder);
    expect(createFactOrder).toBeLessThan(executeOrder);

    expect(eventStore.append).toHaveBeenNthCalledWith(
      1,
      "observation:obs-1",
      expect.objectContaining({
        type: "ObservationSaved",
      }),
      0,
    );
    expect(eventStore.append).toHaveBeenNthCalledWith(
      2,
      "fact:fact-1",
      expect.objectContaining({
        type: "FactGenerated",
      }),
      0,
    );
    expect(executionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        factId: "fact-1",
        actions: [
          {
            type: "alert",
            payload: { severity: "critical", factId: "fact-1" },
          },
        ],
      }),
    );
    expect(logger.debug).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalled();
  });

  it("gera ExecutionPlan sem ações quando nenhuma regra dispara", async () => {
    const repository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      claimPending: vi.fn(),
      completeProcessing: vi.fn().mockResolvedValue(undefined),
    };
    const logger = createLogger();
    const eventStore = createEventStore();
    const ruleEngine = {
      evaluate: vi.fn().mockResolvedValue([]),
    };
    const executionService = {
      execute: vi.fn().mockResolvedValue({
        id: "plan-1",
        factId: "fact-1",
        actions: [],
        metadata: {},
        createdAt: "2026-07-20T10:00:00.000Z",
      }),
    };
    const pipeline = new ObservationPipeline({
      repository: repository as any,
      logger: logger as any,
      eventStore: eventStore as any,
      ruleEngine: ruleEngine as any,
      executionService: executionService as any,
      createFact: () => ({
        id: "fact-1",
        observationId: "obs-1",
        type: "test.event",
        data: { foo: "bar" },
        timestamp: "2026-07-20T10:00:00.000Z",
      }),
    });

    await pipeline.process({
      id: "obs-1",
      source: "webhook",
      eventType: "test.event",
      payload: { foo: "bar" },
      timestamp: "2026-07-20T10:00:00.000Z",
    });

    expect(executionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        factId: "fact-1",
        actions: [],
      }),
    );
    expect(repository.completeProcessing).toHaveBeenCalledWith("obs-1", true);
  });

  it("falha se repository.save falhar e não gera Fact nem eventos", async () => {
    const error = new Error("db down");
    const repository = {
      save: vi.fn().mockRejectedValue(error),
      findById: vi.fn(),
      claimPending: vi.fn(),
      completeProcessing: vi.fn().mockResolvedValue(undefined),
    };
    const logger = createLogger();
    const eventStore = createEventStore();
    const ruleEngine = {
      evaluate: vi.fn(),
    };
    const createFact = vi.fn();
    const executionService = {
      execute: vi.fn(),
    };

    const pipeline = new ObservationPipeline({
      repository: repository as any,
      createFact,
      logger: logger as any,
      eventStore: eventStore as any,
      ruleEngine: ruleEngine as any,
      executionService: executionService as any,
    });

    await expect(
      pipeline.process({
        id: "obs-1",
        source: "webhook",
        eventType: "test.event",
        payload: {},
        timestamp: "2026-07-20T10:00:00.000Z",
      }),
    ).rejects.toThrow("db down");

    expect(createFact).not.toHaveBeenCalled();
    expect(eventStore.append).not.toHaveBeenCalled();
    expect(ruleEngine.evaluate).not.toHaveBeenCalled();
    expect(executionService.execute).not.toHaveBeenCalled();
    expect(repository.completeProcessing).toHaveBeenCalledWith("obs-1", false, "db down");
  });

  it("propaga falha do ExecutionService após gerar Fact e avaliar regras", async () => {
    const repository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      claimPending: vi.fn(),
      completeProcessing: vi.fn().mockResolvedValue(undefined),
    };
    const logger = createLogger();
    const eventStore = createEventStore();
    const ruleEngine = {
      evaluate: vi.fn().mockResolvedValue([
        {
          type: "alert",
          payload: { severity: "critical", factId: "fact-1" },
        },
      ]),
    };
    const createFact = vi.fn().mockReturnValue({
      id: "fact-1",
      observationId: "obs-1",
      type: "test.event",
      data: {},
      timestamp: "2026-07-20T10:00:00.000Z",
    });
    const executionService = {
      execute: vi.fn().mockRejectedValue(new Error("execution failed")),
    };

    const pipeline = new ObservationPipeline({
      repository: repository as any,
      createFact,
      logger: logger as any,
      eventStore: eventStore as any,
      ruleEngine: ruleEngine as any,
      executionService: executionService as any,
    });

    await expect(
      pipeline.process({
        id: "obs-1",
        source: "webhook",
        eventType: "test.event",
        payload: {},
        timestamp: "2026-07-20T10:00:00.000Z",
      }),
    ).rejects.toThrow("execution failed");

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(createFact).toHaveBeenCalledTimes(1);
    expect(ruleEngine.evaluate).toHaveBeenCalledTimes(1);
    expect(executionService.execute).toHaveBeenCalledTimes(1);
    expect(repository.completeProcessing).toHaveBeenCalledWith("obs-1", false, "execution failed");
  });
});
