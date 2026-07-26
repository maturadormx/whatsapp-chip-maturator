# Contracts

> Fonte única de verdade para os **ports/contratos** que o núcleo reconhece.

## Contrato → Produção → Teste

| Contrato | Produção | Teste |
|---|---|---|
| `Clock` | `SystemClock` | `FakeClock` (`MutableClock`) |
| `MessageGateway` | adapter legado atual | `MockMessageGateway` / `FakeMessageGateway` |
| `BehaviorActionLedgerRepository` | `PostgresBehaviorActionLedgerRepository` | `InMemoryBehaviorActionLedgerRepository` |
| `ObservationRepositoryPort` | `MemoryObservationRepository` (temporário) | `MemoryObservationRepository` |
| `ExecutionServicePort` | `DefaultExecutionService` | adapter fake/mocked em testes |
| `LoggerPort` | `DevLogger` | adapter fake/mocked em testes |
| `RuleEnginePort` | `DefaultRuleEngine` | adapter fake/mocked em testes |
| `EventStorePort` | `MemoryEventStore` | `MemoryEventStore` |
| `SchedulerPort` | `IntervalScheduler` | adapter fake/mocked em testes |
| `ObservationRepositoryPort` (SQL) | `MysqlObservationRepository` | integração opcional |
| `EventStorePort` (SQL) | `MysqlEventStore` | integração opcional |

## Regras

- o domínio depende apenas de contratos
- adapters de produção e teste implementam contratos, não políticas
- contratos preservam compatibilidade; extensões exigem ADR quando alterarem semântica pública
