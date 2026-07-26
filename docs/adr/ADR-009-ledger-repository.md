# ADR-009: LedgerRepository

## Status

Aceito

## Contexto

O `ExecutionService` e o `RetryService` ainda dependiam de funções de persistência soltas (`create`, `get`, `update`, `listRecoverable`) importadas diretamente do módulo de banco.

Isso deixava a arquitetura inconsistente em relação às outras abstrações já introduzidas:

- `MessageGateway`
- `Clock`

## Decisão

Introduzir `BehaviorActionLedgerRepository` como fronteira explícita de persistência do ledger operacional.

Implementações desta rodada:

- `PostgresBehaviorActionLedgerRepository`
- `InMemoryBehaviorActionLedgerRepository`

## Consequências

### Positivas

- persistência deixa de ser detalhe espalhado
- `ExecutionService` e `RetryService` passam a depender de contrato
- testes podem usar repositório em memória
- prepara a extração futura de adapters mais ricos

### Negativas

- mais uma camada de abstração
- necessidade de manter adapter de banco

## Regras

- serviços de domínio não importam funções soltas de DB
- persistência do ledger passa sempre por repositório
- repositório em memória deve preservar a semântica do ledger

## Implementação

- interface `BehaviorActionLedgerRepository`
- adapter `PostgresBehaviorActionLedgerRepository`
- adapter `InMemoryBehaviorActionLedgerRepository`
- integração do repositório no `ExecutionService`
- integração do repositório no `RetryService`
