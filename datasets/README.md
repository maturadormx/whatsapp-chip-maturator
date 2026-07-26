# Datasets de validação

Esta pasta concentra os datasets usados para replay, diff e regressão do pipeline comportamental.

## Estrutura

- `golden/`: cenários estáveis usados em toda alteração de normalização, catalogação, episódios e identidade.
- `synthetic/`: cenários gerados artificialmente para explorar combinações e bordas sem tocar produção.

## Formato

Cada arquivo JSON deve seguir a estrutura:

```json
{
  "datasetId": "chip-natural",
  "description": "descrição curta",
  "replayedAt": "2026-07-17T12:00:00.000Z",
  "rawEvents": []
}
```

## Uso

- `pnpm validate:sandbox`
- `pnpm replay:dataset -- datasets/golden/chip-natural.json`
- `pnpm generate:synthetic-dataset -- profile=alta-atividade`
