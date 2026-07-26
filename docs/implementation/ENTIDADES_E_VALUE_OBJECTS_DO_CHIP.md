# Entidades e Value Objects do Chip

## Governança

Status: `CONGELADO`

Versão: `1.0`

Data:

`2026-07-18`

Categoria:

`Implementação — Core do Produto`

Depende de:

- `Contrato de Domínio do Chip`
- `Máquina de Estados do Chip`
- `Contrato dos Eventos do Chip`

Regra de governança:

este documento descreve como os conceitos centrais do domínio foram materializados em tipos e estruturas da implementação.

Ele não redefine o domínio.

## Objetivo

Este documento identifica quais estruturas do código desempenham papel de entidade e quais desempenham papel de value object dentro da implementação atual.

Ele existe para impedir que a modelagem do domínio se perca em estruturas acidentais de transporte, banco ou interface.

## Entidade principal

### `Chip`

Na implementação atual, a entidade `Chip` não é materializada como uma classe mutável tradicional.

Ela é representada pela combinação de:

- `chip_id` como identidade contínua
- `ChipEventRecord[]` como histórico oficial
- `MotorResult` como interpretação derivada do histórico

Regra:

na implementação atual, o `Chip` é uma entidade reconstruída por replay, não um objeto mutável tratado como fonte primária de verdade.

## Value objects oficiais

### Estado do chip

O conjunto de estados oficiais é materializado por:

- `ChipLifeState`
- `ChipOperationalState`
- `ChipState`

Origem de código:

- `server/domain/chip/types.ts`

Regra:

estado é value object de interpretação.

Ele não tem identidade própria e só existe como derivação coerente do histórico.

### Tipo de evento

Os tipos oficiais de evento são materializados por:

- `KNOWN_CHIP_EVENT_TYPES`
- `KnownChipEventType`

Origem de código:

- `server/domain/chip/types.ts`

Regra:

o tipo do evento é um value object fechado pelo catálogo oficial.

### Registro de evento

O evento persistido é materializado por:

- `ChipEventRecord`

Campos centrais:

- `event_id`
- `chip_id`
- `event_type`
- `event_version`
- `sequence`
- `occurred_at`
- `recorded_at`
- `payload`
- `metadata`

Regra:

`ChipEventRecord` é a unidade canônica de fato persistido dentro da implementação.

### Inconsistência do motor

As inconsistências oficiais são materializadas por:

- `MotorInconsistencyCode`
- `MotorInconsistency`

Origem de código:

- `server/domain/chip/types.ts`

Regra:

inconsistência é um value object de observação e validação.

Ela não é estado de domínio e não substitui o histórico.

### Transição aplicada

Cada transição materializada pelo replay é representada por:

- `TransitionEntry`

Origem de código:

- `server/domain/chip/types.ts`

Papel:

- registrar a passagem de `from_state` para `to_state`
- manter rastreabilidade por `sequence` e `event_id`

### Resultado do motor

O replay do domínio produz:

- `MotorResult`

Origem de código:

- `server/domain/chip/types.ts`

Papel:

- representar o estado atual derivado
- preservar `previous_state`
- expor inconsistências
- registrar quantidade de eventos processados
- expor `transition_log`

Regra:

`MotorResult` é value object de saída do motor.

Ele não é persistência primária e não substitui o stream oficial.

## Value objects de persistência e leitura

### Histórico lido

A leitura do stream é materializada por:

- `ChipHistorySlice`
- `ChipHistoryReadMode`

Origem de código:

- `server/domain/chip/persistence.ts`

Papel:

- distinguir histórico `complete` de `partial`
- carregar eventos aptos a replay

### Offset persistido

O consumo assíncrono de fatos persistidos usa:

- `PersistedChipEventFeedItem`
- `PersistedChipEventBatch`

Papel:

- representar o offset físico do feed persistido
- permitir checkpoint de worker sem alterar o stream oficial

### Projeção derivada

A projeção de leitura do estado é representada por:

- `ChipStateProjection`

Papel:

- leitura rápida
- observação do estado atual
- contagem de inconsistências derivadas

Regra:

`ChipStateProjection` é descartável e recalculável.

### Checkpoint de worker

O cursor de consumo assíncrono é representado por:

- `ChipWorkerCheckpoint`

Papel:

- indicar até qual offset físico um worker observou fatos persistidos

## Value objects de auditoria

### Evidência de auditoria

A evidência append-only da auditoria é representada por:

- `ChipAuditEvidence`
- `ChipAuditEvidenceType`

Origem de código:

- `server/domain/chip/audit.ts`

Regra:

evidência de auditoria é somente leitura após persistência.

Nova observação gera nova evidência.

## Estruturas que não são entidades de domínio

As seguintes estruturas existem no projeto, mas não devem ser confundidas com entidades do domínio do chip:

- tabelas operacionais como `whatsapp_chips`
- respostas de router
- DTOs de transporte
- payloads de interface
- métricas e painéis operacionais

Regra:

se uma estrutura não pode ser reconstruída ou justificada a partir do histórico oficial, ela não possui autoridade de domínio.

## Relação com a implementação atual

Este documento está alinhado com:

- `server/domain/chip/types.ts`
- `server/domain/chip/persistence.ts`
- `server/domain/chip/audit.ts`
- `server/domain/chip/engine.ts`

## Declaração de congelamento

Este documento está congelado como referência de implementação para entidades e value objects do chip na versão `1.0`.
