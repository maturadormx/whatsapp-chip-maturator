# 0012 Sprint B — Scheduler e Retry

## Status

Aceito

## Decisão

O Sprint B introduz dois mecanismos operacionais simples:

- `Scheduler` baseado em intervalo fixo
- `RetryExecutionServiceDecorator` em torno de `ExecutionServicePort`

Além disso, `ObservationRepository` passa a controlar pendência/processamento para evitar reprocessamento infinito.

## Consequências

Positivas:

- observações pendentes podem ser reprocessadas sem reabrir o HTTP
- falhas transitórias na execução têm retentativa controlada
- scheduler usa o mesmo pipeline e o mesmo estado do runtime

Negativas:

- scheduler ainda é local ao processo
- estado ainda é em memória

