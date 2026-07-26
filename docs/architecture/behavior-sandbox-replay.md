# Behavior Sandbox e Replay

O objetivo desta camada é validar mudanças no pipeline sem depender de produção e sem executar comportamento real.

## Escopo

- reexecutar eventos brutos offline
- comparar snapshots entre versões do pipeline
- medir determinismo
- manter datasets dourados e sintéticos
- simular oportunidades sem execução

## Fronteiras

- `behaviorSandboxService` consome apenas contratos puros do pipeline
- replay nunca escreve snapshot no banco
- sandbox nunca chama `whatsappService`
- simulação de oportunidade usa apenas `simulateBehaviorPlan()`

## Fluxo

```text
Dataset bruto
    │
    ▼
Replay
    │
    ├── snapshot estável
    ├── diff contra baseline
    ├── explainability
    └── simulação de oportunidade
```

## Artefatos

- `datasets/golden/`
- `datasets/synthetic/`
- `scripts/validate-behavior-sandbox.ts`
- `scripts/run-behavior-replay.ts`
- `scripts/generate-synthetic-behavior-dataset.ts`

## Comandos

- `pnpm validate:sandbox`
- `pnpm replay:dataset -- dataset=datasets/golden/chip-natural.json`
- `pnpm generate:synthetic-dataset`
