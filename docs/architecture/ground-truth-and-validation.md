# Ground Truth e validação observacional

Esta camada existe para confrontar hipótese com resultado real antes de qualquer automação de decisão.

## Ground Truth

Tabela base:

- `behavior_outcomes`

Campos centrais:

- `predictedRisk`
- `predictedCredibility`
- `actualOutcome`
- `restrictionOccurred`
- `warningOccurred`
- `banOccurred`
- `humanLikeOutcome`
- `validatedAt`

Sem isso o sistema aprende apenas sobre as próprias hipóteses.

## Opportunity Cost observável

Tabela base:

- `behavior_opportunity_observations`

Campos centrais:

- `opportunityId`
- `reason`
- `riskAtDecision`
- `confidence`
- `expectedGain`
- `expectedRisk`
- `decision`
- `observedResultAfter24h`
- `observedResultAfter72h`
- `observedResultAfter7d`

O objetivo é medir o custo de decidir `DO_NOTHING`, não apenas registrar ausência de ação.

## Leituras derivadas

- `confidenceCalibration` por componente
- `evidenceGap`
- `unknownState`
- `antiPatternLearning`
- `pipelineDrift`
- `decisionDebt`
- `riskBudget`
- `credibilityBudget`

## Princípios

- nenhuma dessas métricas decide comportamento automaticamente
- `UNKNOWN` é um estado válido e preferível a classificação forçada
- budgets são observacionais, não autorização de execução
- qualquer mecanismo futuro só pode consumir essas leituras depois de histórico suficiente
