# 0013 SQL runtime para Observation

## Status

Aceito

## Decisão

O runtime de `Observation` passa a suportar um modo SQL real usando o stack já existente do projeto:

- `Drizzle`
- `mysql2`
- `DATABASE_URL`

Sem introduzir Prisma ou um framework paralelo.

## Consequências

Positivas:

- persistência real para `Observation`
- `EventStore` com controle de versão por stream
- `Scheduler` e `Inbound` podem compartilhar estado durável

Negativas:

- operação depende de configuração por ambiente
- integrações com banco passam a exigir migrations/ensure das tabelas específicas

