# M3 — Inbound HTTP MVP

## Objetivo

Introduzir a camada mínima de entrada HTTP para eventos externos, sem acoplar regra de negócio ao endpoint.

## Escopo desta etapa

Incluído:

- DTO validado com `zod`
- `ObservationFactory` (`DTO -> Observation`)
- `Observation` como entidade pura de domínio
- `ObservationPipelinePort` como porta neutra do pipeline interno
- `ObservationPipeline` (aplicação) gerando `Fact` internamente
- `Fact` e `FactFactory` como transformação pura (sem persistência)
- registro HTTP em `Express`
- endpoint `POST /api/inbound/events`
- resposta `202 Accepted` para payload válido
- resposta `400` para payload inválido

Excluído:

- Event Store
- roteamento por tipo de evento
- orquestração de domínio (`ExecutionService`) a partir de `Fact`
- feature flags por fluxo
- autenticação/assinatura do webhook

## Estrutura adotada

```text
server/inbound/
├── dto/
│   └── InboundEventDto.ts
├── ObservationFactory.ts
├── InboundService.ts
├── InboundRouter.ts
├── index.ts
└── InboundRouter.test.ts
```

```text
server/domain/
├── observation.ts
├── fact.ts
└── factFactory.ts
```

```text
server/ports/
└── ObservationPipelinePort.ts
```

```text
server/application/observation/
└── ObservationPipeline.ts
```

## Decisão importante

Esta etapa usa a estrutura real do projeto:

- runtime HTTP: `Express`
- entrypoint: `server/_core/index.ts`

Não foi criada uma árvore paralela em `src/` e não foi assumido framework diferente do existente.

## Próximo passo natural

- persistir `Observation` / `Fact` (Event Store)
- decidir quando existe `Policy` no pipeline interno
- introduzir persistência via `Event Store`
