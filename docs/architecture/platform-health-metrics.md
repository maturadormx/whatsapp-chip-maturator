# Métricas de saúde da plataforma

## Objetivo

Além dos dashboards operacionais, a plataforma passa a reconhecer a saúde da própria arquitetura. A ideia é descobrir rapidamente onde um problema nasceu antes de culpar o runtime inteiro.

## Camadas mínimas

As leituras mínimas da plataforma são:

| Métrica | O que mede |
| --- | --- |
| `Pipeline Health` | saúde da pipeline de evidências e snapshots |
| `Identity Health` | confiança, estabilidade e drift da identidade |
| `Learning Health` | qualidade do ciclo de hipóteses e validação |
| `Knowledge Health` | recência, uso e decaimento do conhecimento |
| `Strategy Health` | coerência, explicabilidade e segurança dos planos |

## Leituras obrigatórias

Cada health deve conseguir responder pelo menos:

- qual versão gerou a leitura
- qual janela foi analisada
- qual a confiança da própria leitura
- quais warnings impedem consumo decisório

## Relação com o envelope padrão

Toda leitura pública nova deve poder caber no envelope:

```json
{
  "version": 1,
  "generatedAt": "2026-07-17T15:00:00.000Z",
  "confidence": 0.86,
  "quality": 0.81,
  "warnings": [],
  "metadata": {},
  "payload": {}
}
```

## Consequências

Com essa camada, a observabilidade deixa de dizer apenas que algo está ruim. Ela começa a apontar se o problema nasceu na evidência, na identidade, no aprendizado, no conhecimento ou na estratégia.
