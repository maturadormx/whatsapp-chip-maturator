# Processo de Release — Fase 1

## Sequência obrigatória

```text
PR #7
  ↓
Review
  ↓
Merge
  ↓
CI verde
  ↓
DoD validado
  ↓
Tag m2-fase-1
  ↓
Baseline congelada
```

## Comando da tag

```bash
git tag -a m2-fase-1 -m "Fase 1: Núcleo Operacional (Retry + Budget) — Validado e congelado."
git push origin m2-fase-1
```

## Regra de ouro

A tag deve representar um estado reproduzível do repositório. Ela não pode ser criada sobre alterações não commitadas ou antes de merge e CI verde.

## Resultado esperado

Após a tag:

- Fase 1 encerrada
- núcleo operacional congelado
- Fase 2 liberada para `MessageGateway`, `MockGateway` e `Clock`
