# RELEASE NOTES

## Fase 1 — Núcleo Operacional Validado

### O que esta baseline representa

- execução rastreável
- retry seguro
- budget transacional
- validação integrada do núcleo
- E2E arquitetural da Fase 1 com cinco cenários reais sobre os serviços existentes

### O que ainda não faz parte desta baseline

- `MessageGateway` desacoplado
- `MockGateway`
- `Clock` injetável
- `Inbound Handler`
- ACK real do provedor
- `Event Store`

### Próxima fase

Após a criação da tag `m2-fase-1`, o próximo passo arquitetural é a Fase 2:

1. `MessageGateway Interface`
2. `MockGateway`
3. `Clock Interface`

## Fase 2 — MessageGateway Concluída Localmente

### O que esta baseline representa

- abstração pura de transporte para envio
- desacoplamento entre `ExecutionService` e a implementação concreta
- fake determinístico para testes
- testes unitários do contrato
- testes de integração dedicados da Fase 2
- ADR e rastreabilidade sincronizadas

### O que ainda não faz parte desta baseline

- `MockGateway` concreto para cenários de desenvolvimento
- `Clock` injetável
- `Inbound Handler`
- ACK real do provedor
- `Event Store`
- `Recovery`

### Próxima fase

Após registrar a tag local `m2-fase-2`, o próximo marco arquitetural natural é:

1. `MockGateway`
2. `Clock`
3. integrações concretas posteriores
