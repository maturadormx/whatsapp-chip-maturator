# Roadmap

> Este documento descreve uma visão atual de evolução. Não representa decisões arquiteturais permanentes.

| Camada | Componentes | Estabilidade | Status |
|---|---|---|---|
| `Architecture` | Manifesto, Invariants, Principles, Style, Flows, Patterns, Implementations, Glossary | Alta | ✅ |
| `Contracts` | `MessageGateway`, `Clock`, `BehaviorActionLedgerRepository` | Alta | ✅ |
| `Services` | `ExecutionService`, `RetryService` | Média | ✅ |
| `Infrastructure` | `WhatsAppGateway`, `PostgresLedger`, `Inbound` | Baixa | ⬜ |
| `Observability` | Metrics, Logs, Control Center | Baixa | ⬜ |
