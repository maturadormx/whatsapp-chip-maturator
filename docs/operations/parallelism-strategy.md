# Estratégia de paralelismo e proteção do núcleo

Abrir várias frentes pode acelerar o projeto, mas abrir frentes demais em uma arquitetura recém-consolidada aumenta o custo de integração e dificulta localizar regressões.

## Regra do núcleo protegido

O núcleo é uma plataforma estável para as frentes periféricas.

Componentes protegidos:

- `ExecutionService`
- `RetryService`
- `MessageGateway` (contrato)
- `Clock` (contrato)
- `BehaviorActionLedgerRepository` (contrato)

Mudanças no núcleo:

- apenas quando uma frente revelar limitação real e comprovada
- ADR obrigatório se alterar princípios ou contratos
- caso contrário: adaptar a implementação periférica

## Frentes recomendadas

Recomendação inicial: até **cinco frentes simultâneas**, ajustando conforme a capacidade real de integração do time.

Exemplos de frentes com baixo acoplamento:

- Inbound (HTTP/Webhook)
- Event Store
- Recovery Service
- Scheduler/Dispatcher
- Observabilidade
- Test harness / fixtures

## Ritmo

Trabalhar em sprints de integração curtas:

1. cada frente fecha um `Integration Milestone`
2. integra no núcleo (apenas se necessário)
3. roda a suíte completa
4. só então inicia o próximo incremento
