# MATURADOR_MODULOS

## Objetivo

Listar os módulos do `whatsapp-chip-maturator` e classificá-los em:

- `Existe`
- `Está incompleto`
- `Não encontrado`

## Núcleo operacional

| Módulo | Estado | Evidência |
|---|---|---|
| Gateway | Existe | `server/gateways/*`, ADRs de message gateway |
| Scheduler | Existe | `server/infrastructure/scheduler/*`, `schedulingService.ts` |
| Fila | Existe | `server/infrastructure/queue/*` |
| Runtime | Existe | `server/runtime/*`, `scripts/operational/*` |
| Auditoria | Existe | `chipAuditService`, docs de auditoria |
| Observabilidade | Existe | `behaviorObservabilityService`, docs de observability |
| Métricas | Existe | `server/metrics/*` |
| Telemetria | Existe | `server/telemetry/*` |

## Produto

| Módulo | Estado | Evidência |
|---|---|---|
| Maturador | Existe | `maturationEngine.ts`, `maturatorOperational.ts` |
| Bulk Dispatch | Existe | `client/src/pages/BulkDispatch.tsx`, `bulkDispatchService.ts` |
| Control Center | Existe | `ControlCenter.tsx`, `controlCenterService.ts` |
| Dashboard | Existe | `Dashboard.tsx`, `AdminDashboard.tsx` |
| Runtime Console | Existe | `RuntimeConsole.tsx` |
| Reports | Existe | `Reports.tsx` |
| Logs | Existe | `Logs.tsx`, logs operacionais na raiz |
| User Workspace | Existe | `UserWorkspace.tsx` |

## Comportamento e política

| Módulo | Estado | Evidência |
|---|---|---|
| Behavior Engine | Existe | `server/services/behavior/*` |
| Retry Service | Existe | `retryService.ts` |
| Budget Reservation | Existe | `budgetReservationService.ts` |
| Session Engine | Existe | `sessionEngine.ts` |
| Policy Engine | Existe | `behaviorPolicyEngine.ts` |
| Rule Engine | Existe | `server/rules/*` |

## Persistência e dados

| Módulo | Estado | Evidência |
|---|---|---|
| Database | Existe | `drizzle/`, `drizzle.config.ts`, `server/db.ts` |
| Repositories | Existe | `server/repositories/*` |
| Event Store | Existe | `server/infrastructure/event-store/*` |
| Observation Repository | Existe | `MysqlObservationRepository.ts`, `MemoryObservationRepository.ts` |
| Ledger Repository | Existe | `server/repositories/ledger/*` |
| Datasets | Existe | `datasets/golden`, `datasets/synthetic` |

## Aprendizado e IA

| Módulo | Estado | Evidência |
|---|---|---|
| Adaptive Learning | Existe | `adaptiveLearningEngineService.ts` |
| Fleet Learning | Existe | `fleetLearningService.ts` |
| Behavior Memory | Existe | `behaviorMemoryService.ts`, `behaviorMemoryShadowService.ts` |
| AI Chat | Existe | `client/src/components/AIChatBox.tsx` |
| Knowledge Base | Está incompleto | há ADRs e docs de hipótese/conhecimento, mas não um diretório isolado de KB |
| Prompt Engine | Não encontrado | não há módulo com esse nome |
| Agentes de IA separados | Não encontrado | não há pasta `agent/` dedicada |

## Interfaces e integração

| Módulo | Estado | Evidência |
|---|---|---|
| Inbound HTTP | Existe | `server/inbound/*` |
| API do Chip | Existe | docs de API, `routers/chipCore.ts` |
| WhatsApp Service | Existe | `whatsappService.ts`, `baileys` |
| Mock Gateway | Existe | `server/gateways/mock/*` |
| Legacy Bridge | Existe | `chipLegacyBridgeService.ts` |
| Reconciliation | Existe | `chipReconciliationService.ts` |

## Infra e operação

| Módulo | Estado | Evidência |
|---|---|---|
| Monitoring | Existe | `monitoring/` |
| Grafana | Existe | `grafana/` |
| Runbooks | Existe | `runbooks/`, `docs/runbooks/*` |
| Release | Existe | `release/`, `README_RELEASE.md`, `RELEASE-NOTES.md` |
| Evidências | Existe | `evidencias/` |
| Forensics | Existe | `forensics/` |

## Itens citados mas não encontrados como módulo dedicado

| Módulo | Estado | Observação |
|---|---|---|
| Electron | Não encontrado | não há pasta ou build dedicada |
| Proxy | Não encontrado | pode existir como aspecto de infraestrutura, não como módulo nomeado |
| Updater | Não encontrado | não há camada dedicada |
| Voice | Não encontrado | não existe módulo próprio como no `VenonX` |
| Chip Manager | Está incompleto | o conceito aparece via chip core, não como módulo isolado |
| Lead Manager | Está incompleto | há runtime e comportamento, mas não camada explícita com esse nome |
| Prompt Engine | Não encontrado | não localizado |

## Conclusão

O `Maturador` atual tem muitos módulos reais e maduros. O projeto não parece um esqueleto vazio. O que falta são alguns módulos nomeados de forma mais explícita ou separados como subsistemas independentes, especialmente em IA, Voice e Electron.
