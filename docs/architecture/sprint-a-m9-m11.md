# Sprint A — M9 + M10 + M11

## Capacidades entregues

- M9: observabilidade estruturada via `LoggerPort`
- M10: decisão automática via `RuleEngine`
- M11: histórico mínimo via `EventStore`

## Estrutura adotada

```text
Observation
→ save(observation)
→ append(ObservationSaved)
→ FactFactory
→ append(FactGenerated)
→ RuleEngine.evaluate(fact)
→ ExecutionPlanFactory.fromFact(fact, actions)
→ ExecutionService.execute(plan)
```

## Decisões desta rodada

- `LoggerPort` fica no pipeline, não espalhado em `console.log`
- `RuleEngine` começa simples, com uma regra crítica
- `EventStore` grava eventos tipados, não objetos crus
- `ExecutionPlan` passa a conter `actions`, não um `noop` fixo

## O que o sistema faz agora

- registra logs estruturados do pipeline
- gera ações automáticas para `Fact` crítico
- persiste histórico mínimo de `Observation` e `Fact` no `EventStore`
