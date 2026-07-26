# Aggregate do Chip

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
- `Motor de Estados do Chip`

## Objetivo

Este documento define como o aggregate `Chip` foi interpretado e implementado nesta versão.

Ele existe para esclarecer onde termina a autoridade do aggregate e onde começam API, workers, projeções e auditoria.

## Definição do aggregate

O aggregate `Chip` é a unidade de consistência lógica do histórico de um `chip_id`.

Seu limite é composto por:

- identidade única do chip
- stream oficial do chip
- regras de transição do chip
- preservação de `previous_state` durante incidentes e recuperação

Regra:

nenhuma operação fora desse limite pode decidir o estado oficial do chip.

## Raiz do aggregate

A raiz do aggregate é o próprio `chip_id`.

O aggregate não possui identidade persistida própria fora do histórico oficial.

Sua identidade é derivada exclusivamente do stream oficial do `chip_id`.

Toda operação válida sobre o aggregate deve ser expressa como:

- leitura do stream do `chip_id`
- validação por replay
- anexação de novo evento ao final do stream do `chip_id`

## Forma de implementação atual

Nesta versão, o aggregate não é implementado como objeto rico com mutação interna persistida.

Ele é implementado como composição de:

- `ChipEventStore`
- `replayChipHistory()`
- `ChipCoreApiService`

Leitura operacional:

| Componente | Papel |
|---|---|
| `ChipEventStore` | fornece o stream oficial |
| `replayChipHistory()` | reconstitui o aggregate por replay |
| `ChipCoreApiService` | valida a operação antes de anexar novo evento |

## Invariantes do aggregate

O aggregate deve preservar, no mínimo:

- nascimento único do chip
- identidade contínua do `chip_id`
- ordem lógica por `sequence`
- idempotência por `event_id`
- restauração ao `previous_state` em recuperação válida
- proibição de reescrita do histórico

Regra:

violação desses invariantes impede a confirmação de novos eventos sobre o aggregate.

## Operações autorizadas

Na implementação atual, o aggregate é atravessado pelas seguintes operações de aplicação:

- `createChip`
- `pairChip`
- `appendEvent`
- `closeChip`
- `getChipHistory`
- `getCurrentState`
- `replayHistory`

Essas operações não alteram o aggregate diretamente em memória persistente.

Elas:

1. carregam o histórico
2. simulam a anexação do novo evento
3. validam por replay
4. confirmam a escrita no stream

## Relação com o motor

O aggregate não possui uma segunda máquina privada.

Ele depende exclusivamente de:

- catálogo oficial de eventos
- máquina de estados
- motor de replay

Regra:

o aggregate não interpreta regras paralelas fora do `Motor de Estados`.

## Relação com persistência

O aggregate não conhece tabela de projeção, checkpoint ou evidência.

Sua persistência oficial é apenas o stream em `chip_event_history`.

Projeções e auditoria podem observar o aggregate, mas não o redefinem.

## Relação com API e workers

### API

A API pode pedir operações ao aggregate.

Ela não pode alterar suas regras internas.

### Workers

Workers podem reagir a fatos persistidos do aggregate.

Eles não podem decidir estado oficial nem anexar eventos por interpretação própria fora da API/serviço de aplicação autorizado.

## Modelo desejado vs modelo atual

### Modelo desejado de longo prazo

Uma evolução futura pode extrair um aggregate mais explícito, com:

- fábrica de eventos de domínio
- comandos internos
- validação isolada da camada de aplicação

### Modelo atual

Nesta versão, o aggregate já existe semanticamente, mas sua materialização está distribuída entre:

- `types.ts`
- `engine.ts`
- `chipCoreApiService.ts`
- `persistence.ts`

Regra:

essa distribuição é aceitável enquanto a autoridade do aggregate continuar presa ao histórico oficial e ao motor.

## Relação com a implementação atual

Este documento está alinhado com:

- `server/domain/chip/engine.ts`
- `server/domain/chip/types.ts`
- `server/domain/chip/persistence.ts`
- `server/services/chipCoreApiService.ts`

## Declaração de congelamento

Este documento está congelado como referência de implementação do aggregate `Chip` na versão `1.0`.
