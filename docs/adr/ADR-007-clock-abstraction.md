# ADR-007: Clock Abstraction

## Status

Aceito

## Contexto

O núcleo ainda dependia implicitamente de `new Date()` e `Date.now()` para carimbar eventos e calcular tempos derivados, o que dificultava testes determinísticos.

## Decisão

Introduzir a interface de produção:

```ts
export interface Clock {
  now(): Date;
}
```

E a implementação de produção:

- `SystemClock`

Além disso, o `ExecutionService` passa a depender de `Clock` por injeção.

## Consequências

### Positivas

- tempo controlável em testes
- menor acoplamento ao relógio do sistema
- simetria com `MessageGateway`

### Negativas

- mais uma abstração no projeto
- necessidade de adapter/implementação concreta

## Alternativas rejeitadas

- usar `new Date()` diretamente no domínio
- usar utilitários globais estáticos

## Drivers

- testabilidade
- previsibilidade
- desacoplamento

## Trade-offs

- mais arquivos
- mais interfaces
- maior disciplina de injeção
