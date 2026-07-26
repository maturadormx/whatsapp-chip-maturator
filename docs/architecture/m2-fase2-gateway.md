# Fase 2 — MessageGateway

## Objetivo

Desacoplar o envio de mensagens do núcleo operacional.

## Arquitetura

```text
ExecutionService (orquestrador)
        │
        ▼
MessageGateway (abstração pura)
        │
        ├── FakeMessageGateway (testes)
        ├── WhatsAppGateway (futuro)
        └── MockGateway (futuro)
```

## Contratos

- `OutboundMessage`: mensagem de saída
- `GatewayResult`: resultado do envio (`ACKED`, `FAILED`, `TIMEOUT`)
- `MessageGateway.send()`: único método da abstração

## Regras

- nenhuma lógica de retry no gateway
- nenhuma lógica de budget no gateway
- nenhuma decisão de negócio no gateway

## Implementação realizada

### Commit 1

- contratos do gateway
- tipos separados

### Commit 2

- injeção de `MessageGateway` no `ExecutionService`
- adapter padrão preservando a implementação legada

### Commit 3

- `FakeMessageGateway`
- testes unitários do contrato
- testes de integração dedicados

### Commit 4

- ADR da abstração
- atualização da rastreabilidade
- documentação consolidada da fase

## Estado

- `105/105` testes passando
- `pnpm build` OK

## Próximo passo

Após o fechamento documental da Fase 2, os próximos incrementos naturais continuam sendo:

- `MockGateway`
- `Clock`
- integrações concretas posteriores
