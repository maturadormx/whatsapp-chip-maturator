# Política de Baseline — m2-fase-1

## Objetivo

Definir o que a tag `m2-fase-1` representa e quais regras valem após sua criação.

## O que a tag representa

- baseline estável da Fase 1
- ponto de rollback
- núcleo operacional validado
- ponto de partida formal para a Fase 2

## Regras

- a tag só pode ser criada após merge e CI verde
- a tag deve apontar para um commit reproduzível
- a tag não deve ser criada sobre trabalho não commitado
- a Fase 2 não pode começar sem essa baseline

## Rollback

Se a Fase 2 introduzir regressões, a baseline `m2-fase-1` deve permitir retorno imediato ao estado estável do núcleo operacional.

## Componentes congelados após a tag

- `ExecutionService`
- `RetryService`
- `BudgetReservationService`
- `Execution Ledger`
- `BudgetReservation Ledger`
- `Retry Policy`
- `Attempt`

## Exceções permitidas

- bug crítico
- segurança
- performance comprovada

Toda exceção exige novo PR de correção com validação equivalente.
