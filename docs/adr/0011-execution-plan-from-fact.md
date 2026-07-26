# 0011 ExecutionPlan derivado de Fact

## Status

Aceito

## Decisão

`Fact` não aciona diretamente regras ou efeitos. Primeiro ele é consumido por `ExecutionServicePort`, que produz um `ExecutionPlan`.

## Consequências

Positivas:

- separa derivação de intenção da execução concreta
- evita acoplamento prematuro entre `Fact` e serviços externos
- mantém o pipeline extensível para `RuleEngine` e `LoggerPort` no futuro

Negativas:

- adiciona uma camada intermediária (`ExecutionPlan`)

## Escopo desta rodada

- `ExecutionPlan`
- `ExecutionPlanFactory`
- `ExecutionServicePort`
- `DefaultExecutionService`

Sem incluir ainda:

- `RuleEngine`
- `LoggerPort`
- execução real de side-effects

