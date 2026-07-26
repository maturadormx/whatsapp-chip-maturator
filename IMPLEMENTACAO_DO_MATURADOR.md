# Implementação do Maturador

## Governança

Status: `CONGELADO`

Versão: `1.0`

Data:

`2026-07-18`

Categoria:

`Índice Mestre de Implementação`

Regra de governança:

este documento reúne a visão consolidada da implementação do `whatsapp-chip-maturator` sob a `Arquitetura Contratual do Maturador 1.0`.

Se houver conflito entre este índice e um contrato congelado, o contrato congelado prevalece.

## Objetivo

Este documento organiza a implementação já materializada em quatro blocos:

- `Core do Produto`
- `Application Layer`
- `Runtime e Integração`
- `Conformidade`

## Guarda-corpo arquitetural

- [Invariantes Arquiteturais do Chip Maturador](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\INVARIANTES_ARQUITETURAIS_DO_CHIP_MATURADOR.md)

## Core do Produto

| Documento | Papel |
|---|---|
| [Modelo de Persistência do Chip](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\implementation\MODELO_DE_PERSISTENCIA_DO_CHIP.md) | materialização física do histórico oficial |
| [Entidades e Value Objects do Chip](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\implementation\ENTIDADES_E_VALUE_OBJECTS_DO_CHIP.md) | tipos, estados, eventos e resultados do motor |
| [Aggregate do Chip](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\implementation\AGGREGATE_DO_CHIP.md) | unidade lógica de consistência do chip |
| [Event Store do Chip](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\implementation\EVENT_STORE_DO_CHIP.md) | interface e implementações do stream oficial |
| [Repositories do Chip](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\implementation\REPOSITORIES_DO_CHIP.md) | stores do stream, projeções e evidências |

## Application Layer

| Documento | Papel |
|---|---|
| [API do Chip — Implementação](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\implementation\API_DO_CHIP_IMPLEMENTACAO.md) | fronteira contratual aplicada em serviço + router |
| [Workers do Chip — Implementação](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\implementation\WORKERS_DO_CHIP_IMPLEMENTACAO.md) | projeções assíncronas reagindo a fatos persistidos |
| [Auditoria do Chip — Implementação](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\implementation\AUDITORIA_DO_CHIP_IMPLEMENTACAO.md) | replay, evidências append-only e validação |

## Runtime e operação

| Documento | Papel |
|---|---|
| [Runtime e Integração com o legado](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\implementation\RUNTIME_E_INTEGRACAO_COM_O_LEGADO.md) | encaixe da nova espinha no runtime atual |
| [Interface e Console Administrativo](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\implementation\INTERFACE_E_CONSOLE_ADMINISTRATIVO.md) | superfície operacional e administrativa do sistema |

## Migração do legado

| Documento | Papel |
|---|---|
| [Runtime e Integração com o legado](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\implementation\RUNTIME_E_INTEGRACAO_COM_O_LEGADO.md) | convivência controlada entre runtime legado e espinha contratual |

Ponte atual materializada em código:

- `server/services/chipLegacyBridgeService.ts`
- `server/services/chipReconciliationService.ts`
- `runtime.migrateLegacyChipToOfficialStream`
- `runtime.migrateLegacyUserFleetToOfficialStream`
- `runtime.reconcileLegacyUserAgainstOfficialProjection`
- `runtime.reconcileLegacyFleetAgainstOfficialProjection`

## Conformidade e testes

Cobertura atual relevante:

- `server/domain/chip/engine.test.ts`
- `server/domain/chip/persistence.test.ts`
- `server/domain/chip/conformance.test.ts`
- `server/routers/chipCore.test.ts`
- `server/services/chipProjectionWorkerService.test.ts`
- `server/services/chipAuditService.test.ts`
- `server/services/chipLegacyBridgeService.test.ts`
- `server/services/chipReconciliationService.test.ts`
- `server/routers/runtime.test.ts`

## Regra de leitura

Para entender a implementação do maturador nesta versão, a ordem recomendada é:

1. `Arquitetura Contratual do Maturador`
2. contratos congelados do `Core` e da `Application Layer`
3. `Implementação`
4. `Implementação do Maturador`

## Declaração de congelamento

Este documento está congelado como índice mestre da implementação do maturador na versão `1.0`.
