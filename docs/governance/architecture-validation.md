# Validação Arquitetural da Fase 1

## Propósito

Este guia descreve o que a validação integrada da Fase 1 deve provar.

## Fluxo validado

```text
Policy
  ↓
ExecutionService
  ↓
Execution Ledger
  ↓
RetryService
  ↓
BudgetReservationService
  ↓
Ledger final consumível pelo painel
```

## Cenários obrigatórios

1. Envio com sucesso
2. Falha operacional com release de budget
3. Retry após falha
4. Budget insuficiente antes da reserva
5. Idempotência operacional por `executionId + attempt`

## Invariantes obrigatórias

- nenhuma reserva órfã
- ledger consistente
- `executionId` único por execução
- `attempt` monotônico
- budget final correto
- nenhuma duplicidade de envio

## Evidência atual

Teste automatizado:

- `server/services/behavior/phase1OperationalIntegration.test.ts`

Artefato de fechamento:

- `fase1-validacao-operacional.txt`

## Regra de uso

Este documento é obrigatório para revisar o PR de validação da Fase 1.
