# Risk Model operacional

## Objetivo

O `Risk Model` mede probabilidade de restrição antes que a restrição aconteça.

Ele não substitui certificação, não altera as regras atuais e não executa nenhuma ação. Seu papel é produzir leitura antecipada de risco operacional baseada em sinais comportamentais e contextuais do chip.

## Problema que o modelo resolve

O cenário recente do WhatsApp reduz a utilidade de regras simples como:

- volume fixo de mensagens
- delays aleatórios sobre roteiro rígido
- thresholds estáticos isolados

O risco passou a depender mais de combinação de sinais do que de um único gatilho. Um chip pode ser restringido cedo por parecer automatizado mesmo sem grande volume. Por isso, o sistema precisa de um modelo que antecipe probabilidade de restrição com base em padrões observáveis.

## Princípios

### Independente da certificação

O `Risk Model` é um motor paralelo à certificação atual.

Ele:

- não altera score de certificação
- não reescreve regras existentes
- não muda bloqueios atuais
- não substitui o `Human Score`

Seu valor inicial é observabilidade preditiva.

### Leitura probabilística, não binária

O modelo deve operar em probabilidades e dimensões contínuas, não em rótulos fechados como `seguro` ou `arriscado`.

### Leading indicator

O modelo deve priorizar sinais que antecedem restrição, não apenas sinais que já representam dano consumado.

## Entradas mínimas

O `Risk Model` deve consumir leituras derivadas, nunca inferir comportamento diretamente de eventos crus para decisão imediata.

Entradas mínimas:

- exposição do chip
- frequência de ações
- padrões repetitivos
- velocidade de crescimento
- estabilidade de comportamento
- sinais passivos

Entradas complementares recomendadas:

- `Behavior Memory Snapshots`
- `Identity Snapshot`
- `Evidence Coverage`
- `Evidence Quality`
- `Evidence Stability`
- resultados históricos de restrição, aquecimento, pausa e recuperação

## Dimensões do modelo

### `connectionRisk`

Mede fragilidade de conexão, oscilação de sessão e comportamento que parece sustentado por instabilidade operacional em vez de presença humana contínua.

### `spamRisk`

Mede intensidade de emissão, repetição de contato e padrões que se aproximam de leitura de spam mesmo antes de uma restrição explícita.

### `behaviorRisk`

Mede repetição excessiva de sequência, horário, formato, canal ou desfecho.

Exemplos:

- mesma ordem de ações em dias consecutivos
- janelas de ativação com pouca variação
- mesma proporção entre iniciar, responder e observar

### `reputationRisk`

Mede sinais de desgaste reputacional do chip ao longo do tempo, considerando contradições entre presença, reciprocidade, diversidade social e coerência histórica.

### `timingRisk`

Mede o quanto o momento da ação parece incompatível com o contexto observado.

Exemplos:

- explosões ativas após longos silêncios
- resposta em janelas improváveis para a identidade observada
- crescimento rápido demais dentro de pouco tempo

### `socialExposureRisk`

Mede superfície de contato, visibilidade e expansão social observável.

Exemplos de leitura:

- muitos contatos novos em janela curta
- salto abrupto em grupos ou interações
- aumento rápido de visibilidade social sem histórico compatível

## Saída do modelo

O `Risk Model` deve publicar um `Risk Snapshot` declarativo.

Estrutura mínima sugerida:

```json
{
  "generatedAt": "2026-07-17T15:00:00.000Z",
  "windowHours": 48,
  "overallRisk": 0.63,
  "confidence": 0.82,
  "status": "attention",
  "dimensions": {
    "connectionRisk": 0.41,
    "spamRisk": 0.58,
    "behaviorRisk": 0.74,
    "reputationRisk": 0.52,
    "timingRisk": 0.66,
    "socialExposureRisk": 0.61
  },
  "leadingSignals": [
    "crescimento acima da coorte",
    "baixa diversidade em sequência repetida"
  ],
  "contradictingSignals": [
    "boa estabilidade nas últimas 3 janelas"
  ]
}
```

## Interpretação da saída

Campos mínimos:

- `overallRisk`: probabilidade consolidada de restrição antecipada
- `confidence`: confiança da leitura de risco
- `status`: classificação sintética
- `dimensions`: decomposição por eixo
- `leadingSignals`: sinais que puxam o risco para cima
- `contradictingSignals`: sinais que seguram ou contradizem a leitura

## Estados sintéticos

Valores mínimos:

- `healthy`
- `attention`
- `critical`

### `healthy`

O conjunto de sinais indica exposição operacional controlada.

### `attention`

Há sinais antecedentes relevantes, mas ainda não conclusivos.

### `critical`

O padrão observado se aproxima de trajetórias historicamente sensíveis ou restritivas.

## Arquitetura sugerida

O modelo deve ser composto por camadas separadas:

```text
Derived Observations
        ↓
Feature Builder
        ↓
Risk Dimension Evaluators
        ↓
Risk Aggregator
        ↓
Risk Snapshot
```

### `Feature Builder`

Responsável por transformar leituras observáveis em variáveis comparáveis ao longo do tempo e entre coortes.

### `Risk Dimension Evaluators`

Responsáveis por calcular cada dimensão de risco de forma independente, sem colapsar cedo demais um problema de conexão, timing ou reputação em um único número opaco.

### `Risk Aggregator`

Responsável por compor a leitura final sem apagar a decomposição dimensional.

## Regras obrigatórias

### O modelo não executa mitigação

O `Risk Model` não pausa, não rebaixa, não bloqueia e não modifica comportamento.

### O modelo não usa certificação como entrada principal

Ele deve medir risco operacional por sinais próprios, não herdar julgamento do score existente.

### O modelo precisa ser explicável

Para qualquer leitura de risco, o sistema deve conseguir dizer:

1. quais dimensões puxaram o risco para cima
2. quais sinais seguraram a leitura
3. qual janela foi analisada
4. qual a confiança da inferência
5. qual a versão do modelo

## Métricas de qualidade do próprio modelo

Como o `Risk Model` também é inferencial, ele precisa ser observado. Leituras mínimas do próprio modelo:

- precisão preditiva contra restrições futuras observadas
- taxa de falso positivo
- taxa de falso negativo
- estabilidade temporal
- cobertura por segmento
- confiança média das predições

## Relação com outros componentes

### `Operational Engine`

Continua responsável pelas regras correntes e certificação atual.

### `Learning Engine`

Pode usar snapshots de risco como uma das entradas de aprendizado futuro, mas não deve reescrever o modelo de risco por acoplamento implícito.

### `Strategy Engine`

No futuro, poderá consumir leitura de risco apenas se essa fronteira for explicitamente autorizada. Este documento não autoriza essa integração.

## Limites

Este documento não define:

- algoritmo estatístico específico
- pesos finais de agregação
- tabelas novas
- alteração em score atual
- gatilhos automáticos de mitigação

## Consequências

Com esse componente, a plataforma ganha uma leitura preditiva independente da certificação, orientada a antecipar restrição em vez de apenas explicar dano depois que ele aconteceu.

Isso reforça a direção arquitetural mais importante da fase atual: sair de thresholds isolados e caminhar para interpretação probabilística, observável e explicável do risco operacional.
