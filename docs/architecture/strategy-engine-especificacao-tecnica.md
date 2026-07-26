# Strategy Engine — especificação técnica

## Objetivo

O `Strategy Engine` é o componente responsável por transformar identidade observada e conhecimento consolidado em um `Strategic Plan` declarativo.

Ele não executa comportamento, não monta sequência operacional detalhada e não acessa evidência crua. Seu papel é formular direção estratégica de curto e médio prazo para ser consumida depois pelo `Behavior Planner`.

## Papel na arquitetura

A posição alvo do componente é:

```text
Identity Snapshot
      ↓
Knowledge Base
      ↓
Strategy Engine
      ↓
Strategic Plan
      ↓
Behavior Planner
      ↓
Behavior Engine
```

## Responsabilidades

O `Strategy Engine` deve:

- consumir `Identity Snapshot`
- consumir `Knowledge Base`
- interpretar tendência dominante do chip naquele momento
- selecionar objetivos estratégicos compatíveis com a identidade observada
- modular exposição, ritmo, iniciativa e diversidade em forma declarativa
- publicar um `Strategic Plan` explicável

## Não responsabilidades

O `Strategy Engine` não pode:

- acessar `behavior_timeline`
- acessar evidências brutas
- acessar eventos do WhatsApp
- montar roteiro tático detalhado
- decidir mensagem, mídia, timing exato ou canal exato
- executar ação
- alterar `Identity Snapshot`
- escrever em `Knowledge Base`

## Entradas autorizadas

Entradas obrigatórias:

- `IdentitySnapshot`
- `Knowledge Base`

Entradas opcionais futuras, somente se explicitamente autorizadas por ADR posterior:

- `Risk Snapshot`
- contexto operacional agregado

Nesta especificação, apenas `IdentitySnapshot` e `Knowledge Base` são permitidos.

## Proibição explícita

O `Strategy Engine` não poderá acessar:

- `behavior_timeline`
- `activity_logs`
- `sessions`
- eventos do provedor
- snapshots não promovidos da camada de hipótese

Essa fronteira existe para impedir que a camada estratégica vire um segundo engine de inferência disfarçado.

## Premissa central

O `Strategy Engine` não responde:

`o que fazer agora?`

Ele responde:

`qual inclinação estratégica deve orientar o comportamento do chip nesta janela?`

Exemplos:

- reduzir exposição temporariamente
- aumentar diversidade de presença
- priorizar resposta em vez de iniciação
- socializar mais, mas com baixa intensidade
- preservar ritmo atual porque a trajetória parece saudável

## Estrutura da decisão

O componente deve combinar dois vetores:

### `Identity Snapshot`

Diz quem o chip parece ser agora.

### `Knowledge Base`

Diz o que o sistema já aprendeu, com validação suficiente, sobre combinações de sinais, risco e credibilidade.

O `Strategy Engine` cruza os dois vetores para gerar direção, não ação.

## Processo conceitual

```text
1. Ler identidade observada
2. Filtrar conhecimento aplicável ao escopo do chip
3. Avaliar tensões estratégicas
4. Escolher direção dominante e direções secundárias
5. Publicar Strategic Plan declarativo
```

## Tensões estratégicas mínimas

O componente deve considerar pelo menos as seguintes tensões:

- exposição versus resguardo
- iniciativa versus responsividade
- diversidade versus consistência
- expansão versus estabilidade
- presença ativa versus presença passiva

O papel da estratégia é modular essas tensões sem transformar identidade em rigidez.

## Contrato de entrada

### `IdentitySnapshot`

Campos mínimos relevantes:

- `confidence`
- `stability`
- `maturity`
- `drift`
- `dimensions`
- `gating`

### `Knowledge Base`

Campos mínimos relevantes por item:

- `type`
- `scope`
- `confidence`
- `riskImpact`
- `successRate`
- `lastValidatedAt`
- `expirationPolicy`

## Pré-condições

O `Strategy Engine` só deve produzir plano estratégico quando a entrada cumprir critérios mínimos de confiabilidade.

Pré-condições sugeridas:

- `IdentitySnapshot.gating.readyForStrategy = true`
- existência de conhecimento válido, não expirado, dentro do escopo aplicável

Se essas pré-condições falharem, o componente deve produzir um plano conservador explícito, nunca improvisar agressivamente.

## Saída

A saída obrigatória do componente é um `StrategicPlan`.

Esse plano deve ser declarativo, legível e explicável.

## Estrutura mínima do `StrategicPlan`

```json
{
  "generatedAt": "2026-07-17T15:00:00.000Z",
  "windowHours": 24,
  "strategyVersion": 1,
  "planStatus": "active",
  "identityReference": {
    "generatedAt": "2026-07-17T14:30:00.000Z",
    "confidence": 0.89,
    "maturity": 0.81
  },
  "knowledgeReferences": [
    {
      "knowledgeId": "kb-credibility-013",
      "confidence": 0.91,
      "riskImpact": 0.22
    }
  ],
  "directives": {
    "exposureMode": "reduced",
    "initiativeMode": "responsive",
    "diversityMode": "increase_gradually",
    "rhythmMode": "stable",
    "socialMode": "observe_more_than_expand"
  },
  "guardrails": {
    "maxExposureDelta": 0.1,
    "avoidPatternRepetition": true,
    "preferPassiveSignals": true
  },
  "confidence": 0.84,
  "explanation": {
    "summary": "identidade madura com boa estabilidade recomenda continuidade conservadora e aumento gradual de diversidade",
    "appliedKnowledgeIds": ["kb-credibility-013"],
    "dominantTensions": [
      "diversidade baixa com estabilidade saudável",
      "bom nível de responsividade"
    ]
  }
}
```

## Campos mínimos do `StrategicPlan`

- `generatedAt`
- `windowHours`
- `strategyVersion`
- `planStatus`
- `identityReference`
- `knowledgeReferences`
- `directives`
- `guardrails`
- `confidence`
- `explanation`

## Diretivas mínimas

O plano deve expressar direção em dimensões estratégicas, não em tarefas de execução. Leituras mínimas:

- `exposureMode`
- `initiativeMode`
- `diversityMode`
- `rhythmMode`
- `socialMode`

Essas diretivas são suficientes para o `Behavior Planner` traduzir orientação em oportunidade, timing e formato depois.

## Guardrails mínimos

O plano também deve transportar limites de segurança. Leituras mínimas:

- limite de mudança abrupta de exposição
- bloqueio de repetição excessiva
- preferência por presença passiva quando necessário
- tolerância de expansão por janela

## Estados do plano

Valores mínimos:

- `active`
- `conservative`
- `insufficient_signal`
- `expired`

### `active`

Há identidade madura e conhecimento aplicável para orientar a janela.

### `conservative`

O sistema possui alguma base, mas a melhor direção é proteger credibilidade antes de ampliar comportamento.

### `insufficient_signal`

As entradas ainda não sustentam uma direção estratégica confiável.

### `expired`

O plano perdeu validade temporal e precisa ser regenerado.

## Regras de explicabilidade

Para qualquer plano, o sistema deve conseguir dizer:

1. qual snapshot de identidade serviu de base
2. quais itens da `Knowledge Base` foram aplicados
3. quais tensões estratégicas dominaram a decisão
4. quais guardrails foram impostos
5. por que o plano ficou mais agressivo ou mais conservador

## Relação com o `Behavior Planner`

O `Behavior Planner` é consumidor do `Strategic Plan`, não sua fonte.

Separação obrigatória:

- `Strategy Engine` escolhe direção
- `Behavior Planner` escolhe oportunidades e forma de agir

Sem essa separação, estratégia e tática voltam a se misturar.

## Relação com o `Learning Engine`

O `Strategy Engine` não aprende. Ele consome conhecimento já consolidado.

O `Learning Engine` não produz planos. Ele produz hipóteses e conhecimento.

## Casos de falha

O componente deve falhar de maneira segura quando:

- não houver `IdentitySnapshot` maduro
- o snapshot estiver com `drift` excessivo
- não houver conhecimento válido no escopo
- a base disponível for contraditória demais

Nesses casos, a saída deve ser conservadora e explícita, nunca silenciosa.

## Limites

Esta especificação não define:

- código
- algoritmo final de priorização
- persistência do plano
- interface gráfica
- integração de runtime

## Consequências

Com esse componente especificado, a arquitetura finalmente separa:

- observação
- aprendizado
- estratégia
- planejamento
- execução

Isso é o que impede a plataforma de continuar presa a fluxo fixo. O sistema passa a ter um lugar próprio para formular direção estratégica sem tocar em evidência crua e sem pular direto para ação.
