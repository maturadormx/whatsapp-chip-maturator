# Governança do Marco 2 — Fase 1

Projeto: `whatsapp-chip-maturator`  
Data: `2026-07-20`

## Finalidade

Este documento formaliza o gate de encerramento da Fase 1 do Marco 2. Ele é normativo para o fechamento do núcleo operacional e define quando a Fase 2 pode ser iniciada.

## Escopo normativo

As regras abaixo são obrigatórias:

- O PR de validação da Fase 1 existe apenas para validação e sincronização documental.
- Nenhum PR da Fase 2 pode começar antes da baseline `m2-fase-1`.
- A baseline só pode existir após:
  - `merge`
  - CI verde
  - DoD da Fase 1 verificado
  - documentação sincronizada
- Toda mudança estrutural posterior no núcleo congelado exige novo PR de validação.

## Sequência obrigatória

```text
PR #7 (validação exclusiva)
    ↓
Review aprovado
    ↓
Merge para main
    ↓
CI verde
    ↓
DoD validado
    ↓
Tag m2-fase-1
    ↓
Baseline congelada
    ↓
Fase 2 liberada
```

## O que o PR #7 pode conter

Permitido:

- `tests/`
- `docs/`
- `CHANGELOG.md`
- `RELEASE-NOTES.md`
- pequenas correções descobertas pela validação integrada

Não permitido:

- refactors
- abstrações novas
- otimizações
- evolução de infraestrutura
- mudanças estruturais fora do escopo da validação

## Gate de regressão documental

Se algum comportamento público mudou, deve existir atualização correspondente em pelo menos um dos documentos abaixo:

- `docs/architecture/invariants.md`
- `docs/architecture/state-machine.md`
- `matriz-rastreabilidade-marco2.txt`
- `CHANGELOG.md`
- `RELEASE-NOTES.md`

## Política de congelamento

Após a baseline `m2-fase-1`, os componentes abaixo ficam congelados estruturalmente:

- `ExecutionService`
- `RetryService`
- `BudgetReservationService`
- `Execution Ledger`
- `Budget Reservation Ledger`
- `Retry Policy`
- `Attempt`

Componentes que continuam evolutivos após a tag:

- `Gateway`
- `Mock/Fake Gateway`
- `Clock`
- `Inbound`
- `Event Store`
- `Recovery`
- observabilidade posterior

## Resultado esperado

Ao final da Fase 1, a seguinte afirmação precisa ser verdadeira:

> Uma execução pode falhar, ser retomada, consumir orçamento corretamente e terminar em um estado consistente e auditável.

## Situação atual

Status da Fase 1 no repositório:

- núcleo operacional: validado
- documentação de governança: sincronizada
- baseline: pronta para criação após merge e CI do branch final
- Fase 2: bloqueada até a tag `m2-fase-1`
