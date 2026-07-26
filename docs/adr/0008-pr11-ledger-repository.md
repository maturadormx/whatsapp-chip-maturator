# 0008 PR11 Ledger Repository

## Status

Aceito

## Decisão

O `PR #11` consolida a introdução operacional do `BehaviorActionLedgerRepository` como adapter de persistência do ledger.

## Consequência

A partir deste marco, persistência do ledger deixa de ser detalhe espalhado e passa a seguir o padrão `Contrato → Produção → Teste`.
