# CHANGELOG

## m2-fase-1 — Núcleo Operacional

### Entregas

- `Execution Ledger` persistido
- `ExecutionService` desacoplado da decisão
- `RetryService` com política mínima e `attempt` monotônico
- `BudgetReservationService` com `RESERVED -> COMMITTED/RELEASED`
- `Control Center` com evidências operacionais reais
- validação integrada da Fase 1
- suíte `tests/integration/m2-fase1-e2e.test.ts` com 5 cenários e 6 invariantes
- sincronização de rastreabilidade, invariantes, state machine e diagramas

### Resultado

O sistema passou a ter um núcleo operacional interno rastreável, recuperável e financeiramente consistente.

## m2-fase-2 — MessageGateway

### Entregas

- `MessageGateway` como abstração pura
- `OutboundMessage` e `GatewayResult` como contratos dedicados
- injeção do gateway no `ExecutionService`
- adapter padrão preservando o transporte legado
- `FakeMessageGateway` para testes
- testes unitários do contrato do gateway
- testes de integração dedicados `ExecutionService -> MessageGateway`
- ADR da abstração do gateway
- rastreabilidade da Fase 2 sincronizada
- documentação consolidada da fase

### Resultado

O envio de mensagens passou a estar desacoplado do núcleo operacional, com contrato explícito, injeção de dependência, fake determinístico e cobertura dedicada de integração.
