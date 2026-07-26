# PR #11 — LedgerRepository

## Objetivo

Introduzir uma abstração explícita de persistência do ledger comportamental.

## Arquitetura

```text
ExecutionService
        │
        ├──► MessageGateway
        ├──► Clock
        └──► BehaviorActionLedgerRepository
                 ├──► PostgresBehaviorActionLedgerRepository
                 └──► InMemoryBehaviorActionLedgerRepository
```

## Escopo

Incluído:

- interface do repositório
- adapter PostgreSQL
- adapter em memória
- integração com `ExecutionService`
- integração com `RetryService`
- testes do repositório em memória
- documentação e ADR

Excluído:

- `Event Store`
- `Inbound`
- `Recovery`
- projeções de painel

## Estado

- ledger do domínio desacoplado do módulo de DB
- testes continuam verdes
- próximo passo natural: `Inbound` ou `Event Store`, sem reabrir o núcleo
