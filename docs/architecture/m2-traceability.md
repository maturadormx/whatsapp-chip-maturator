# M2 Traceability

Projeto: `whatsapp-chip-maturator`  
Fases documentadas:

- `Fase 1 — Núcleo Operacional`
- `Fase 2 — MessageGateway`

## Objetivo

Concentrar a rastreabilidade executável da Fase 1 em formato Markdown, sincronizada com a matriz textual do repositório.

## Status dos blocos

| Entrega | Status | Evidência |
|---|---|---|
| Bloco A — Retry | `Done` | `server/services/behavior/retryService.ts` |
| Bloco B — Budget Reservation | `Done` | `server/services/behavior/budgetReservationService.ts` |
| Validação integrada da Fase 1 | `Done` | `tests/integration/m2-fase1-e2e.test.ts` |

## Mapeamento por componente

| Componente | Responsabilidade | Evidência de teste |
|---|---|---|
| `BehaviorPolicyEngine` | decisão operacional | `server/services/behavior/behaviorPolicyEngine.test.ts` |
| `ExecutionService` | orquestração da execução | `server/services/behavior/executionService.test.ts` |
| `RetryService` | reexecução recuperável | `server/services/behavior/retryService.test.ts` |
| `BudgetReservationService` | reserva/commit/release | `server/services/behavior/budgetReservationService.test.ts` |
| Integração da fase | fluxo operacional interno | `tests/integration/m2-fase1-e2e.test.ts` |

## Invariantes exercitados pelo E2E

- nenhuma reserva órfã
- ledger consistente
- `executionId` único
- `attempt` monotônico
- budget correto
- ausência de envio duplicado

## Gate de encerramento da Fase 1

```text
PR #7
  ↓
E2E verde
  ↓
documentação sincronizada
  ↓
merge
  ↓
CI verde
  ↓
tag m2-fase-1
```

## Próximo passo

A Fase 2 só pode começar após a baseline `m2-fase-1`.

## Fase 2 — MessageGateway

| Componente | Status | Commit | Testes |
|---|---|---|---|
| `MessageGateway` (interface) | ✅ `Done` | `Commit 1` | unitário |
| `OutboundMessage` | ✅ `Done` | `Commit 1` | unitário |
| `GatewayResult` | ✅ `Done` | `Commit 1` | unitário |
| Injeção no `ExecutionService` | ✅ `Done` | `Commit 2` | integração |
| `FakeMessageGateway` | ✅ `Done` | `Commit 3` | unitário + integração |
| Integração `ExecutionService → Gateway` | ✅ `Done` | `Commit 3` | integração |
| ADR e documentação da abstração | ✅ `Done` | `Commit 4` | documental |

Estado atual da Fase 2:

- contratos: concluídos
- injeção: concluída
- testes dedicados: concluídos
- documentação: concluída

Próximo: registrar a baseline local da Fase 2 (`m2-fase-2`) no Git local e só então abrir o próximo marco arquitetural.

## PR #9 — MockGateway

| Componente | Status | Commit | Testes |
|---|---|---|---|
| `MockConfig` | ✅ `Done` | `Commit 1` | unitário |
| `MockMessageGateway` | ✅ `Done` | `Commit 1` | unitário |
| Testes unitários do mock | ✅ `Done` | `Commit 2` | unitário |
| Integração `ExecutionService -> MockMessageGateway` | ✅ `Done` | `Commit 3` | integração |
| Documentação do PR #9 | ✅ `Done` | `Commit 4` | documental |

## PR #10 — Clock

| Componente | Status | Commit | Testes |
|---|---|---|---|
| `Clock` | ✅ `Done` | `Commit 1` | unitário |
| `TestClock` | ✅ `Done` | `Commit 1` | unitário |
| `SystemClock` | ✅ `Done` | `Commit 1` | unitário |
| `FakeClock` | ✅ `Done` | `Commit 1` | unitário |
| Injeção no `ExecutionService` | ✅ `Done` | `Commit 2` | integração |
| Testes do clock e uso no retry timing | ✅ `Done` | `Commit 3` | unitário + integração |
| ADR + checklist + documentação | ✅ `Done` | `Commit 4` | documental |

Próximo: `LedgerRepository` como próxima abstração fundamental antes de `Inbound`.

## PR #11 — LedgerRepository

| Componente | Status | Commit | Testes |
|---|---|---|---|
| `BehaviorActionLedgerRepository` | ✅ `Done` | `Commit 1` | unitário |
| `PostgresBehaviorActionLedgerRepository` | ✅ `Done` | `Commit 1` | indireto |
| `InMemoryBehaviorActionLedgerRepository` | ✅ `Done` | `Commit 1` | unitário |
| Integração no `ExecutionService` | ✅ `Done` | `Commit 2` | integração |
| Integração no `RetryService` | ✅ `Done` | `Commit 2` | integração |
| ADR e documentação | ✅ `Done` | `Commit 3` | documental |

Próximo: `Inbound` ou `Event Store`, agora com Gateway, Clock e LedgerRepository estabilizados.

## M3 — Inbound HTTP MVP

| Componente | Status | Commit | Testes |
|---|---|---|---|
| `InboundEventDto` | ✅ `Done` | `TASK-001.1` | unitário indireto |
| `InboundRouter` | ✅ `Done` | `TASK-001.1` | unitário |
| Registro no `Express` | ✅ `Done` | `TASK-001.1` | integração leve |
| Documentação do MVP | ✅ `Done` | `TASK-001.1` | documental |

## M4 — Observation

| Componente | Status | Commit | Testes |
|---|---|---|---|
| `Observation` (domínio) | ✅ `Done` | `TASK-001.3` | unitário indireto |
| `ObservationFactory` (DTO → Observation) | ✅ `Done` | `TASK-001.3` | unitário |
| `ObservationPipelinePort` | ✅ `Done` | `TASK-001.6` | unitário indireto |
| `ObservationPipeline` (gera Fact internamente) | ✅ `Done` | `TASK-001.6` | unitário |

## M7 — Persistência mínima (Observation)

| Componente | Status | Commit | Testes |
|---|---|---|---|
| `ObservationRepositoryPort` | ✅ `Done` | `TASK-003.0A` | unitário |
| `MemoryObservationRepository` | ✅ `Done` | `TASK-003.0A` | unitário |
| Pipeline persiste Observation antes de Fact | ✅ `Done` | `TASK-003.0B` | unitário |
| Falha de persistência aborta pipeline e retorna 500 | ✅ `Done` | `TASK-003.0B` | unitário |
| ADR persistir Observation antes de Fact | ✅ `Done` | `TASK-003.0B` | documental |

Próximo: `ExecutionService` consumindo `Fact` (M8).

## M8 — ExecutionPlan

| Componente | Status | Commit | Testes |
|---|---|---|---|
| `ExecutionPlan` | ✅ `Done` | `M8` | unitário indireto |
| `ExecutionPlanFactory` | ✅ `Done` | `M8` | unitário indireto |
| `ExecutionServicePort` | ✅ `Done` | `M8` | unitário |
| `DefaultExecutionService` | ✅ `Done` | `M8` | unitário |
| `ObservationPipeline -> ExecutionService` | ✅ `Done` | `M8` | unitário |
| ADR do elo `Fact -> ExecutionPlan` | ✅ `Done` | `M8` | documental |

Próximo: `LoggerPort` ou `RuleEngine`, ainda sem reabrir o HTTP.

## Sprint A — M9 + M10 + M11

| Componente | Status | Commit | Testes |
|---|---|---|---|
| `LoggerPort` + `DevLogger` | ✅ `Done` | `Sprint A` | unitário |
| `RuleEnginePort` + `DefaultRuleEngine` | ✅ `Done` | `Sprint A` | unitário |
| `CriticalAlertRule` | ✅ `Done` | `Sprint A` | unitário |
| `EventStorePort` + `MemoryEventStore` | ✅ `Done` | `Sprint A` | unitário |
| `ObservationPipeline` com logger + rule engine + event store | ✅ `Done` | `Sprint A` | unitário |
| `ExecutionPlan` com ações reais | ✅ `Done` | `Sprint A` | unitário indireto |

Próximo: `M12` (`Scheduler`) ou `M13` (`Retry`) em sprint separado.

## Sprint B — M12 + M13

| Componente | Status | Commit | Testes |
|---|---|---|---|
| `ProcessPendingObservationsUseCase` | ✅ `Done` | `Sprint B` | unitário |
| `SchedulerPort` + `IntervalScheduler` | ✅ `Done` | `Sprint B` | unitário |
| `RetryExecutionServiceDecorator` | ✅ `Done` | `Sprint B` | unitário |
| Runtime compartilhado do pipeline | ✅ `Done` | `Sprint B` | integração leve |
| `ObservationRepository` com pendência/processado | ✅ `Done` | `Sprint B` | unitário |
| ADR + documentação do Sprint B | ✅ `Done` | `Sprint B` | documental |

Próximo: Sprint C com configuração e endurecimento operacional.

## D1 — SQL runtime

| Componente | Status | Commit | Testes |
|---|---|---|---|
| `MysqlObservationRepository` | ✅ `Done` | `D1` | integração opcional |
| `MysqlEventStore` | ✅ `Done` | `D1` | integração opcional |
| seleção por ambiente (`memory/mysql`) | ✅ `Done` | `D1` | unitário indireto |
| `/ready` com status do driver | ✅ `Done` | `D1` | integração leve |
| scripts/env/docs do runtime SQL | ✅ `Done` | `D1` | documental |

Próximo: endurecer concorrência real do claim em múltiplos workers e externalizar retry policy.
