# MATURADOR_BACKEND

## Objetivo

Consolidar a superfície do backend do `Maturador` com foco em:

- rotas
- services
- repositories
- database
- workers
- cron
- queue
- scheduler
- gateway

## Núcleo do backend

### `_core`

Responsabilidades confirmadas:

- contexto
- cookies
- data API
- env
- heartbeat
- image generation
- llm
- mapa
- notification
- oauth
- rbac
- sdk
- storage proxy
- system router
- trpc
- vite e vite dev
- voice transcription

Leitura:

o backend não é um servidor mínimo. Há um kernel com runtime, auth, integração, geração de imagem, voice e infraestrutura de UI/dev.

## Application layer

Encontrados:

- `DefaultExecutionService`
- `ObservationPipeline`
- `ProcessPendingObservationsUseCase`

Leitura:

há uma camada explícita de aplicação, separando casos de uso da infraestrutura.

## Domain

Encontrados:

- `domain/chip/*`
- `executionPlan`
- `fact`
- `observation`

Leitura:

o projeto possui modelagem de domínio e não apenas handlers soltos.

## Gateway

Encontrados:

- `MessageGateway`
- `GatewayResult`
- `OutboundMessage`
- `MockMessageGateway`

Leitura:

o gateway de mensagens é um módulo central e testado.

## Inbound

Encontrados:

- `InboundRouter`
- `InboundService`
- `ObservationFactory`
- DTOs de inbound

Leitura:

há uma fronteira clara para eventos de entrada.

## Queue

Encontrados:

- `BullMQAdapter`
- `ObservationWorker`
- `QueuePublishingScheduler`
- testes dedicados da fila

Leitura:

a fila é parte real da arquitetura, não um plano futuro.

## Scheduler

Encontrados:

- `IntervalScheduler`
- `schedulingService`
- heartbeats em `server/scheduled/*`

Heartbeats encontrados:

- `behaviorMemoryShadowHeartbeat.ts`
- `chipProjectionHeartbeat.ts`
- `marketingHeartbeat.ts`
- `maturationHeartbeat.ts`

Leitura:

há agendamento tanto em infraestrutura quanto em runtime operacional.

## Métricas e telemetria

### Metrics

- `DlqMetrics`
- `PipelineMetrics`
- `PrometheusRegistry`
- `QueueMetrics`
- `QueueMetricsCollector`
- `QueueMetricsRoute`
- `SchedulerMetrics`
- `WorkerMetrics`

### Telemetry

- `TelemetryService`
- `Tracing`

Leitura:

observabilidade técnica é parte do backend.

## Repositories

### Ledger

- `BehaviorActionLedgerRepository`
- `InMemoryBehaviorActionLedgerRepository`
- `PostgresBehaviorActionLedgerRepository`

### Observation

- `MemoryObservationRepository`
- `MysqlObservationRepository`

## Database

### Evidências encontradas

- `server/db.ts`
- `drizzle/`
- `drizzle.config.ts`
- `MysqlEventStore`
- `MysqlObservationRepository`
- scripts `db:push`
- `mysql2`

### Leitura

o banco principal é orientado a `MySQL + Drizzle`.

## Routers

### `server/routers`

- `admin.ts`
- `chipCore.ts`
- `chips.ts`
- `controlCenter.ts`
- `operations.ts`
- `runtime.ts`
- `whatsapp.ts`

### `server/routes/internal`

- `metrics.ts`

Leitura:

há rotas administrativas, de runtime, métricas, WhatsApp, chip core e operação.

## Services

### Blocos principais encontrados

- `adaptiveLearningEngineService`
- `behavior*` family
- `bulkDispatchService`
- `chipAuditService`
- `chipCoreApiService`
- `chipLegacyBridgeService`
- `chipProjectionWorkerService`
- `chipReconciliationService`
- `controlCenterService`
- `episodeBuilderService`
- `evidenceCatalogService`
- `evidenceNormalizerService`
- `fleetLearningService`
- `identitySnapshotGeneratorService`
- `maturationEngine`
- `maturatorOperational`
- `maturityPolicy`
- `operationalMaterializationService`
- `operationalMaterializer`
- `passiveBehaviorEngine`
- `runtimeSupervisorService`
- `schedulingService`
- `whatsappService`

## Workers

### Evidências diretas

- `ObservationWorker`
- `chipProjectionWorkerService`
- `WORKERS_DO_CHIP_MATURADOR.md`

Leitura:

o projeto possui workers explícitos em fila e projeção.

## Backend atual em uma frase

O backend do `Maturador` é um backend operacional completo, com domínio, fila, scheduler, métricas, telemetria, gateways, reconciliação, learning engine e serviços de maturação.
