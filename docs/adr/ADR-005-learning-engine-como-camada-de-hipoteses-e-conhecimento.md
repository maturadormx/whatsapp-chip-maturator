# ADR-005 — Learning Engine como camada de hipóteses e conhecimento

## Status

Aceito

## Contexto

Depois de fechar a pipeline de evidências em `Shadow Mode` e introduzir `Identity Snapshot` como leitura observável, a arquitetura passa a ter memória suficiente para começar a aprender com o comportamento da frota. Mas esse aprendizado não pode nascer como motor de decisão.

Se o mesmo componente observar, aprender, decidir e executar, o sistema perde separação causal. Fica difícil distinguir:

- o que foi observado
- o que foi inferido
- o que virou hipótese
- o que já pode ser tratado como conhecimento reutilizável
- o que de fato influenciou comportamento

O projeto também já redefiniu seu objetivo central: maximizar credibilidade digital enquanto minimiza exposição a risco. Para isso, o sistema precisa aprender com padrões da frota sem transformar observação estatística em comando operacional prematuro.

## Decisão

É introduzido um novo componente arquitetural chamado `Learning Engine`.

Seu papel é transformar observações agregadas da frota em:

- `Hypothesis`
- `Knowledge`
- relatórios de validação

Ele existe como camada de aprendizado estatístico do próprio sistema, não como IA generativa, não como LLM e não como motor de execução.

## Papel do componente

O `Learning Engine` responde à pergunta:

`o que a frota parece ensinar, de forma reutilizável, sobre credibilidade, risco e comportamento?`

Sua função é:

- detectar padrões recorrentes entre chips, janelas e contextos
- formular hipóteses testáveis
- acompanhar validação temporal dessas hipóteses
- promover apenas hipóteses suficientemente validadas para `Knowledge`
- manter rastreabilidade entre observação, hipótese e conhecimento

## Limites rígidos

O `Learning Engine` não pode:

- executar ações
- enviar mensagens
- alterar `Identity Snapshot`
- recalcular identidade
- alterar `Behavior Engine`
- influenciar diretamente o `Behavior Engine`
- escrever em `Knowledge Base` por outro caminho que não seja seu pipeline formal de validação
- consumir evidência bruta para decidir ação em tempo real

Ele pode apenas observar, sintetizar e publicar saídas declarativas para uso futuro.

## Posição na arquitetura

O desenho alvo passa a ter a seguinte camada adicional:

```text
Behavior Memory Snapshot
        ↓
Identity Snapshot
        ↓
Learning Engine
        ↓
Hypothesis / Knowledge Base
        ↓
Strategy Engine (futuro)
```

Nesta fase, porém, a integração é apenas conceitual. O ADR não autoriza acoplamento de runtime com o restante do sistema.

## Entradas

O `Learning Engine` deve consumir apenas leituras já interpretadas e observáveis. Entradas mínimas esperadas:

- `Behavior Memory Snapshots`
- `Identity Snapshots`
- leituras agregadas de `Pipeline Health`
- leituras agregadas de `Risk Model` quando esse componente existir
- outcomes operacionais consolidados por janela
- contexto de segmento da frota, como fase, perfil, janela temporal e nível de maturidade observada

Essas entradas devem ser tratadas como dados de leitura, nunca como autorização para atuar sobre um chip específico.

## Saídas

O `Learning Engine` deve publicar apenas objetos declarativos:

- `Hypothesis`
- `Knowledge`
- `HypothesisValidationReport`
- `LearningBatchSummary`

Nenhuma dessas saídas é comando operacional. Nenhuma saída executa comportamento.

## Ciclo de validação de hipóteses

Toda hipótese deve passar por um ciclo explícito e auditável.

### 1. Observação

O sistema agrega leituras da frota e identifica regularidades ou contradições relevantes.

Exemplos:

- padrões de risco que antecedem restrição
- combinações de sinais associadas a estabilidade
- sequências que parecem aumentar ou reduzir credibilidade observada

### 2. Formulação

Uma regularidade observada vira `Hypothesis` com formulação testável, escopo e condição de falsificação.

Exemplo conceitual:

`chips com crescimento abrupto e baixa diversidade tendem a elevar risco operacional antes de apresentar restrição`

### 3. Segmentação

A hipótese precisa declarar a que contexto ela se aplica:

- tipo de chip
- estágio de maturação
- janela temporal
- perfil de atividade
- contexto de risco

Sem escopo, a hipótese não pode ser reutilizada.

### 4. Validação

O sistema compara a hipótese com novas observações, coortes e janelas temporais independentes da observação original.

Toda validação deve medir pelo menos:

- `confidence`
- `sampleSize`
- `successRate`
- `riskImpact`
- estabilidade temporal
- taxa de contradição

### 5. Revalidação

Mesmo hipóteses bem-sucedidas precisam ser revalidadas em novas janelas. Conhecimento sem recência tende a virar dogma histórico.

### 6. Promoção ou descarte

Ao final do ciclo, a hipótese pode:

- permanecer como `draft`
- virar `validated`
- ser promovida para `knowledge`
- expirar
- ser arquivada como contradita

## Critérios de promoção de `Hypothesis` para `Knowledge`

Uma hipótese só pode ser promovida quando atender simultaneamente a critérios mínimos de robustez. A promoção não deve ser manual nem baseada em narrativa convincente.

Critérios mínimos:

- `sampleSize` acima do limiar mínimo definido para o tipo de hipótese
- `confidence` acima do limiar de promoção
- `successRate` estável em mais de uma janela
- baixo nível de contradição entre segmentos equivalentes
- `riskImpact` conhecido e aceitável
- `lastValidatedAt` recente o suficiente para o contexto operacional
- repetibilidade observada em coortes independentes

Promover cedo demais contamina a `Knowledge Base` com correlações frágeis. Promover tarde demais reduz a capacidade adaptativa do sistema. Por isso, a promoção precisa ser baseada em critérios explícitos, nunca em impressão humana isolada.

## Métricas de confiança

O `Learning Engine` deve tratar confiança como composição, não como número arbitrário. Leituras mínimas:

- `observationConfidence`: qualidade das observações que originaram a hipótese
- `statisticalConfidence`: robustez inferencial da hipótese
- `temporalStability`: consistência da hipótese em janelas diferentes
- `segmentConsistency`: consistência em coortes comparáveis
- `contradictionPenalty`: desconto aplicado quando sinais fortes contradizem a hipótese
- `finalConfidence`: valor consolidado usado para estado e promoção

`confidence` não representa certeza absoluta. Representa o quanto a hipótese continua útil diante do volume, da repetição e da contradição observados.

## Explicabilidade obrigatória

Toda hipótese e todo conhecimento consolidado devem ser explicáveis. O sistema deve conseguir responder:

1. quais observações originaram essa hipótese
2. em quais segmentos ela parece válida
3. quais janelas a confirmaram
4. quais janelas a contradisseram
5. qual o risco de usá-la como base estratégica
6. quando ela foi validada pela última vez

Sem essa trilha, o `Learning Engine` vira caixa-preta e perde valor arquitetural.

## Consequências

Com esse ADR, a arquitetura passa a separar explicitamente quatro camadas que antes tenderiam a se misturar:

- observação
- identidade observável
- aprendizado
- estratégia

Isso prepara o terreno para uma evolução segura:

```text
Evidence / Memory / Identity
          ↓
Learning Engine
          ↓
Knowledge Base
          ↓
Strategy Engine
          ↓
Behavior Planner
```

O ganho desta decisão não é automação imediata. O ganho é criar uma camada capaz de aprender com a frota sem sequestrar, cedo demais, a lógica decisória do sistema.
