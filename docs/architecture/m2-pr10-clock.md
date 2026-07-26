# PR #10 — Clock

## Objetivo

Completar o conjunto de abstrações fundamentais do núcleo com uma abstração de tempo previsível e testável.

## Arquitetura

```text
ExecutionService
        │
        ├──► MessageGateway
        └──► Clock
                ├──► SystemClock
                └──► FakeClock (via TestClock)
```

## Decisões principais

- `Clock` de produção contém apenas `now()`
- `TestClock` estende `Clock` com:
  - `advanceBy()`
  - `set()`
  - `reset()`
- o núcleo conhece apenas `Clock`

## Escopo do PR

Incluído:

- contratos `Clock` e `TestClock`
- implementações `SystemClock` e `FakeClock`
- injeção de `Clock` no `ExecutionService`
- testes unitários do clock
- integração com cálculo de `nextRetryAt`
- checklist de arquitetura
- ADRs do clock

Excluído:

- `LedgerRepository`
- `Inbound`
- `Recovery`
- `Event Store`

## Estado

- base verde
- mock do gateway refinado para fila determinística
- `Clock` padronizado como abstração fundamental
