# ADR-004 — Identity Observability com Identity Snapshot Generator

## Status

Aceito

## Contexto

Depois do `Shadow Mode` e da camada de auditoria, a próxima evolução natural da arquitetura não é um `Identity Engine`.

Se o sistema introduzir cedo demais um engine de identidade, ele tende a acumular três responsabilidades ao mesmo tempo:

- inferir
- aprender
- decidir

Essa combinação aumentaria o risco arquitetural justamente quando a camada ainda precisa ser observável e auditável.

O que o sistema precisa nesta fase é uma fotografia explicável da identidade observada naquele momento, baseada na memória disponível, sem qualquer efeito colateral.

## Decisão

Nesta etapa, a identidade passa a ser representada por:

```text
Behavior Memory
      ↓
Identity Snapshot Generator
      ↓
Identity Snapshot (read-only)
```

O componente introduzido agora é um `Identity Snapshot Generator`.

Ele não aprende sozinho, não persiste regras de decisão e não influencia engines.

Seu papel é responder:

`se eu tivesse que descrever este chip agora, com base na memória disponível, quem ele parece ser?`

## Princípios

### Não existe `Identity Engine` nesta sprint

O objeto gerado é `IdentitySnapshot`, não `Identity`.

Ele é somente leitura e existe apenas para observação.

### A identidade é contínua, não categórica

O sistema não deve forçar rótulos fechados como `extrovertido`, `reservado` ou `social`.

A representação interna deve permanecer em dimensões contínuas de `0..1`.

Dimensões mínimas:

- `communicationStyle`
- `activityRhythm`
- `socialExposure`
- `initiativeProfile`
- `responsiveness`
- `diversity`
- `predictability`

### Toda dimensão deve ser explicável

Cada dimensão precisa expor:

- `value`
- `confidence`
- `supportingEpisodes`
- `contradictingEpisodes`

O snapshot não apenas conclui. Ele explica por que concluiu e também onde existem conflitos.

### Maturidade da identidade é diferente da maturidade do chip

Além de `confidence`, `stability` e `coverage`, a identidade precisa expor:

- `maturity`
- `drift`

`maturity` responde se já há evidência suficiente para considerar essa leitura estável.

`drift` responde o quanto a fotografia atual divergiu do snapshot anterior.

## Estrutura mínima

Cada `IdentitySnapshot` deve expor pelo menos:

- `generatedAt`
- `confidence`
- `stability`
- `evidenceCoverage`
- `maturity`
- `drift`
- `dimensions`
- `supportingEpisodes`
- `contradictingEpisodes`
- `pipelineVersions`
- `gating`

## Gates

Enquanto os critérios abaixo não forem atendidos, a identidade deve permanecer estritamente em modo observável:

- `Coverage > 70%`
- `Confidence > 0.85`
- `Stability > 0.80`
- `Maturity > 0.75`
- `Drift < 0.15`

Antes disso:

- `Identity = READ ONLY`

## Consequências

O sistema passa a conseguir responder, para qualquer dimensão inferida:

1. quais episódios sustentam essa conclusão
2. quais episódios a contradizem
3. qual o nível de confiança
4. qual a estabilidade da leitura
5. qual a maturidade da identidade
6. qual o drift desde o snapshot anterior

Só depois disso a arquitetura pode evoluir com segurança para:

```text
Identity Snapshot
      ↓
Strategy Engine
      ↓
Behavior Planner
      ↓
Behavior Engine
```

O `Strategy Engine`, e não o `Behavior Engine`, deve ser o próximo consumidor legítimo da identidade quando a camada observável estiver madura.
