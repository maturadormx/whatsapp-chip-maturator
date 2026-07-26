# Pipeline Health Dashboard para Shadow Mode

## Objetivo

O `Pipeline Health Dashboard` consolida, em uma única leitura, a saúde observável da pipeline de evidências em `Shadow Mode`.

Ele não implementa interface, não altera decisão e não substitui o inspector detalhado por chip. Seu papel é definir contrato, payload e leituras mínimas para auditoria humana e automação de gates.

## Escopo

O dashboard deve consolidar pelo menos:

- `duplicationRate`
- `compressionRatio`
- `orphanRate`
- `evidenceCoverage`
- `evidenceQuality`
- `evidenceStability`
- `averageConfidence`
- `minimumConfidence`
- `pipelineVersions`
- `pipelineHealthScore`
- `healthStatus`

## Princípios

### Observabilidade antes de decisão

O dashboard existe para dizer se a pipeline está saudável o suficiente para ser confiável como camada observável. Ele não autoriza consumo decisório por si só.

### Uma visão consolidada, sem apagar detalhe

O dashboard resume a saúde da pipeline, mas precisa preservar links semânticos para drill-down por chip, por janela e por versão.

### Métricas podem nascer antes da implementação final

Como `evidenceQuality` e `evidenceStability` ainda estão em evolução, o contrato deve aceitar métricas temporariamente `null`, desde que a indisponibilidade fique explícita.

## Níveis de leitura

O contrato deve prever pelo menos três níveis:

1. `fleet overview`
2. `per-chip health`
3. `version window`

### Fleet overview

Resume a saúde global da janela analisada.

### Per-chip health

Expõe saúde individual de cada chip dentro da mesma janela.

### Version window

Permite comparar saúde por combinação de:

- `normalizerVersion`
- `catalogVersion`
- `episodeBuilderVersion`
- `memoryVersion`

## Contrato proposto

Endpoint conceitual:

`GET /api/internal/pipeline-health`

Parâmetros esperados:

- `windowHours`
- `chipIds[]` opcional
- `includeChips=true|false`
- `includeAlerts=true|false`

## Payload

```json
{
  "generatedAt": "2026-07-17T15:00:00.000Z",
  "window": {
    "start": "2026-07-15T15:00:00.000Z",
    "end": "2026-07-17T15:00:00.000Z",
    "hours": 48
  },
  "pipelineVersions": {
    "normalizerVersion": 1,
    "catalogVersion": 1,
    "episodeBuilderVersion": 1,
    "memoryVersion": 1
  },
  "summary": {
    "chipCount": 30,
    "snapshotCount": 30,
    "pipelineHealthScore": 95,
    "healthStatus": "attention",
    "duplicationRate": 0.08,
    "compressionRatio": 0.42,
    "orphanRate": 0.05,
    "evidenceCoverage": 74,
    "evidenceQuality": 76,
    "evidenceStability": 0.81,
    "averageConfidence": 0.86,
    "minimumConfidence": 0.61
  },
  "alerts": [
    {
      "metric": "minimumConfidence",
      "status": "warn",
      "message": "3 chips com confiança mínima abaixo do limiar desejado",
      "affectedChips": [4, 8, 19]
    }
  ],
  "chips": [
    {
      "chipId": 4,
      "pipelineHealthScore": 92,
      "healthStatus": "healthy",
      "duplicationRate": 0.03,
      "compressionRatio": 0.47,
      "orphanRate": 0.02,
      "evidenceCoverage": 81,
      "evidenceQuality": 79,
      "evidenceStability": 0.85,
      "averageConfidence": 0.9,
      "minimumConfidence": 0.7,
      "pipelineVersions": {
        "normalizerVersion": 1,
        "catalogVersion": 1,
        "episodeBuilderVersion": 1,
        "memoryVersion": 1
      }
    }
  ]
}
```

## Definição das métricas

### `duplicationRate`

Percentual de evidências ou episódios redundantes em relação ao volume observado na janela.

Interpretação:

- alto demais sugere que a pipeline está preservando ruído em vez de informação
- baixo demais não é necessariamente bom se vier acompanhado de compressão excessiva

### `compressionRatio`

Razão entre eventos de entrada e episódios ou estruturas resumidas de saída.

Interpretação:

- compressão baixa demais sugere pouca síntese
- compressão alta demais sugere perda de nuance

### `orphanRate`

Percentual de evidências normalizadas ou catalogadas que não conseguiram entrar em episódio coerente.

Interpretação:

- indica lacuna de modelagem no `Episode Builder`
- cresce quando a taxonomia de episódios não acompanha o comportamento observado

### `evidenceCoverage`

Leitura do quanto a janela observada cobre o comportamento do chip nas dimensões mínimas já definidas pela arquitetura.

### `evidenceQuality`

Leitura agregada da qualidade da evidência humana produzida, baseada nas dimensões previstas:

- `Naturalness`
- `Diversity`
- `Consistency`
- `Social Presence`

Enquanto a implementação completa não existir, o campo pode ser `null`, mas o dashboard deve expor claramente que a métrica está pendente.

### `evidenceStability`

Leitura da consistência da pipeline e das evidências ao longo do tempo, evitando oscilações bruscas entre janelas próximas.

Leitura esperada:

- alta estabilidade indica repetibilidade saudável da interpretação
- estabilidade muito baixa sugere fragilidade inferencial ou drift do pipeline

### `averageConfidence`

Média de confiança das evidências ou episódios consolidados na janela.

### `minimumConfidence`

Pior confiança registrada na janela. Essa métrica existe para evitar que médias confortáveis escondam pontos frágeis.

### `pipelineVersions`

Combinação exata de versões que gerou aquela leitura. Essa informação é obrigatória para rastreabilidade e comparação histórica.

### `pipelineHealthScore`

Score sintético de 0 a 100 derivado de:

- `evidenceCoverage`
- `averageConfidence`
- `minimumConfidence`
- `duplicationRate`
- `compressionRatio`
- `orphanRate`
- `evidenceStability`

O score existe para leitura rápida. Ele nunca substitui o detalhamento das métricas componentes.

### `healthStatus`

Classificação sintética da saúde da pipeline. Valores mínimos:

- `healthy`
- `attention`
- `critical`

## Regra de composição do `healthStatus`

O status global deve ser derivado por pior caso ponderado, nunca por média simples.

Princípio:

- uma métrica crítica relevante deve conseguir degradar o status final
- uma única média alta não pode mascarar `minimumConfidence` ruim, alto `orphanRate` ou instabilidade severa

Ordem sugerida:

1. avaliar gates críticos
2. avaliar gates de atenção
3. consolidar status final

## Gates sugeridos

Os limiares exatos podem evoluir, mas o contrato deve prever classificação por métrica:

- `duplicationRate`: `ok | warn | critical`
- `compressionRatio`: `ok | warn | critical`
- `orphanRate`: `ok | warn | critical`
- `evidenceCoverage`: `ok | warn | critical`
- `evidenceQuality`: `ok | warn | critical | unavailable`
- `evidenceStability`: `ok | warn | critical | unavailable`
- `averageConfidence`: `ok | warn | critical`
- `minimumConfidence`: `ok | warn | critical`

## Semântica operacional

### `healthy`

A pipeline está suficientemente estável e rastreável para continuar como base observável confiável.

### `attention`

Existem sinais de degradação ou inconsistência que ainda não invalidam a leitura inteira, mas exigem investigação.

### `critical`

A janela ou a versão atual apresenta distorção suficiente para tornar a leitura arquiteturalmente insegura.

## Drill-down mínimo

Mesmo sem interface implementada, o contrato deve prever que cada alerta consiga apontar para:

- `chipId`
- janela temporal
- métrica afetada
- versão da pipeline
- snapshot ou conjunto de snapshots relacionados

## Casos de uso principais

O dashboard deve servir pelo menos para:

1. validar regressão após mudança em versão da pipeline
2. comparar saúde entre janelas de 24h, 48h e 7 dias
3. identificar chips com pipeline aparentemente saudável, mas baixa confiança mínima
4. detectar distorção sistêmica versus problema localizado

## Limites

Este documento não especifica:

- layout visual da interface
- componentes React
- persistência nova
- alterações no runtime de `Shadow Mode`

Ele define somente o contrato de leitura consolidada.

## Consequências

Com esse contrato, a plataforma passa a ter uma visão única da saúde da pipeline, sem abandonar a rastreabilidade por versão e por chip.

Isso facilita a próxima fase de validação porque tira a saúde da pipeline do campo impressionista e leva para um payload explícito, comparável e auditável.
