# Modelo de Persistência do Chip

## Governança

Status: `CONGELADO`

Versão: `1.0`

Data:

`2026-07-18`

Categoria:

`Implementação — Core do Produto`

Depende de:

- `Contrato dos Eventos do Chip`
- `Persistência do Histórico do Chip`
- `Motor de Estados do Chip`

Regra de governança:

este documento materializa fisicamente, em `MySQL + Drizzle`, os contratos já congelados do `Core do Produto`.

Ele não redefine semântica de domínio.

Ele não cria um décimo contrato arquitetural.

Mudanças neste documento devem preservar a compatibilidade com os contratos congelados e com a `Arquitetura Contratual do Maturador 1.0`.

## Objetivo

Este documento define a estrutura física que materializa o histórico oficial do chip e os artefatos derivados necessários à operação.

Ele existe para responder, de forma concreta:

- onde o histórico oficial é gravado
- como a `sequence` é atribuída
- como a idempotência é garantida
- onde as projeções derivadas vivem
- onde os checkpoints de workers vivem
- onde as evidências da auditoria vivem

## Stack oficial

A implementação oficial desta versão utiliza:

- `MySQL`
- `Drizzle ORM`
- `TIMESTAMP` para campos temporais
- `MEDIUMTEXT` com JSON serializado para `payload`, `metadata` e evidências

Regra:

esta escolha física não altera a semântica dos campos definidos no `Contrato dos Eventos do Chip`.

## Princípios de materialização

### Fonte primária

O histórico oficial do chip vive exclusivamente em `chip_event_history`.

Nenhuma projeção, tabela operacional, cache ou evidência de auditoria substitui essa fonte primária.

### Separação entre identidade e projeção

A identidade contínua do chip pertence ao domínio e ao stream oficial.

Estados atuais, resumos operacionais e leituras rápidas pertencem a projeções derivadas.

### Separação entre fato oficial e rejeição

Evento rejeitado na ingestão não entra no histórico oficial.

Evento rejeitado na ingestão também não se confunde com inconsistência detectada sobre fatos já persistidos.

### Separação entre histórico e auditoria

A auditoria observa o histórico oficial e produz evidências próprias.

Ela nunca altera fatos já persistidos.

## Estruturas físicas oficiais

### Stream oficial `chip_event_history`

Tabela responsável por armazenar o histórico append-only do chip.

Campos:

| Campo físico | Tipo | Papel |
|---|---|---|
| `id` | `INT AUTO_INCREMENT` | offset físico do registro persistido |
| `eventId` | `VARCHAR(191)` | identidade idempotente do evento |
| `chipId` | `VARCHAR(191)` | identidade lógica do stream do chip |
| `eventType` | `VARCHAR(100)` | tipo do evento oficial |
| `eventVersion` | `INT` | versão do schema do evento |
| `sequence` | `INT` | ordem lógica oficial por `chipId` |
| `occurredAt` | `TIMESTAMP` | instante em que o fato ocorreu |
| `recordedAt` | `TIMESTAMP` | instante em que o fato foi persistido |
| `payload` | `MEDIUMTEXT` | payload serializado em JSON |
| `metadata` | `MEDIUMTEXT NULL` | metadados opcionais serializados em JSON |

Constraints oficiais:

- `UNIQUE(eventId)`
- `UNIQUE(chipId, sequence)`
- `INDEX(chipId, sequence)`

Regra:

`chip_event_history` é a única estrutura física autorizada a materializar o histórico oficial.

### Projeção derivada `chip_state_projections`

Tabela destinada a leitura rápida do estado derivado do chip.

Campos:

| Campo físico | Tipo | Papel |
|---|---|---|
| `id` | `INT AUTO_INCREMENT` | chave técnica |
| `chipId` | `VARCHAR(191)` | identidade lógica do chip |
| `currentState` | `VARCHAR(64)` | estado derivado atual |
| `previousState` | `VARCHAR(64)` | último estado de vida preservado |
| `lastSequence` | `INT` | última `sequence` refletida na projeção |
| `inconsistencyCount` | `INT` | total de inconsistências observadas no replay |
| `updatedAt` | `TIMESTAMP` | momento da última materialização |

Constraint oficial:

- `UNIQUE(chipId)`

Regra:

essa tabela é descartável e recalculável.

Em caso de divergência, `chip_event_history` prevalece.

### Checkpoints assíncronos `chip_worker_checkpoints`

Tabela destinada ao cursor persistido de workers que reagem apenas a fatos já persistidos.

Campos:

| Campo físico | Tipo | Papel |
|---|---|---|
| `id` | `INT AUTO_INCREMENT` | chave técnica |
| `workerName` | `VARCHAR(120)` | identidade do worker |
| `lastOffset` | `INT` | último offset físico consumido |
| `updatedAt` | `TIMESTAMP` | momento do último avanço |

Constraint oficial:

- `UNIQUE(workerName)`

Regra:

checkpoint não altera o histórico oficial.

Ele apenas registra até onde um worker observou fatos já persistidos.

### Evidências append-only `chip_audit_evidences`

Tabela destinada às evidências produzidas pela auditoria.

Campos:

| Campo físico | Tipo | Papel |
|---|---|---|
| `id` | `INT AUTO_INCREMENT` | chave técnica |
| `evidenceId` | `VARCHAR(191)` | identidade da evidência |
| `chipId` | `VARCHAR(191)` | identidade lógica do chip auditado |
| `evidenceType` | `VARCHAR(64)` | tipo da evidência |
| `recordedAt` | `TIMESTAMP` | momento da persistência da evidência |
| `payload` | `MEDIUMTEXT` | evidência serializada em JSON |

Constraints oficiais:

- `UNIQUE(evidenceId)`
- `INDEX(chipId, recordedAt)`

Regra:

evidência de auditoria é append-only e somente leitura após persistência.

Correção, complementação ou reclassificação gera nova evidência, nunca atualização in-place.

## Estruturas operacionais legadas

### `whatsapp_chips`

A tabela `whatsapp_chips` permanece como estrutura operacional do runtime atual.

Ela não materializa o histórico oficial do domínio do chip.

Regra:

qualquer campo de estado presente em `whatsapp_chips` deve ser tratado como projeção operacional ou integração legada, nunca como fonte primária de verdade do domínio.

## Estratégia oficial de concorrência

A estratégia oficial desta versão é:

`otimista com UNIQUE(chipId, sequence) + retry limitado`

Fluxo oficial:

1. iniciar transação
2. verificar idempotência por `eventId`
3. ler a maior `sequence` atual do `chipId`
4. calcular `nextSequence = lastSequence + 1`
5. tentar inserir o novo evento
6. em caso de conflito por duplicidade, repetir a tentativa até 3 vezes
7. se as tentativas falharem, abortar a escrita

Regra:

esta estratégia deve garantir que duas `sequence` iguais nunca sejam confirmadas para o mesmo `chipId`.

Uso de lock pessimista só é aceitável como evolução deliberada de implementação, sem alterar a semântica do contrato.

## Idempotência

A idempotência é materializada por `eventId`.

Regras:

- `eventId` já existente retorna o evento previamente persistido
- o mesmo `eventId` não pode gerar duplicação lógica no stream
- idempotência é resolvida antes de qualquer nova confirmação do evento

## Leitura oficial

### Histórico completo

Leitura oficial para replay integral:

- filtrar por `chipId`
- ordenar por `sequence ASC`
- retornar `mode = complete`

### Histórico parcial

Leitura parcial pode ser usada para:

- inspeção operacional
- janelas de auditoria parcial
- projeções auxiliares

Regra:

histórico parcial nunca pode ser tratado como base para derivação oficial do estado do chip.

Se a leitura for parcial, essa limitação deve ser sinalizada explicitamente.

## Rejeições de ingestão

Evento rejeitado na ingestão:

- não entra em `chip_event_history`
- não recebe `sequence` oficial
- não participa de replay oficial

Na versão `1.0`, rejeições de ingestão podem ser tratadas como resposta operacional da API sem tabela dedicada obrigatória.

Regra:

elas não se confundem com inconsistências detectadas sobre fatos já persistidos nem com evidências de auditoria.

## Inconsistências e auditoria

Inconsistência sobre histórico oficial é detectada por replay do `Motor de Estados` ou pela `Auditoria`.

Sua materialização oficial nesta implementação ocorre em:

- `chip_state_projections.inconsistencyCount`
- `chip_audit_evidences.payload`

Regra:

inconsistência detectada sobre fatos persistidos nunca autoriza alteração retroativa do stream oficial.

## Integridade mínima obrigatória

Antes de uma escrita ser confirmada, a implementação deve impedir:

- `eventId` duplicado
- `sequence` duplicada para o mesmo `chipId`
- escrita parcial do evento
- serialização estrutural inválida de `payload`

Após confirmação, a implementação deve preservar:

- append-only
- ordem lógica por `sequence`
- leitura apta a replay
- imutabilidade do fato persistido

## Backup, retenção e arquivamento

Backup, retenção temporal e política de arquivamento pertencem à governança operacional do ambiente.

Eles não redefinem este modelo físico como contrato de implementação, desde que preservem:

- integridade do stream
- ordem lógica
- idempotência
- possibilidade de replay oficial quando o histórico for declarado completo

## Relação com a implementação atual

Este documento está alinhado com os seguintes pontos já materializados no código:

- `MysqlChipEventStore`
- `MysqlChipProjectionStore`
- `MysqlChipAuditEvidenceStore`
- `ChipProjectionWorkerService`
- `ChipAuditService`

## Declaração de congelamento

Este documento está congelado como referência de implementação física da persistência do chip na versão `1.0`.
