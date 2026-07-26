# Implementações do Projeto

## Contrato → Produção → Teste

| Contrato | Produção | Teste |
|---|---|---|
| `Clock` | `SystemClock` | `FakeClock` |
| `MessageGateway` | adapter legado de WhatsApp | `MockMessageGateway` |
| `BehaviorActionLedgerRepository` | `PostgresBehaviorActionLedgerRepository` | `InMemoryBehaviorActionLedgerRepository` |

## Hierarquia de Clock

```text
Clock
├── SystemClock
└── MutableClock
    ├── FakeClock
    ├── ReplayClock
    ├── SimulationClock
    └── FrozenClock
```

## MockMessageGateway — script determinístico

```ts
const script = [
  failed({ occurredAt, error }),
  timeout({ occurredAt }),
  acked({ occurredAt, messageId }),
];

const gateway = new MockMessageGateway({ initialResults: script });
```

Propriedade: `reset()` restaura o script inicial.

## GatewayResult — DSL

```ts
acked({ occurredAt, messageId });
failed({ occurredAt, error });
timeout({ occurredAt });
```

## RetryPolicy — função pura

```ts
shouldRetry({ attempt, elapsed, deadline });
```

## State Machine — padrão aplicável

```ts
const nextState = stateMachine.transition(currentState, event);
executionService.applyTransition(nextState);
```

## Regras derivadas

| Regra | Origem |
|---|---|
| Nunca importar adapters no domínio | `Dependency Inversion` |
| Nunca instanciar implementações de infraestrutura no domínio | `Dependency Inversion` |
| Nunca usar singleton global | `Dependency Inversion` |
| Todo adapter possui contrato | `Simetria` |
| Testes usam script, não taxas | `Determinismo` |
