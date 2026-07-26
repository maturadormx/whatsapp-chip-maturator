# PR #9 — MockGateway

## Objetivo

Criar uma implementação concreta de `MessageGateway` para testes e desenvolvimento local, sem depender de infraestrutura externa.

## Escopo

Incluído:

- `MockMessageGateway`
- `MockConfig`
- fila determinística de resultados
- atraso configurável
- testes unitários do mock
- integração `ExecutionService -> MockMessageGateway`

Excluído:

- `Clock`
- `Inbound`
- `Recovery`
- `Event Store`
- painel

## Arquitetura

```text
ExecutionService
        │
        ▼
MessageGateway
        │
        ├── FakeMessageGateway
        ├── MockMessageGateway
        └── adapters concretos futuros
```

## Regras

- implementa `MessageGateway` fielmente
- não altera `ExecutionService`
- não altera `RetryService`
- não altera `BudgetReservationService`
- não altera `Ledger`

## Entregas

### Commit 1

- `MockConfig`
- `MockMessageGateway`
- barrel export do mock
- refinamento para `enqueueResult()` e fila explícita
- `reset()` restaurando o script inicial do cenário

### Commit 2

- testes unitários:
  - sucesso
  - falha em fila
  - timeout em fila
  - enqueue explícito
  - reset

### Commit 3

- integração `ExecutionService -> MockMessageGateway`

### Commit 4

- documentação desta fase

## Estado atual

- base verde
- mock pronto para desenvolvimento local
- mock sem taxas probabilísticas
- próximo passo natural: `Clock`
