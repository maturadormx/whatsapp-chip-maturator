# Fluxos Arquiteturais

## Ontologia Principal

> O fluxo abaixo representa o caso completo. Existem variantes simplificadas.

```text
Observation
↓
Fact
↓
[Policy]
↓
Decision
↓
Application Service
↓
Effect (quando existir)
```

| Etapa | Definição canônica | Exemplo |
|---|---|---|
| `Observation` | Informação percebida pelo sistema antes de qualquer interpretação pelo domínio | HTTP request, evento do bus, comando, cron tick |
| `Fact` | Observação imutável, validada, tipada e semanticamente significativa. Estável durante toda a execução da Policy | `CurrentTimeFact`, `MessageAcknowledgedFact` |
| `[Policy]` | Função pura que transforma `1..N Facts` em `1 Decision`. Pode ser omitida em fluxos simples | `RetryPolicy.shouldRetry(...)` |
| `Decision` | Descrição de intenção. Nunca produz efeito. Pode ser simples ou composta | `RetryDecision`, `MonitoringDecision` |
| `Application Service` | Coordena a execução de um caso de uso utilizando Policies e Capabilities | `ExecutionService.execute(...)` |
| `Effect` | Interação com uma Capability cujo resultado pode modificar o mundo externo. Pode ter sucesso, falha ou timeout | gravar banco, emitir log, chamar API |

> `Result` é o valor retornado pelo `Application Service`, não uma etapa arquitetural. Pode conter dados, indicadores de sucesso, falha ou ambos.

## Policy opcional

Alguns fluxos não requerem avaliação de regras de negócio e, portanto, podem omitir `Policy`.

Exemplos:

- importador de configuração
- parser
- projeção
- consulta simples

## Fluxo com estado

> Aplicável quando existe máquina de estado de domínio.

```text
Observation
↓
Fact
↓
[Policy]
↓
Decision
↓
State Machine
↓
Application Service
↓
Effect (quando existir)
```

## Fluxo command

```text
Command
↓
Validation
↓
Decision
↓
Application Service
↓
Effect (quando existir)
```

## Fluxos futuros

- saga flow
- compensation flow
- event replay flow
- recovery flow
