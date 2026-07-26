# ADR-008: Separação entre Clock e TestClock

## Status

Aceito

## Contexto

Uma primeira proposta fazia o contrato de produção expor métodos de teste, como `advanceBy()` e `reset()`. Isso vazava API de teste para o domínio.

## Decisão

Separar:

```ts
export interface Clock {
  now(): Date;
}

export interface TestClock extends Clock {
  advanceBy(ms: number): void;
  set(date: Date): void;
  reset(): void;
}
```

Hierarquia final:

- `SystemClock -> Clock`
- `FakeClock -> TestClock -> Clock`

## Consequências

### Positivas

- o núcleo conhece apenas a API mínima de produção
- métodos de teste não vazam para serviços de domínio
- testes ficam mais explícitos e determinísticos

### Negativas

- pequena duplicação conceitual entre contratos de produção e teste

## Alternativas rejeitadas

- `Clock` único com `advanceBy()` e `reset()`

## Drivers

- isolamento do domínio
- testabilidade sem vazamento
- previsibilidade da API

## Trade-offs

- mais tipos
- maior rigor arquitetural
