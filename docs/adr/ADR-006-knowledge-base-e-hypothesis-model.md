# ADR-006 — Knowledge Base e Hypothesis Model

## Status

Aceito

## Contexto

O `Learning Engine` precisa de um destino arquitetural claro para publicar o que aprende. Sem uma fronteira formal, hipóteses temporárias, observações locais e conhecimento reutilizável tendem a virar o mesmo tipo de objeto, o que contamina a camada estratégica.

O sistema também já definiu dois princípios relevantes:

- aprendizado não pode executar comportamento
- estratégia futura só deve consumir leitura consolidada, nunca evidência crua

Por isso, a plataforma precisa distinguir com precisão:

- o que ainda é hipótese
- o que já virou conhecimento consolidado
- quem pode ler
- quem pode escrever

## Decisão

São introduzidos dois conceitos formais:

- `Hypothesis Model`
- `Knowledge Base`

O `Hypothesis Model` representa afirmações ainda sujeitas a validação, revalidação, contradição e expiração.

A `Knowledge Base` representa apenas conhecimento reutilizável já promovido a partir de hipóteses suficientemente validadas.

## Regras de acesso

A `Knowledge Base` será:

- somente leitura para `Strategy Engine`
- somente escrita pelo `Learning Engine`

Nenhum outro componente pode escrever diretamente em `Knowledge Base`.

Em especial:

- `Behavior Engine` não escreve
- `Behavior Planner` não escreve
- `Identity Snapshot Generator` não escreve
- operadores humanos não escrevem conhecimento consolidado por atalho operacional

## Diferença entre hipótese e conhecimento

### `Hypothesis`

Uma hipótese é uma afirmação observável e testável sobre comportamento, credibilidade, risco ou contexto, ainda sujeita a contradição.

Ela existe para responder:

`isso parece ser verdade, mas já foi validado o suficiente para orientar estratégia futura?`

### `Knowledge`

Conhecimento é uma hipótese promovida, já validada em janelas e segmentos suficientes para ser reutilizada com segurança arquitetural controlada.

Ele existe para responder:

`isso já demonstrou estabilidade suficiente para orientar estratégia declarativa futura?`

## Fronteira conceitual

O `Hypothesis Model` é mutável por natureza. Ele registra aprendizado em curso, inclusive incerteza.

A `Knowledge Base` é mais estável. Ela deve conter apenas objetos promovidos, versionados e revalidáveis, com rastreabilidade até a hipótese de origem.

O desenho mínimo fica assim:

```text
Fleet Observations
        ↓
Learning Engine
        ↓
Hypothesis Store
        ↓
promotion / expiration / contradiction review
        ↓
Knowledge Base
        ↓
Strategy Engine (read-only)
```

## Estrutura mínima do objeto `Hypothesis`

Toda hipótese deve conter pelo menos:

- `id`
- `type`
- `title`
- `statement`
- `scope`
- `status`
- `confidence`
- `sampleSize`
- `riskImpact`
- `successRate`
- `lastValidatedAt`
- `expirationPolicy`

Estrutura complementar recomendada:

- `createdAt`
- `updatedAt`
- `createdFromObservationWindow`
- `segmentKey`
- `validationCount`
- `contradictionCount`
- `supportingSignals`
- `contradictingSignals`
- `sourceLearningBatchId`
- `version`

## Estrutura mínima do objeto `Knowledge`

Todo item da `Knowledge Base` deve conter pelo menos:

- `id`
- `hypothesisId`
- `type`
- `title`
- `statement`
- `scope`
- `confidence`
- `sampleSize`
- `riskImpact`
- `successRate`
- `lastValidatedAt`
- `expirationPolicy`

Estrutura complementar recomendada:

- `promotedAt`
- `knowledgeVersion`
- `revalidationWindow`
- `stabilityScore`
- `decayRate`
- `confidenceTrend`
- `usageCount`
- `applicability`
- `knownLimits`
- `contradictionTriggers`
- `fallbackRecommendation`

## Significado mínimo dos campos obrigatórios

### `confidence`

Representa o grau consolidado de confiança naquele enunciado, já ajustado por repetição, contradição e estabilidade temporal.

### `sampleSize`

Representa o volume mínimo de observações relevantes usadas para formular ou validar aquele item.

### `riskImpact`

Representa o impacto esperado sobre risco operacional caso o padrão seja seguido ou observado. Não mede apenas sucesso aparente; mede custo potencial.

### `successRate`

Representa a taxa de ocorrência bem-sucedida do resultado esperado dentro do escopo declarado.

### `lastValidatedAt`

Representa o momento da última validação efetiva. Sem recência, uma hipótese ou conhecimento pode estar correto historicamente, mas inadequado para o cenário atual.

### `expirationPolicy`

Representa a política de expiração ou revalidação obrigatória. Conhecimento não é permanente por padrão.

## Estados esperados do `Hypothesis Model`

Estados mínimos:

- `draft`
- `testing`
- `validated`
- `contradicted`
- `expired`
- `promoted`
- `archived`

Regras gerais:

- `draft` ainda não teve validação suficiente
- `testing` está em ciclo ativo de observação
- `validated` atingiu limiar mínimo, mas ainda não virou conhecimento
- `contradicted` recebeu evidência relevante contra sua formulação
- `expired` perdeu recência ou contexto
- `promoted` originou um item da `Knowledge Base`
- `archived` deixou de ter utilidade operacional

## Regras da `Knowledge Base`

### Somente conhecimento promovido entra

A `Knowledge Base` não é repositório de opinião nem catálogo de experimentos. Ela armazena somente itens promovidos a partir do ciclo formal do `Learning Engine`.

### Conhecimento continua revogável

Promover não significa eternizar. Todo conhecimento precisa prever:

- revalidação periódica
- gatilhos de expiração
- gatilhos de contradição
- limitação de escopo
- taxa de decaimento explícita
- tendência recente de confiança
- contador de uso para diferenciar conhecimento vivo de conhecimento fóssil

### Estratégia não consulta hipótese bruta

O `Strategy Engine` não deve depender de `Hypothesis` em aberto. Sua leitura autorizada é a `Knowledge Base`, justamente para separar especulação de base estratégica.

## Expiração e recência

Toda peça de conhecimento precisa declarar como envelhece. Políticas mínimas esperadas:

- expiração por tempo
- expiração por mudança de contexto
- expiração por drift de comportamento agregado
- expiração por contradição recorrente

Sem política de expiração, a base tende a acumular regras fossilizadas.

## Exemplos conceituais

### Hipótese

```json
{
  "type": "risk_pattern",
  "statement": "crescimento abrupto com baixa diversidade eleva risco operacional antecipado",
  "confidence": 0.71,
  "sampleSize": 84,
  "riskImpact": 0.82,
  "successRate": 0.68,
  "lastValidatedAt": "2026-07-17T00:00:00.000Z",
  "expirationPolicy": "revalidate_in_14_days"
}
```

### Conhecimento promovido

```json
{
  "type": "credibility_rule",
  "statement": "crescimento gradual com diversidade crescente tende a sustentar credibilidade observada com menor risco",
  "confidence": 0.9,
  "sampleSize": 420,
  "riskImpact": 0.21,
  "successRate": 0.83,
  "lastValidatedAt": "2026-07-17T00:00:00.000Z",
  "expirationPolicy": "revalidate_in_30_days"
}
```

## Consequências

Com esse ADR, a plataforma passa a ter uma separação explícita entre aprendizado em curso e conhecimento reutilizável.

Isso protege a arquitetura de dois erros comuns:

- tratar correlação frágil como regra
- deixar a estratégia futura ler conhecimento não consolidado

O resultado é uma trilha mais segura:

```text
Learning Engine
      ↓
Hypothesis Model
      ↓
Knowledge Base
      ↓
Strategy Engine
```

O `Learning Engine` aprende. O `Hypothesis Model` registra incerteza. A `Knowledge Base` publica apenas o que sobreviveu ao ciclo de validação.
