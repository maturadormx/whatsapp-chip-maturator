# MATURADOR_MEMORIA_PROJETO

## Objetivo

Reconstruir a memória arquitetural e prática do `Maturador` como projeto vivo, sem depender de Git.

Este documento é diferente do histórico puro. Ele resume como o projeto foi sendo moldado ao longo do tempo.

## Narrativa de evolução

## 1. Base operacional

O projeto começa como uma base operacional de runtime WhatsApp, com foco em execução, observação e operação local.

Sinais disso:

- `PROJECT.md`
- `PROJECT_STATUS.md`
- scripts operacionais
- runbooks
- docs de arquitetura e operação

## 2. Gateway de mensagens

O sistema ganha uma camada explícita de `MessageGateway`.

Evidências:

- ADRs sobre gateway
- `server/gateways/*`
- testes de gateway

Isso marca a passagem de um runtime genérico para um runtime de comunicação formalizada.

## 3. Fila e scheduler

Depois, o projeto evolui para uma operação assíncrona, com:

- queue
- retry
- scheduler
- worker

Evidências:

- `BullMQAdapter`
- `ObservationWorker`
- `QueuePublishingScheduler`
- `IntervalScheduler`
- ADRs de sprint B

## 4. Observabilidade

O projeto deixa de ser só “executar mensagens” e passa a observar comportamento, sinais e pipeline.

Evidências:

- observability docs
- serviços de observabilidade
- métricas e telemetria
- dashboard health e pipeline health

## 5. Maturação

O “maturador” deixa de ser rótulo e vira motor do sistema.

Evidências:

- `maturationEngine.ts`
- `maturatorOperational.ts`
- `maturityPolicy.ts`
- ADR de maturação orientada à identidade

## 6. Evidências e auditoria

A plataforma passa a preservar fatos, evidências e trilhas de decisão.

Evidências:

- `chipAuditService`
- docs de auditoria
- `evidencias/`
- runbooks e certificações

## 7. Aprendizado e IA

O sistema ganha memória, hipóteses e aprendizado.

Evidências:

- `adaptiveLearningEngineService`
- `fleetLearningService`
- `behaviorMemoryService`
- docs sobre knowledge base e hypothesis model
- `AIChatBox`

## 8. Console e dashboards

A interface amadurece para uma camada operacional completa.

Evidências:

- dashboards
- admin
- control center
- runtime console
- reports
- logs

## 9. Arquitetura contratual

O projeto é formalizado em documentos de arquitetura contratual, invariantes e implementação congelada.

Evidências:

- `WHATSAPP_MATURATOR_ARCHITECTURE.md`
- `ARQUITETURA_CONTRATUAL_DO_MATURADOR.md`
- `IMPLEMENTACAO_DO_MATURADOR.md`
- `INVARIANTES_ARQUITETURAIS_DO_CHIP_MATURADOR.md`

## 10. Baseline operacional

Por fim, o sistema atinge uma baseline congelada `v1.0.0-operational`.

Isso mostra que o projeto não é experimento solto. Ele foi formalmente estabilizado.

## Memória de decisões

As decisões mais fortes preservadas nos documentos são:

- separar domínio, aplicação e infraestrutura
- tratar gateway como contrato e não como detalhe
- materializar observação antes de fato
- usar fila e scheduler como parte da operação
- formalizar aprendizado como camada de hipóteses e conhecimento
- adotar arquitetura contratual do chip

## Memória de expansão

O crescimento do `Maturador` sugere a seguinte sequência prática:

1. operação base
2. gateway
3. fila
4. scheduler
5. observabilidade
6. auditoria
7. maturação orientada à identidade
8. aprendizado e IA
9. dashboards e console
10. baseline operacional congelada

## Memória do que foi ficando na raiz

A raiz do projeto guarda o rastro dessa evolução:

- diffs de fase
- relatórios de faxina
- relatórios de estabilização
- relatórios de certificação
- notas de release
- changelog
- checklist final

Isso mostra que o projeto foi trabalhado em ciclos, com forte registro de fechamento e validação.

## O que este documento preserva

Ele preserva a ideia mais importante sobre o `Maturador`:

> este projeto não é apenas um app com frontend e backend. Ele é uma plataforma operacional que foi ganhando contratos, observabilidade, inteligência, auditoria e disciplina arquitetural ao longo do tempo.
