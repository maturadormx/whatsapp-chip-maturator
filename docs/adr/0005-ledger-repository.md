# 0005 Ledger Repository

## Status

Aceito

## Decisão

A persistência do ledger comportamental passa por `BehaviorActionLedgerRepository`.

## Consequência

`ExecutionService` e `RetryService` deixam de depender de funções soltas de banco e passam a depender de um contrato de persistência.
