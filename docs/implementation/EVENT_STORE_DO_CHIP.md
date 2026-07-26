# Event Store do Chip

## Governança

Status: `CONGELADO`

Versão: `1.0`

Data:

`2026-07-18`

Categoria:

`Implementação — Core do Produto`

Depende de:

- `Contrato dos Eventos do Chip`
- `Persistência do Histórico do Chip`
- `Modelo de Persistência do Chip`

## Objetivo

Este documento define a camada de `Event Store` do chip na implementação atual.

Ele existe para separar, com clareza:

- o stream oficial de eventos
- a interface de acesso ao stream
- a implementação física desse acesso

## Definição

O `Event Store` do chip é a camada responsável por:

- anexar eventos ao stream oficial
- recuperar histórico por `chip_id`
- expor o feed de fatos persistidos para consumo assíncrono

Na implementação atual, essa camada é representada pela interface:

- `ChipEventStore`

Origem de código:

- `server/domain/chip/persistence.ts`

## Interface oficial

O contrato executável do `Event Store` contém:

- `append()`
- `getHistory()`
- `listPersistedEvents()`

### `append()`

Responsável por:

- materializar `recorded_at`
- atribuir `sequence`
- garantir idempotência por `event_id`
- confirmar o evento no stream oficial

### `getHistory()`

Responsável por:

- recuperar histórico completo ou parcial
- devolver eventos em ordem lógica
- informar o modo de leitura (`complete` ou `partial`)

### `listPersistedEvents()`

Responsável por:

- expor fatos já persistidos para workers
- fornecer offset físico para checkpoints

## Implementações atuais

### `InMemoryChipEventStore`

Implementação voltada a:

- testes
- execução local sem banco
- validação da semântica do contrato

Características:

- stream em memória por `chip_id`
- idempotência por `event_id`
- feed persistido em memória para workers

### `MysqlChipEventStore`

Implementação oficial de persistência física.

Origem de código:

- `server/domain/chip/mysqlEventStore.ts`

Características:

- tabela `chip_event_history`
- transação por append
- leitura da última `sequence`
- `UNIQUE(eventId)`
- `UNIQUE(chipId, sequence)`
- retry limitado em caso de colisão concorrente

## Regras do Event Store

- nunca editar evento já confirmado
- nunca sobrescrever `sequence`
- nunca tratar projeção como fato oficial
- nunca expor histórico fora da ordem lógica oficial
- nunca publicar fato ao worker antes da confirmação no stream

## Garantias

O `Event Store`:

- grava apenas em modo append
- nunca altera eventos já confirmados
- nunca remove eventos do stream oficial
- nunca interpreta domínio
- nunca deriva estado
- nunca atribui significado novo aos eventos

## Relação com o motor

O `Event Store` não interpreta o domínio.

Ele apenas preserva e devolve fatos.

O replay oficial continua pertencendo ao `Motor de Estados`.

## Relação com workers

Workers consomem o feed de fatos persistidos via `listPersistedEvents()`.

Regra:

worker não reage a estado derivado, cache ou projeção.

Ele reage apenas ao que já foi oficialmente persistido no `Event Store`.

## Relação com auditoria

A auditoria lê o histórico via serviços que dependem do `Event Store`.

Ela não grava fatos no `Event Store`.

Ela produz suas próprias evidências append-only.

## Limites da camada

O `Event Store` não:

- valida semântica completa de transição de estado
- decide domínio
- produz projeções
- produz evidências de auditoria
- substitui o aggregate

## Relação com a implementação atual

Este documento está alinhado com:

- `server/domain/chip/persistence.ts`
- `server/domain/chip/inMemoryEventStore.ts`
- `server/domain/chip/mysqlEventStore.ts`

## Declaração de congelamento

Este documento está congelado como referência de implementação do `Event Store` do chip na versão `1.0`.
