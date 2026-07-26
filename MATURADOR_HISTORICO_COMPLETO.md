# MATURADOR_HISTORICO_COMPLETO

## Objetivo

Reconstruir a história funcional e arquitetural do `whatsapp-chip-maturator` sem depender de Git.

Este documento usa como fonte:

- documentação do projeto
- baseline congelada
- changelog
- roadmap
- estrutura real do código
- memória do workspace

## Identidade do projeto

O `Maturador` evoluiu de uma base de operação WhatsApp para um sistema mais amplo, com:

- runtime operacional
- gateway de mensagens
- motor de maturação
- observabilidade comportamental
- fila
- scheduler
- dashboard
- evidências
- learning engine
- contratos arquiteturais

## Linha do tempo reconstruída

## Fase 1

### Núcleo operacional

Evidências documentais:

- `BASELINE_FREEZE_v1.0.0-operational.md`
- `PROJECT_STATUS.md`
- `FASE1` aparece em múltiplos diffs e validações

Leitura:

- o projeto foi consolidado como base operacional mínima
- surgem políticas comportamentais, runtime, validação e governança

## Fase 2

### Message Gateway

Evidências documentais:

- `CHANGELOG.md`
- `PROJECT_STATUS.md`
- diffs `fase2`
- ADRs de message gateway

Leitura:

- o gateway de mensagens foi promovido a eixo central
- aparecem `MessageGateway`, `MockMessageGateway`, testes e ADRs dedicados

## Sprint A e Sprint B

### Fila, scheduler e retry

Evidências:

- `docs/adr/0012-sprint-b-scheduler-and-retry.md`
- `docs/architecture/sprint-a-m9-m11.md`
- `docs/architecture/sprint-b-m12-m13.md`
- `server/infrastructure/queue/*`
- `server/infrastructure/scheduler/*`

Leitura:

- a arquitetura saiu de operação linear para operação com fila, retry e scheduler

## M3

### Inbound HTTP MVP

Evidências:

- `docs/architecture/m3-inbound-http-mvp.md`
- `server/inbound/*`

Leitura:

- o projeto ganhou uma frente explícita de entrada de eventos

## Observabilidade e evidências

Evidências:

- `docs/architecture/behavior-observability-signals.md`
- `docs/architecture/pipeline-health-dashboard-shadow-mode.md`
- `docs/application/AUDITORIA_DO_CHIP_MATURADOR.md`
- `server/services/behaviorObservabilityService.ts`
- `server/services/evidenceCatalogService.ts`
- `server/services/evidenceNormalizerService.ts`

Leitura:

- observabilidade deixou de ser só log
- passou a ser parte da arquitetura do produto

## Maturação orientada à identidade

Evidências:

- `docs/adr/ADR-002-maturacao-orientada-a-identidade.md`
- `server/services/maturationEngine.ts`
- `server/services/maturatorOperational.ts`
- `server/services/maturityPolicy.ts`

Leitura:

- o maturador virou motor explícito e não só nome de projeto

## Learning engine e IA

Evidências:

- `docs/adr/ADR-005-learning-engine-como-camada-de-hipoteses-e-conhecimento.md`
- `docs/adr/ADR-006-knowledge-base-e-hypothesis-model.md`
- `server/services/adaptiveLearningEngineService.ts`
- `server/services/fleetLearningService.ts`
- `client/src/components/AIChatBox.tsx`

Leitura:

- há uma camada real de IA/aprendizado, mesmo sem um diretório `agent/` separado

## Dashboard e superfícies operacionais

Evidências:

- `client/src/pages/Dashboard.tsx`
- `client/src/pages/AdminDashboard.tsx`
- `client/src/pages/AdminSystemsHub.tsx`
- `client/src/pages/ControlCenter.tsx`
- `client/src/pages/Operations.tsx`
- `client/src/pages/RuntimeConsole.tsx`
- `client/src/pages/Reports.tsx`

Leitura:

- o projeto amadureceu para além do backend
- há console operacional, admin, relatórios, logs e superfícies de controle

## Arquitetura contratual

Evidências:

- `WHATSAPP_MATURATOR_ARCHITECTURE.md`
- `ARQUITETURA_CONTRATUAL_DO_MATURADOR.md`
- `IMPLEMENTACAO_DO_MATURADOR.md`
- `INVARIANTES_ARQUITETURAIS_DO_CHIP_MATURADOR.md`

Leitura:

- o projeto deixou de ser apenas uma aplicação de automação
- foi formalizado como arquitetura contratual com invariantes, core, application layer, runtime e conformidade

## Drizzle, MySQL e operação

Evidências:

- `drizzle/`
- `drizzle.config.ts`
- `db:push`
- `docker-compose.local.yml`
- `docker-compose.operations.yml`
- `docker-compose.prod.yml`
- `monitoring/`
- `grafana/`

Leitura:

- o projeto ganhou infraestrutura operacional de banco, métricas e monitoração

## Estado congelado

Evidência:

- `BASELINE_FREEZE_v1.0.0-operational.md`

Leitura:

- existe um ponto formal de congelamento operacional `1.0.0`

## O que foi desenvolvido

### Frontend

- Dashboard
- Admin Dashboard
- Admin Systems Hub
- Bulk Dispatch
- Connect Chip
- Control Center
- Logs
- Operations
- Reports
- Runtime Console
- User Workspace
- AI Chat Box

### Backend

- execution service
- observation pipeline
- gateways
- inbound HTTP
- queue e worker
- scheduler
- métricas
- telemetry
- audit service
- chip legacy bridge
- chip reconciliation
- bulk dispatch
- maturation engine
- behavior engine
- fleet learning
- adaptive learning

### Shared

- tipos
- constantes
- erros centrais

### Operação

- scripts de build, dev, start e test
- scripts de manutenção e replay
- runbooks
- evidências
- release
- reports

## Módulos concluídos

Pelo estado atual do código e dos documentos, aparecem como materializados:

- Gateway
- Fila
- Scheduler
- Dashboard
- Runtime
- Observabilidade
- Auditoria
- Maturador
- Bulk Dispatch
- Learning Engine
- Métricas
- Telemetria
- Integração com legado

## Módulos pendentes ou não encontrados como camada separada

- Electron
- Agent separado
- Prompt engine separado
- Voice como módulo independente

## Ponto histórico mais importante

A história do `Maturador` não é a de um projeto pequeno que “ganhou mais arquivos”. É a de um sistema que:

1. começou como operação/base de runtime
2. ganhou gateway
3. ganhou fila e scheduler
4. ganhou observabilidade
5. ganhou dashboard e console
6. ganhou learning engine
7. ganhou arquitetura contratual e baseline congelada

## Conclusão

O `Maturador` atual é resultado de uma expansão contínua do runtime operacional para uma plataforma mais formal, com contratos, infraestrutura, docs, testes, dashboards, fila, scheduler, evidências e aprendizado.

Ele não depende do Git para que essa história seja reconhecida, porque a própria documentação do projeto preserva a sequência de crescimento.
