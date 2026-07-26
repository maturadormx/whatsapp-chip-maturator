# ADR-003 — Shadow Mode da Pipeline de Evidências

## Status

Aceito

## Contexto

A arquitetura da pipeline de evidências já possui componentes suficientes para normalizar, catalogar e agrupar eventos em episódios. O próximo risco deixou de ser técnico e passou a ser de qualidade de dados.

Se o sistema começar a popular memória comportamental com regras ainda provisórias e imediatamente usar isso em decisões, a base histórica ficará contaminada. Isso tornará difícil explicar divergências futuras, ajustar agrupamentos e comparar versões do pipeline.

Antes de qualquer integração com `Identity Engine`, `Strategy Engine` ou `Behavior Engine`, o sistema precisa operar em modo observável e auditável.

## Decisão

A pipeline de evidências passa a ter uma fase obrigatória de `Shadow Mode`.

Nesse modo, o pipeline completo roda em paralelo ao fluxo atual:

```text
Raw Event
    ↓
Evidence Normalizer
    ↓
Evidence Catalog
    ↓
Episode Builder
    ↓
Behavior Memory Snapshot
```

Mas:

- não altera `Behavior Engine`
- não altera `Identity Engine`
- não altera `Operational Engine`
- não altera certificação
- não altera scores operacionais
- não altera qualquer regra de maturação ou comportamento do WhatsApp

O objetivo único é gerar snapshots auditáveis da pipeline de evidências.

## Princípios

### Nenhuma decisão consome Shadow Mode

Snapshots gerados em `Shadow Mode` existem apenas para observação e auditoria.

Nenhuma engine pode consumir esses snapshots como base para decisão enquanto o modo continuar classificado como shadow.

### Snapshots são imutáveis

`Behavior Memory Snapshot` é append-only.

Sempre:

- `INSERT`

Nunca:

- `UPDATE`

Cada snapshot representa um momento observável do pipeline.

### Toda evolução passa antes pelo Shadow Mode

Mudanças em:

- `normalizerVersion`
- `catalogVersion`
- `episodeBuilderVersion`
- `memoryVersion`

devem primeiro ser validadas em `Shadow Mode` antes de poder influenciar qualquer engine.

### Mudança de versão inicia nova série histórica

Qualquer mudança de versão deve preservar a rastreabilidade histórica anterior.

Ou seja, uma nova combinação de versões inicia automaticamente uma nova série de snapshots observáveis, sem reescrever a série anterior.

## Estrutura mínima do snapshot

Cada snapshot em `Shadow Mode` deve expor pelo menos:

- `createdAt`
- `windowStart`
- `windowEnd`
- `pipelineVersions`
  - `normalizerVersion`
  - `catalogVersion`
  - `episodeBuilderVersion`
  - `memoryVersion`
- `pipelineCounters`
  - `rawEvents`
  - `normalizedEvents`
  - `catalogedEvents`
  - `episodes`
- `averageConfidence`
- `minimumConfidence`
- `evidenceCoverage`
- `episodeSummaries`

## Auditoria mínima

O sistema deve conseguir responder, para qualquer chip:

1. o que aconteceu em eventos brutos
2. como isso foi normalizado
3. como isso foi catalogado
4. como isso foi agrupado em episódios
5. qual snapshot registrou esse resultado

Um endpoint interno de inspeção deve expor essa trilha ponta a ponta para validação humana.

## Gates automáticos de auditoria

Além da inspeção humana, o `Shadow Mode` deve expor gates automáticos para detectar distorções do pipeline antes de qualquer uso decisório.

Leituras mínimas:

- `duplicationRate`
- `compressionRatio`
- `orphanRate`
- distribuição de `episodeConfidence`
- `minimumConfidence`

Esses gates não alteram comportamento. Eles apenas classificam o snapshot como:

- `healthy`
- `attention`
- `critical`

Exemplos de sinais que devem gerar alerta:

- eventos demais passando quase intactos para episódios
- compressão excessiva ou compressão insuficiente
- eventos normalizados que nunca entram em episódio
- concentração alta de episódios com confiança baixa
- episódio isolado com `minimumConfidence` muito baixo

## Consequências

O sucesso da sprint de `Shadow Mode` deixa de ser medido por “mais inteligência” e passa a ser medido por observabilidade:

- snapshots reproduzíveis
- auditoria ponta a ponta
- rastreabilidade por versão
- confiança visível
- cobertura visível

Só depois dessa etapa o projeto pode evoluir com segurança para `Identity Snapshot` em modo somente leitura e, numa fase posterior, para qualquer influência comportamental.
