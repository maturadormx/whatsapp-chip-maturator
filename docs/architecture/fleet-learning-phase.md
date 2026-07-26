# Fleet Learning Phase

## Objetivo

Abrir a próxima camada do sistema: aprender com a frota inteira, e não apenas com a trajetória isolada de um chip.

O fluxo desejado é:

```text
chip
  ↓
snapshot validado
  ↓
adaptive learning
  ↓
fleet learning
  ↓
knowledge promotion
```

## Princípios

- `Fleet Learning` não lê `raw events` diretamente.
- A entrada permitida da frota é a projeção compacta derivada de:
  - `observability`
  - `validation`
  - `longitudinal`
  - `adaptiveIntelligence`
- O domínio de frota continua observacional.
- Nenhuma estratégia é executada a partir daqui.
- Promoção de conhecimento da frota deve alimentar a `Knowledge Base` existente, e não criar uma base paralela.

## Componentes do domínio

### `Fleet Learning Projection`

Cada chip vira uma projeção comportamental compacta contendo:

- idade do chip
- modo dominante de exposição
- bucket de risco
- taxa de sucesso
- taxa de contradição
- credibilidade observada
- confiança/trust level
- diversidade
- exposição social
- previsibilidade
- base de conhecimento ativa/decadente

### `Fleet Cohorts`

As coortes são agrupamentos observacionais por:

- estágio de idade do chip
- modo dominante de exposição
- bucket de risco

Exemplo:

`primeiros_dias + exposicao_passiva + baixo_risco`

### `Fleet Patterns`

Padrões da frota são hipóteses agregadas por coorte.

Exemplos:

- contas nos primeiros dias amadurecem melhor com exposição passiva
- coortes sob maior pressão operacional pedem redução de previsibilidade
- diversidade comportamental acompanha melhor crescimento de credibilidade

### `Fleet Knowledge Promotion`

Quando um padrão de frota alcança amostra e confiança suficientes, ele gera:

- promoção auditável
- chave de conhecimento prefixada por `fleet:`
- reuso dentro da `Knowledge Base viva`

## Contratos persistidos

- `fleet_learning_cohorts`
- `fleet_learning_patterns`
- `fleet_knowledge_promotions`

## Resultado esperado

Permitir afirmações do tipo:

> 200 chips mostraram que contas com este perfil amadurecem melhor usando exposição passiva durante os primeiros dias.

Esse é o primeiro passo para o sistema deixar de apenas observar maturação individual e começar a aprender padrões confiáveis de população.
