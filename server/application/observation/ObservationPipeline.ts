import type { Fact } from "../../domain/fact";
import { ExecutionPlanFactory } from "../../domain/executionPlanFactory";
import { FactFactory } from "../../domain/factFactory";
import type { Observation } from "../../domain/observation";
import { MemoryEventStore } from "../../infrastructure/event-store/MemoryEventStore";
import { DevLogger } from "../../infrastructure/logging/DevLogger";
import { FactEvents, ObservationEvents, PipelineEvents, PlanEvents, RuleEvents } from "../../infrastructure/logging/logEvents";
import type { ExecutionServicePort } from "../../ports/ExecutionServicePort";
import type { EventStorePort } from "../../ports/EventStorePort";
import type { LoggerPort } from "../../ports/LoggerPort";
import type { ObservationPipelinePort } from "../../ports/ObservationPipelinePort";
import type { ObservationRepositoryPort } from "../../ports/ObservationRepositoryPort";
import type { RuleEnginePort } from "../../ports/RuleEnginePort";
import { DefaultExecutionService } from "../execution/DefaultExecutionService";
import { DefaultRuleEngine } from "../../rules/DefaultRuleEngine";
import { MemoryObservationRepository } from "../../repositories/observation/MemoryObservationRepository";
import { recordPipelineCompleted, recordPipelineFailed, recordPipelineStarted } from "../../metrics";
import { telemetry } from "../../telemetry";

type ObservationPipelineDeps = {
  createFact?: (observation: Observation) => Fact;
  repository?: ObservationRepositoryPort;
  executionService?: ExecutionServicePort;
  logger?: LoggerPort;
  ruleEngine?: RuleEnginePort;
  eventStore?: EventStorePort;
};

export class ObservationPipeline implements ObservationPipelinePort {
  private readonly createFact: (observation: Observation) => Fact;
  private readonly repository: ObservationRepositoryPort;
  private readonly executionService: ExecutionServicePort;
  private readonly logger: LoggerPort;
  private readonly ruleEngine: RuleEnginePort;
  private readonly eventStore: EventStorePort;

  constructor(deps: ObservationPipelineDeps = {}) {
    this.createFact = deps.createFact ?? FactFactory.create;
    this.repository = deps.repository ?? new MemoryObservationRepository();
    this.executionService = deps.executionService ?? new DefaultExecutionService();
    this.logger = deps.logger ?? new DevLogger();
    this.ruleEngine = deps.ruleEngine ?? new DefaultRuleEngine();
    this.eventStore = deps.eventStore ?? new MemoryEventStore();
  }

  async process(observation: Observation): Promise<void> {
    const startTime = Date.now();
    recordPipelineStarted();
    await telemetry.withSpan(
      "pipeline.process",
      async (span) => {
        this.logger.debug(PipelineEvents.Started, { observationId: observation.id });
        try {
          telemetry.addEvent(span, "saving_observation", { observationId: observation.id });
          await this.repository.save(observation);
          this.logger.info(ObservationEvents.Saved, { observationId: observation.id });
          await this.eventStore.append(
            `observation:${observation.id}`,
            {
              type: "ObservationSaved",
              occurredAt: observation.timestamp,
              payload: observation,
            },
            0,
          );

          const fact = this.createFact(observation);
          telemetry.addEvent(span, "fact_generated", { factId: fact.id });
          this.logger.info(FactEvents.Generated, { factId: fact.id });
          await this.eventStore.append(
            `fact:${fact.id}`,
            {
              type: "FactGenerated",
              occurredAt: fact.timestamp,
              payload: fact,
            },
            0,
          );

          const actions = await this.ruleEngine.evaluate(fact);
          telemetry.addEvent(span, "rules_evaluated", { actionCount: actions.length });
          this.logger.debug(RuleEvents.Evaluated, { factId: fact.id, actions: actions.length });

          const plan = ExecutionPlanFactory.fromFact(fact, actions);
          telemetry.addEvent(span, "plan_created", { planId: plan.id });
          this.logger.debug(PlanEvents.Created, { planId: plan.id, actions: plan.actions.length });
          await this.executionService.execute(plan);
          telemetry.addEvent(span, "plan_executed", { planId: plan.id });
          await this.repository.completeProcessing(observation.id, true);
          recordPipelineCompleted((Date.now() - startTime) / 1000);
          this.logger.info(PlanEvents.Executed, { planId: plan.id });
          this.logger.debug(PipelineEvents.Completed, { observationId: observation.id });
        } catch (error) {
          await this.repository.completeProcessing(
            observation.id,
            false,
            error instanceof Error ? error.message : String(error),
          );
          recordPipelineFailed((Date.now() - startTime) / 1000);
          throw error;
        }
      },
      {
        attributes: {
          "observation.id": observation.id,
          "observation.type": observation.eventType,
        },
      },
    );
  }
}
