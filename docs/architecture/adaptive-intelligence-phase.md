# Adaptive Intelligence Phase

Esta fase transforma a plataforma de observação em uma base real de aprendizado adaptativo, ainda sem ligar decisão automática ao runtime.

## Objetivo

Criar um domínio de aprendizado que faça:

```text
evento
  ↓
experiência
  ↓
hipótese
  ↓
confirmação
  ↓
conhecimento
  ↓
aposentadoria
```

## Componentes do domínio

### `Learning Hypotheses`

Hipóteses observacionais com:

- `confidence`
- `sampleSize`
- `successRate`
- `contradictionRate`
- `temporalStability`
- `segmentConsistency`

### `Knowledge Base Items`

Conhecimento vivo derivado de hipóteses validadas, com:

- decaimento
- revalidação
- aposentadoria
- arquivamento

### `Learning Engine Events`

Trilha auditável de:

- `observed`
- `validated`
- `promoted`
- `revalidated`
- `retired`
- `contradicted`

### `Experience Ranking`

Ranqueamento real de experiências por distância comportamental e desirability, não por ordem de inserção.

### `Confidence Calibration REAL`

Calibração por componente:

- `normalizer`
- `catalog`
- `episode`
- `identity`
- `planner`

## Princípios

- o domínio de aprendizado não executa comportamento
- conhecimento só nasce de hipótese auditável
- conhecimento pode envelhecer e morrer
- similaridade é baseada em comportamento e contexto, não em ID
- toda promoção para conhecimento depende de confiança, amostra e estabilidade mínimas
