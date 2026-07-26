# Sprint B — M12 + M13

## Capacidades entregues

- M12: `Scheduler` com `ProcessPendingObservationsUseCase`
- M13: retry simples sobre `ExecutionServicePort`

## Estrutura adotada

```text
IntervalScheduler
→ ProcessPendingObservationsUseCase
→ ObservationPipeline
→ RetryExecutionServiceDecorator
→ DefaultExecutionService
```

## Correção importante

`ObservationRepository` agora distingue:

- observation pendente
- observation processada

Isso evita o reprocessamento infinito do mesmo registro pelo scheduler.

## O que o sistema faz agora

- processa HTTP no pipeline compartilhado do runtime
- reprocessa observações pendentes por agendamento
- retenta falhas transitórias da execução antes de falhar em definitivo
