# D1 — SQL Runtime para Observation

## Capacidades entregues

- `MysqlObservationRepository`
- `MysqlEventStore`
- seleção `memory/mysql` por ambiente
- endpoint `/ready`
- testes de integração opcionais guardados por flag

## Variáveis de ambiente

- `OBSERVATION_RUNTIME_DRIVER=memory|mysql`
- `OBSERVATION_SCHEDULER_ENABLED=true|false`
- `OBSERVATION_SCHEDULER_INTERVAL_MS`
- `OBSERVATION_SCHEDULER_BATCH_SIZE`

## Regras principais

- `save()` faz upsert da `Observation`
- `claimPending()` reclama registros `PENDING` ou `FAILED`
- `completeProcessing()` fecha sucesso ou falha
- `EventStore.append()` aceita `expectedVersion`

## Observação

O default continua `memory` para manter a suíte padrão independente de banco local.
