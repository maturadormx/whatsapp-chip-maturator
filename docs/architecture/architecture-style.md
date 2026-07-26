# Estilo Arquitetural

> Fornece contexto. Não define regras. As regras pertencem aos `Principles`.

Esta arquitetura combina:

- **Domain-Driven Design (DDD)**: vocabulário ubíquo e bounded contexts
- **Hexagonal Architecture / Ports & Adapters**: domínio no centro e infraestrutura externa
- **Functional Core / Imperative Shell**: núcleo puro e borda imperativa
- **Dependency Inversion**: domínio depende de abstrações
- **Event-driven** quando necessário: comunicação assíncrona entre bounded contexts
- **CQRS-light**: separação conceitual entre leitura e escrita, sem infraestrutura duplicada

> Este documento existe para evitar que ADRs repitam contexto arquitetural. Ele situa a arquitetura; não legisla sobre ela.
