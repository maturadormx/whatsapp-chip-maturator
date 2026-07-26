# Data Retention Policy

## Objetivo

Esta política define como cada camada observacional envelhece para impedir crescimento indefinido do banco e preservar somente o que continua útil para auditoria, identidade e aprendizado.

## Princípio

Nem toda evidência merece a mesma permanência. Quanto mais crua e volumosa a informação, mais curta deve ser sua retenção. Quanto mais consolidado e reutilizável o conhecimento, mais longa pode ser sua vida útil.

## Retenção por camada

| Camada | Retenção | Motivo |
| --- | --- | --- |
| `raw events` | 30 dias | Auditoria recente e debugging operacional |
| `normalized evidence` | 60 dias | Reprocessamento curto e validação do normalizador |
| `episodes` | 180 dias | Base histórica suficiente para identidade e comparação |
| `identity snapshots` | 365 dias | Leitura de trajetória anual e drift |
| `knowledge` | indefinido | Conhecimento consolidado continua útil enquanto for revalidado |

## Regras obrigatórias

- Toda política de purge deve respeitar a hierarquia `Evidence -> Episode -> Identity Snapshot -> Knowledge`.
- Nada pode apagar `Knowledge` por idade simples sem antes verificar `lastValidatedAt`, `decayRate` e sinais de contradição.
- Retenção longa não autoriza uso decisório. Persistência existe para auditoria, revalidação e rastreabilidade.

## Consequências

Com essa política, a arquitetura ganha limite explícito de crescimento e evita transformar a camada observacional em depósito infinito de ruído histórico.
