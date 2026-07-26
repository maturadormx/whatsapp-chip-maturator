# ADRs

Os `Architecture Decision Records` ficam em `docs/adr/`.

## Convenção oficial da baseline 2.0

A baseline arquitetural 2.0 adota a convenção:

```text
0001-...
0002-...
0003-...
```

sem prefixo textual adicional no nome do arquivo.

## Legado

Arquivos antigos no formato `ADR-00x-...` permanecem nesta pasta como histórico legado do projeto. Eles não definem a convenção oficial nova; apenas preservam o rastro de decisões anteriores à baseline 2.0 congelada.

## Série oficial atual

- `0001-execution-service.md`
- `0002-message-gateway.md`
- `0003-mock-gateway.md`
- `0004-clock.md`
- `0005-ledger-repository.md`
- `0006-mutable-clock-separation.md`
- `0007-capability-vs-behavior.md`
- `0008-pr11-ledger-repository.md`
- `0009-mock-gateway-script.md`
- `0010-persist-observation-before-fact.md`
- `0011-execution-plan-from-fact.md`
- `0012-sprint-b-scheduler-and-retry.md`
- `0013-sql-observation-runtime.md`

## Política

ADRs nunca são apagados. Apenas substituídos com `Superseded` quando uma decisão deixar de ser vigente.
