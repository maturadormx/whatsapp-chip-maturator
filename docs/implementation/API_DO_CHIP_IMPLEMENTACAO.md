# API do Chip — Implementação

## Governança

Status: `CONGELADO`

Versão: `1.0`

Data:

`2026-07-18`

Categoria:

`Implementação — Application Layer`

Depende de:

- `API do Chip Maturador`
- `Aggregate do Chip`
- `Event Store do Chip`
- `Repositories do Chip`

Regra de governança:

este documento descreve como a fronteira contratual da API do chip foi materializada na implementação atual.

Ele não redefine o contrato da API.

## Objetivo

Este documento identifica:

- onde a API do chip foi implementada
- como as operações contratuais foram expostas
- como erros de domínio foram traduzidos para erros de transporte
- como a API preserva a separação entre fronteira e domínio

## Estrutura atual

Na implementação atual, a API do chip é composta por dois níveis:

### Serviço de aplicação

Representado por:

- `ChipCoreApiService`

Origem de código:

- `server/services/chipCoreApiService.ts`

Papel:

- orquestrar leitura do histórico
- simular anexação de novo evento
- validar por replay
- confirmar persistência no stream oficial
- devolver histórico e estado derivado compatíveis com o contrato

### Router de transporte

Representado por:

- `chipCoreRouter`
- `buildChipCoreRouter()`

Origem de código:

- `server/routers/chipCore.ts`

Papel:

- validar entrada via `zod`
- traduzir chamadas externas para o serviço de aplicação
- converter erros internos em `TRPCError`

## Operações contratuais implementadas

Na implementação atual, a fronteira expõe:

- `createChip`
- `pairChip`
- `appendEvent`
- `getChipHistory`
- `getCurrentState`
- `replayHistory`
- `closeChip`

Regra:

essas operações são compatíveis com o contrato congelado da `API do Chip Maturador`, mas ainda não representam uma superfície HTTP pública separada fora do `tRPC`.

## Idempotência

Na implementação atual, a idempotência por operação é entendida assim:

| Operação | Idempotência |
|---|---|
| `createChip` | não |
| `pairChip` | depende da chave externa e do stream já existente |
| `appendEvent` | depende de `eventId` |
| `getChipHistory` | sim |
| `getCurrentState` | sim |
| `replayHistory` | sim |
| `closeChip` | não |

Regra:

na implementação atual, a idempotência forte de escrita está concentrada em `eventId` no stream oficial.

## Validação de entrada

A validação de entrada ocorre no router, usando `zod`.

Exemplos de garantias de fronteira:

- `chipId` obrigatório quando a operação exige chip existente
- `createdBy`, `pairedWith`, `reason` e `closedBy` com texto mínimo válido
- `occurredAt` em formato `datetime`
- `limit` com faixa máxima controlada

Regra:

a validação de estrutura acontece na fronteira.

A validação de semântica do histórico continua pertencendo ao `Core`.

## Validação semântica por replay

Antes de confirmar novo evento, `ChipCoreApiService`:

1. lê o histórico oficial do chip
2. executa replay do histórico atual
3. simula a anexação do novo evento
4. executa replay do histórico simulado
5. rejeita a operação se o evento novo gerar inconsistência

Regra:

a API não decide regra de domínio por conta própria.

Ela usa o replay do `Core` como mecanismo de validação oficial antes da persistência.

## Tradução de erros

Erros internos do serviço são representados por:

- `ChipCoreApiError`

Tipos atuais:

- `CONFLICT`
- `BAD_REQUEST`
- `NOT_FOUND`
- `FAILED_PRECONDITION`

No router, esses erros são traduzidos para `TRPCError`.

Regra:

erro de transporte não altera a natureza do erro de domínio; ele apenas adapta sua exposição para a camada de API.

## Relação com o Event Store

`ChipCoreApiService` depende de `ChipEventStore`.

Ele não fala diretamente com tabelas.

Isso mantém a API desacoplada da implementação física do banco.

## Relação com o runtime

O router `chipCoreRouter` está registrado no `appRouter` sob:

- `chipCore`

Isso torna a API contratual acessível via `tRPC` junto ao restante do sistema.

## Fallback local sem banco

Quando `DATABASE_URL` não está configurada, a API usa a infraestrutura compartilhada em memória.

Origem:

- `server/services/chipInfrastructure.ts`

Regra:

o fallback em memória existe para desenvolvimento e teste.

Ele não altera o contrato semântico da API.

## O que a API atual não faz

A implementação atual da API do chip ainda não:

- substitui toda a malha operacional legada de `chips.ts`
- expõe endpoints REST públicos separados do `tRPC`
- integra autenticação de chip por identidade operacional legada

Regra:

essas ausências são lacunas de integração, não mudanças do contrato da API.

## Testes atuais

Cobertura existente:

- `server/routers/chipCore.test.ts`

Esses testes validam:

- fluxo `CreateChip -> PairChip -> GetCurrentState -> ReplayHistory`
- leitura parcial de histórico
- rejeição de transição inválida
- encerramento do chip

## Relação com a implementação atual

Este documento está alinhado com:

- `server/services/chipCoreApiService.ts`
- `server/routers/chipCore.ts`
- `server/routers/chipCore.test.ts`
- `server/routers.ts`

## Declaração de congelamento

Este documento está congelado como referência de implementação da API do chip na versão `1.0`.
