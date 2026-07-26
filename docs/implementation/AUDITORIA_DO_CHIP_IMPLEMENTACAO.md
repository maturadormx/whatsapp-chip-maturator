# Auditoria do Chip — Implementação

## Governança

Status: `CONGELADO`

Versão: `1.0`

Data:

`2026-07-18`

Categoria:

`Implementação — Application Layer`

Depende de:

- `Auditoria do Chip Maturador`
- `API do Chip — Implementação`
- `Repositories do Chip`

## Objetivo

Este documento descreve como a auditoria do chip foi implementada na versão atual.

Ele existe para mostrar:

- como a auditoria executa replay
- como produz evidências
- onde essas evidências vivem
- como a imutabilidade append-only foi materializada

## Serviço atual

A implementação atual da auditoria é representada por:

- `ChipAuditService`

Origem de código:

- `server/services/chipAuditService.ts`

## Fluxo atual de auditoria

Na implementação atual, auditar um chip significa:

1. recuperar o histórico pela fronteira da API
2. executar `replayHistory()`
3. classificar a evidência como:
   - `REPLAY_VALIDATION`
   - `INCONSISTENCY_DETECTION`
4. persistir uma nova evidência append-only

Regra:

a auditoria atual usa exclusivamente o histórico oficial e o replay do motor.

Ela não depende de projeções persistidas para validar o comportamento do chip.

## Limite da auditoria

A auditoria não constitui fonte de verdade.

Ela observa.

Ela nunca substitui o histórico oficial.

## Evidência atual

A unidade de persistência da auditoria é:

- `ChipAuditEvidence`

Tipos atuais:

- `REPLAY_VALIDATION`
- `INCONSISTENCY_DETECTION`
- `CONFORMITY_VERIFICATION`

Na implementação desta versão, os dois primeiros tipos já são usados explicitamente.

## Imutabilidade materializada

A imutabilidade append-only da auditoria foi materializada por:

- `ChipAuditEvidenceStore.appendEvidence()`
- `UNIQUE(evidenceId)`
- ausência de operação de update no store de evidências

Regra:

nova auditoria gera nova evidência.

Nenhuma evidência existente é sobrescrita ou corrigida in-place.

## Payload atual da auditoria

O payload gerado hoje contém, no mínimo:

- `happened`
- `occurred_in_order`
- `current_state`
- `previous_state`
- `last_sequence`
- `processed_events`
- `transitions_applied`
- `inconsistency_count`
- `inconsistencies`
- `reproducible`
- `uses_primary_evidence_only`

Regra:

o payload é uma evidência derivada do replay, nunca uma redefinição do histórico oficial.

## Stores atuais

### Em memória

- `InMemoryChipAuditEvidenceStore`

Uso:

- testes
- execução local sem banco

### MySQL

- `MysqlChipAuditEvidenceStore`

Uso:

- persistência real da auditoria

Tabela física:

- `chip_audit_evidences`

## Relação com a API

A auditoria atual depende de:

- `ChipCoreApiService.replayHistory()`

Isso garante que a mesma semântica de leitura do histórico usada pela API também seja usada pela auditoria.

## Relação com workers

A auditoria não depende do worker de projeção para validar comportamento.

Ela pode coexistir com projeções e checkpoints, mas não os usa como evidência primária.

## Relação com runtime

A auditoria foi integrada ao runtime por:

- `runtime.runChipAudit`
- `runtime.getChipAuditEvidence`

Origem:

- `server/routers/runtime.ts`

Isso permite:

- disparar auditoria manualmente
- ler evidências persistidas por chip

## O que a auditoria atual não faz

A implementação atual ainda não inclui:

- trilha separada de `CONFORMITY_VERIFICATION` com regras adicionais
- agendamento automático próprio para auditoria do chip
- relatórios compostos multi-chip
- correlação com evidências externas de interface

Regra:

essas ausências são lacunas de implementação, não quebra do contrato da auditoria.

## Testes atuais

Cobertura existente:

- `server/services/chipAuditService.test.ts`

Os testes verificam:

- geração de evidência consistente para histórico válido
- append-only entre auditorias sucessivas
- geração de evidência de inconsistência para histórico corrompido

## Relação com a implementação atual

Este documento está alinhado com:

- `server/services/chipAuditService.ts`
- `server/services/chipAuditService.test.ts`
- `server/domain/chip/audit.ts`
- `server/domain/chip/*AuditEvidenceStore.ts`
- `server/routers/runtime.ts`

## Declaração de congelamento

Este documento está congelado como referência de implementação da auditoria do chip na versão `1.0`.
