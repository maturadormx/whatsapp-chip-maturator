# ADR-001 — Materialização do Estado Operacional

## Status

Aceito

## Contexto

Hoje a materialização do estado operacional (`chip_health`, `chip_behavior_scores` e `chip_certifications`) é disparada por procedures de leitura consumidas pela interface, como Dashboard, Mission Control, Certified Pool e Timeline Summary.

Esse desenho faz com que a camada de apresentação participe da atualização do domínio. A interface deixa de ser consumidora de estado e passa a influenciar sua materialização, invertendo a responsabilidade arquitetural.

O problema principal não é apenas técnico. Quando a leitura pública conhece detalhes de cálculo e persistência, qualquer evolução futura exige nova mudança na interface. Isso torna mais difícil migrar de recalcular agora para freshness window, snapshots materializados ou worker dedicado sem tocar novamente nos mesmos consumidores.

## Decisão

A materialização do estado operacional passa a ter um único responsável:

`OperationalMaterializationService`

Esse componente será o único ponto autorizado a executar operações de materialização, incluindo:

- `materializeFleet()`
- `materializeChip()`

A interface não poderá conhecer quem calcula, persiste ou atualiza o estado operacional. Para consumo externo, a única operação exposta será:

- `ensureFresh()`

A implementação interna dessa operação poderá evoluir sem alteração da interface pública. Entre as estratégias possíveis:

- recalcular imediatamente, como ocorre hoje
- respeitar uma janela de freshness
- utilizar snapshots materializados
- delegar integralmente a atualização para worker ou scheduler

## Princípios

A arquitetura passa a obedecer às seguintes responsabilidades.

### Evidence Engine

Responsável apenas por produzir fatos observáveis do sistema.

Produz:

- `sessions`
- `activity_logs`
- `behavior_timeline`

Nunca interpreta comportamento.

### Operational Engine

Responsável apenas por interpretar evidências.

Calcula:

- Human Score
- Risk Score
- Certification
- Operational Snapshot

Nunca decide ações.

### Operational Materialization Service

Responsável apenas por materializar e persistir o estado operacional.

Atualiza:

- `chip_health`
- `chip_behavior_scores`
- `chip_certifications`

Nunca produz evidências.

### Behavior Engine

Responsável apenas por decidir comportamento futuro a partir do estado já interpretado.

Não interpreta infraestrutura.

Não escreve evidências diretamente.

Não conhece Dashboard.

### Dashboard

Responsável apenas por consumir estado.

Nunca calcula.

Nunca persiste.

Nunca decide quando materializar.

## Segurança da migração

Toda alteração arquitetural deverá preservar integralmente a regra de negócio.

A regressão será protegida por `validate-operational`, cobrindo obrigatoriamente os estados:

- `NOVO`
- `EM_MATURACAO`
- `EM_OBSERVACAO`
- `APROVADO`
- `RESTRITO`
- `REPROVADO`

Nenhuma etapa da migração poderá alterar o comportamento esperado desses estados sem revisão explícita da regra.

## Consequências

O acoplamento entre leitura e atualização de domínio deixa de ser um detalhe acidental e passa a ser explicitamente proibido.

O Dashboard pode continuar chamando `ensureFresh()` durante a transição, mas deixa de ser o dono da materialização. A partir daí, a estratégia interna poderá mudar sem nova reescrita da interface.

## Objetivo final

A arquitetura convergirá para o seguinte fluxo:

```text
WhatsApp Runtime
        │
        ▼
Evidence Engine
        │
        ▼
Operational Engine
        │
        ▼
Operational Materialization Service
        │
        ▼
Materialized State
        │
        ▼
Dashboard / APIs (somente leitura)
```
