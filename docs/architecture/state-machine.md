# Máquina de Estados da Execução

## Fluxo principal

```text
PENDING
  ↓ reserveBudget
RESERVED
  ↓ send
SENDING
  ├── ACKED
  │     ↓ commitBudget
  │   COMMITTED
  └── FAILED
        ↓ releaseBudget
      RELEASED
        ↓ if recoverable
      RETRYING
        ↓ nextRetryAt
      SENDING
```

## Regras de transição

| De | Para | Condição | Ação |
|---|---|---|---|
| `PENDING` | `RESERVED` | budget disponível | `reserveBudget()` |
| `RESERVED` | `SENDING` | tentativa iniciada | `sendMessage()` |
| `SENDING` | `ACKED` | envio concluído | `commitBudget()` |
| `SENDING` | `FAILED` | erro operacional | `releaseBudget()` |
| `FAILED` | `RETRYING` | execução recuperável | agendar próximo retry |
| `RETRYING` | `SENDING` | `now >= nextRetryAt` | nova tentativa |

## Estados terminais dentro da Fase 1

- `ACKED` com budget `COMMITTED`
- `FAILED` com budget `RELEASED` e sem retry restante

## Observação

Esta máquina de estados descreve o núcleo operacional interno validado na Fase 1. Ela não inclui ainda ACK real de gateway nem eventos de inbound, que pertencem às fases seguintes.

## Validação integrada PR #7

O arquivo `tests/integration/m2-fase1-e2e.test.ts` percorre esta máquina em cinco cenários:

- happy path
- falha com `RELEASED`
- retry com novo `attempt`
- budget insuficiente sem reserva
- idempotência sem duplicação de envio

Isso transforma a máquina acima em comportamento verificável, não apenas descritivo.
