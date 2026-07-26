# Workers do Chip — Implementação

## Governança

Status: `CONGELADO`

Versão: `1.0`

Data:

`2026-07-18`

Categoria:

`Implementação — Application Layer`

Depende de:

- `Workers do Chip Maturador`
- `Event Store do Chip`
- `Repositories do Chip`
- `API do Chip — Implementação`

## Objetivo

Este documento descreve como a camada de workers do chip foi implementada na versão atual.

Ele existe para mostrar:

- como fatos persistidos são consumidos
- como projeções são materializadas
- como checkpoints são preservados
- como o worker evita invadir o domínio

## Worker atual

A implementação atual possui um worker explícito de projeção:

- `ChipProjectionWorkerService`

Origem de código:

- `server/services/chipProjectionWorkerService.ts`

Nome oficial do worker:

- `chip-state-projection`

## Papel do worker

O worker atual:

- lê fatos já persistidos via `listPersistedEvents()`
- agrupa os offsets novos por `chip_id`
- executa `replayHistory()` via serviço de aplicação
- salva projeções derivadas em `ChipProjectionStore`
- avança checkpoint em `ChipWorkerCheckpoint`

Regra:

o worker não produz estado oficial.

Ele materializa leitura derivada a partir de fatos já oficializados.

Um worker pode falhar sem comprometer a consistência do domínio.

## Feed de consumo

O consumo assíncrono depende de:

- `ChipEventStore.listPersistedEvents()`

Esse método expõe:

- `offset` físico do fato persistido
- `event` oficial correspondente

Regra:

worker reage ao feed persistido, nunca a cache, memória de processo ou projeção.

## Checkpoint

O progresso do worker é preservado por:

- `ChipWorkerCheckpoint`
- `ChipProjectionStore.saveCheckpoint()`
- `ChipProjectionStore.getCheckpoint()`

Papel:

- registrar o último offset físico processado
- evitar reprocessamento integral desnecessário

Regra:

checkpoint não altera nem complementa o histórico oficial.

## Projeção derivada

O estado derivado materializado pelo worker é representado por:

- `ChipStateProjection`

Campos principais:

- `chip_id`
- `current_state`
- `previous_state`
- `last_sequence`
- `inconsistency_count`
- `updated_at`

Regra:

essa projeção é descartável, recalculável e subordinada ao stream oficial.

## Relação com a API

O worker não chama o motor diretamente sobre fatos arbitrários.

Ele usa:

- `ChipCoreApiService.replayHistory()`

Isso garante que:

- a leitura seja consistente com a mesma fronteira semântica usada pela API
- o replay continue centralizado no núcleo já validado

## Relação com o runtime

O worker está integrado ao runtime por dois caminhos:

### Rota administrativa

- `runtime.triggerChipProjectionCycle`

### Heartbeat agendável

- `chipProjectionHeartbeatHandler`
- `ensureChipProjectionHeartbeatJob()`

Origem:

- `server/routers/runtime.ts`
- `server/scheduled/chipProjectionHeartbeat.ts`

## Estratégia de processamento

Na rodada atual, o worker:

1. lê checkpoint
2. consome novos offsets
3. agrupa por `chip_id`
4. recalcula projeção por replay completo daquele chip
5. grava projeção
6. grava novo checkpoint

Regra:

o worker privilegia determinismo e clareza sobre micro-otimização.

## O que o worker atual não faz

A implementação atual ainda não inclui:

- worker de integração externa do chip
- fila dedicada de mensageria
- particionamento avançado de consumo
- reprocessamento paralelo por shard de `chip_id`

Regra:

essas ausências representam capacidade ainda não implementada, não desvio do contrato.

## Testes atuais

Cobertura existente:

- `server/services/chipProjectionWorkerService.test.ts`

Os testes verificam:

- projeção a partir de fatos persistidos
- avanço de checkpoint
- consumo incremental por novos offsets
- agrupamento de múltiplos fatos do mesmo chip em uma única atualização por rodada

## Relação com a implementação atual

Este documento está alinhado com:

- `server/services/chipProjectionWorkerService.ts`
- `server/services/chipProjectionWorkerService.test.ts`
- `server/domain/chip/persistence.ts`
- `server/domain/chip/*ProjectionStore.ts`
- `server/scheduled/chipProjectionHeartbeat.ts`
- `server/routers/runtime.ts`

## Declaração de congelamento

Este documento está congelado como referência de implementação dos workers do chip na versão `1.0`.
