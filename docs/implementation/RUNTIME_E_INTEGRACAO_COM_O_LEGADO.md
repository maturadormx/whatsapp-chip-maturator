# Runtime e Integração com o legado

## Governança

Status: `CONGELADO`

Versão: `1.0`

Data:

`2026-07-18`

Categoria:

`Implementação — Application Layer`

Depende de:

- `API do Chip — Implementação`
- `Workers do Chip — Implementação`
- `Auditoria do Chip — Implementação`
- `Modelo de Persistência do Chip`

## Objetivo

Este documento descreve como a espinha contratual nova foi encaixada no runtime real do projeto sem substituir integralmente o fluxo operacional legado.

Ele existe para deixar explícito:

- onde a nova espinha entra no servidor atual
- como ela convive com rotas e tabelas legadas
- como o runtime dispara projeções e auditoria
- onde ainda existe transição pendente do legado para o modelo contratual

## Limite do runtime

`Runtime` não é domínio.

`Runtime` não é API contratual.

`Runtime` é a camada de operações administrativas, observabilidade, acionamento controlado e convivência com o legado.

## Ponto de entrada no servidor

O runtime real do projeto é inicializado em:

- `server/_core/index.ts`

Nesse ponto, o servidor registra:

- middleware `tRPC`
- endpoints agendáveis (`scheduled`)
- rotas auxiliares do runtime

A nova espinha contratual foi encaixada sem substituir o restante do runtime.

## Registro atual no runtime

Hoje o servidor registra:

- `chipCoreRouter` no `appRouter`
- endpoint agendável `/api/scheduled/chip-projection`
- integração administrativa no `runtimeRouter`

Regra:

o encaixe atual é incremental.

Ele adiciona a nova espinha sem quebrar o comportamento legado já existente.

## Infraestrutura compartilhada

Para evitar que cada serviço use uma store diferente, a implementação centralizou o bootstrap em:

- `server/services/chipInfrastructure.ts`

Responsabilidades:

- fornecer `ChipEventStore`
- fornecer `ChipProjectionStore`
- fornecer `ChipAuditEvidenceStore`
- escolher entre implementação em memória e MySQL conforme o ambiente

Regra:

API, workers e auditoria devem compartilhar a mesma infraestrutura de stores no runtime.

## Integração administrativa

O `runtimeRouter` passou a expor:

- `triggerChipProjectionCycle`
- `getChipProjection`
- `runChipAudit`
- `getChipAuditEvidence`

Essas rotas permitem operar a nova espinha pelo console administrativo sem alterar o legado existente.

## Integração agendada

O runtime atual também passou a registrar:

- `chipProjectionHeartbeatHandler`
- `ensureChipProjectionHeartbeatJob()`

Endpoint:

- `/api/scheduled/chip-projection`

Papel:

- processar fatos persistidos de forma assíncrona
- manter projeções atualizadas
- funcionar como ponte operacional entre o stream oficial e leituras derivadas

## Convivência com o legado

### Estruturas legadas que continuam existindo

Ainda permanecem ativas no projeto:

- `whatsapp_chips`
- `chipsRouter`
- serviços operacionais já existentes de maturação, health e dashboard
- heartbeats históricos do runtime

### Papel dessas estruturas agora

Elas continuam atendendo o runtime atual, mas não substituem:

- `chip_event_history`
- `chip_state_projections`
- `chip_audit_evidences`

Regra:

o legado continua operacional, mas a autoridade normativa do domínio pertence à espinha contratual nova.

## Limite atual da migração

Nesta versão, a integração com o legado ainda é parcial.

Já foi implementado:

- persistência oficial do stream do chip
- projeção derivada por worker
- auditoria append-only por replay
- rotas administrativas e heartbeat do novo fluxo
- ponte inicial de migração do legado para o stream oficial

Ainda não foi concluído:

- emissão sistemática de fatos oficiais a partir de todas as operações legadas
- substituição integral dos estados legados por projeções derivadas do stream
- migração total do `chipsRouter` para a nova superfície contratual

## Ponte inicial de migração

A implementação atual já possui uma ponte explícita para migração do legado:

- `server/services/chipLegacyBridgeService.ts`

Essa ponte:

- lê snapshots de `whatsapp_chips`
- gera um `official_chip_id` previsível
- cria o stream oficial inicial
- materializa o pareamento quando existe `phoneNumber`
- materializa uma leitura conservadora de maturação para chips em status `maturando`

Rotas administrativas expostas:

- `runtime.migrateLegacyChipToOfficialStream`
- `runtime.migrateLegacyUserFleetToOfficialStream`
- `runtime.reconcileLegacyUserAgainstOfficialProjection`
- `runtime.reconcileLegacyFleetAgainstOfficialProjection`

Regra:

a ponte atual é conservadora.

Ela não tenta inferir todo o histórico passado do legado; ela apenas cria uma entrada controlada no stream oficial a partir do snapshot disponível.

Ela nunca modifica um histórico oficial já existente.

## Reconciliação entre legado e projeção oficial

A implementação atual também possui um serviço explícito de reconciliação:

- `server/services/chipReconciliationService.ts`

Essa reconciliação compara, por chip:

- snapshot legado em `whatsapp_chips`
- stream oficial do chip
- projeção atual em `chip_state_projections`
- replay atual do histórico oficial

Relatórios atuais incluem, no mínimo:

- chips reconciliados
- divergências encontradas
- chips sem stream oficial
- streams sem projeção
- projeções inconsistentes com o replay
- divergências entre o estado legado e o estado oficial derivado

Política explícita de compatibilidade semântica:

- um snapshot legado `desconectado` com vínculo persistente em `phoneNumber` é compatível com o estado oficial `PAREADO`

Regra:

essa compatibilidade não altera o `Core`.

Ela apenas reconhece que o legado misturava conectividade operacional com vínculo de pareamento persistido.

## Estratégia de convivência

A estratégia atual é de transição controlada.

Ela segue três regras:

1. o legado continua servindo operação existente
2. a nova espinha contratual cresce em paralelo
3. a migração só é considerada concluída quando o runtime legado passar a produzir e consumir fatos oficiais como fluxo principal

## Testes atuais de integração operacional

Cobertura existente:

- `server/routers/runtime.test.ts`

Esses testes verificam:

- trigger administrativo de projeção
- leitura de projeção via runtime
- execução de auditoria via runtime
- leitura de evidências via runtime

## Relação com a implementação atual

Este documento está alinhado com:

- `server/_core/index.ts`
- `server/routers.ts`
- `server/routers/runtime.ts`
- `server/routers/runtime.test.ts`
- `server/scheduled/chipProjectionHeartbeat.ts`
- `server/services/chipInfrastructure.ts`

## Declaração de congelamento

Este documento está congelado como referência de implementação do runtime e da integração com o legado na versão `1.0`.
