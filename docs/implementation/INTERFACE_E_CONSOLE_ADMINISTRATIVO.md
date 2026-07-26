# Interface e Console Administrativo

## Governança

Status: `CONGELADO`

Versão: `1.0`

Data:

`2026-07-18`

Categoria:

`Implementação — Superfície Operacional`

Depende de:

- `API do Chip — Implementação`
- `Workers do Chip — Implementação`
- `Auditoria do Chip — Implementação`
- `Runtime e Integração com o legado`

## Objetivo

Este documento descreve a superfície atual de operação e administração do maturador sobre a nova espinha contratual.

Ele existe para deixar claro:

- onde o operador observa o sistema
- onde o administrador aciona projeções, auditoria e migração
- como essa superfície ainda convive com o runtime legado

## Superfícies atuais

Na implementação atual, o console administrativo está distribuído entre:

- `runtimeRouter`
- `runtimeSupervisorService`
- `chipsRouter`
- rotas e painéis já existentes do runtime

Regra:

a interface operacional atual ainda é híbrida.

Ela combina visão legada do runtime com novos controles ligados ao stream oficial do chip.

## Runtime supervisor

O painel técnico principal é materializado por:

- `buildRuntimeSupervisorOverview()`
- `getRuntimeChipConsole()`

Origem:

- `server/services/runtimeSupervisorService.ts`

Essas funções produzem:

- visão consolidada da frota
- alertas operacionais
- console por chip
- sinais de saúde, memória, identidade e execução

## Rotas administrativas atuais

As principais operações administrativas ligadas à nova espinha estão em:

- `server/routers/runtime.ts`

Operações relevantes:

- `triggerChipProjectionCycle`
- `getChipProjection`
- `runChipAudit`
- `getChipAuditEvidence`
- `migrateLegacyChipToOfficialStream`
- `migrateLegacyUserFleetToOfficialStream`
- `reconcileLegacyUserAgainstOfficialProjection`
- `reconcileLegacyFleetAgainstOfficialProjection`

Regra:

essas rotas formam o primeiro console administrativo explícito da espinha contratual do chip.

## Relação com o legado

O console administrativo atual não substituiu integralmente:

- `chipsRouter`
- dashboards operacionais antigos
- leituras derivadas de `whatsapp_chips`

Por isso, o operador ainda trabalha em uma superfície mista:

- controles legados para operação diária existente
- controles novos para projeção, auditoria e migração contratual

## Papel da interface nova

Mesmo sem uma UI dedicada separada, a nova superfície já cumpre quatro papéis:

1. observar o estado derivado por projeção
2. disparar processamento assíncrono controlado
3. auditar um chip por replay
4. iniciar migração do legado para o stream oficial
5. executar reconciliação entre legado, stream oficial, projeção e replay

## Relação com segurança operacional

As rotas críticas da nova superfície atual usam `adminProcedure`.

Isso mantém:

- projeção administrativa
- auditoria manual
- migração do legado

restritas ao plano administrativo do sistema.

## Limites atuais da interface

A superfície atual ainda não possui:

- tela dedicada para navegar `chip_event_history`
- timeline visual do stream oficial
- comparação visual entre legado e projeção derivada
- painel dedicado de evidências da auditoria
- assistente de reconciliação legado -> oficial

Regra:

essas ausências são lacunas de interface, não lacunas da espinha contratual já implementada.

## Próxima evolução natural

Uma evolução futura da interface administrativa pode introduzir:

- visualização do histórico oficial por chip
- inspeção de `sequence`
- diff entre projeção oficial e estado legado
- lista de evidências append-only por chip
- painel de progresso da migração do legado

## Relação com a implementação atual

Este documento está alinhado com:

- `server/routers/runtime.ts`
- `server/routers/chips.ts`
- `server/services/runtimeSupervisorService.ts`
- `server/routers/runtime.test.ts`

## Declaração de congelamento

Este documento está congelado como referência da interface e do console administrativo do maturador na versão `1.0`.
