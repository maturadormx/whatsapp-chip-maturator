# Repositories do Chip

## Governança

Status: `CONGELADO`

Versão: `1.0`

Data:

`2026-07-18`

Categoria:

`Implementação — Core do Produto`

Depende de:

- `Aggregate do Chip`
- `Event Store do Chip`
- `Modelo de Persistência do Chip`

## Objetivo

Este documento define como a noção de repositório foi aplicada na implementação atual do chip.

Ele existe para evitar dois desvios:

- chamar qualquer acesso a tabela de “repository”
- esconder decisões de domínio dentro de classes de persistência

## Definição adotada

Nesta versão, o papel de repositório está dividido em dois níveis:

O sistema utiliza repositórios especializados por responsabilidade, e não um repositório único para todo o domínio.

### Repositório do stream oficial

Representado por:

- `ChipEventStore`

Papel:

- carregar e anexar fatos oficiais do chip

### Repositórios de leitura derivada

Representados por:

- `ChipProjectionStore`
- `ChipAuditEvidenceStore`

Papel:

- persistir e recuperar materializações derivadas
- persistir e recuperar evidências append-only

Regra:

repositório de leitura derivada nunca substitui o repositório do stream oficial.

## Interfaces atuais

### `ChipEventStore`

Origem:

- `server/domain/chip/persistence.ts`

Responsabilidade:

- stream oficial do chip

### `ChipProjectionStore`

Origem:

- `server/domain/chip/persistence.ts`

Responsabilidade:

- projeções derivadas
- checkpoints de workers

### `ChipAuditEvidenceStore`

Origem:

- `server/domain/chip/audit.ts`

Responsabilidade:

- evidências append-only da auditoria

## Implementações atuais

### Em memória

- `InMemoryChipEventStore`
- `InMemoryChipProjectionStore`
- `InMemoryChipAuditEvidenceStore`

Uso:

- testes
- desenvolvimento local sem banco
- verificação semântica do fluxo

### MySQL

- `MysqlChipEventStore`
- `MysqlChipProjectionStore`
- `MysqlChipAuditEvidenceStore`

Uso:

- runtime com persistência real
- integração com `Drizzle`

## Composição na camada de aplicação

A camada de aplicação não fala diretamente com tabelas.

Ela fala com serviços que dependem dessas interfaces de repositório:

- `ChipCoreApiService`
- `ChipProjectionWorkerService`
- `ChipAuditService`

Regra:

serviço de aplicação conhece a interface do repositório, não a estrutura física do banco.

## O que não é repository nesta versão

Não devem ser tratados como repository:

- routers tRPC
- handlers Express
- utilitários operacionais
- tabelas legadas acessadas ad hoc
- métricas e painéis

## Evolução futura

Uma evolução futura pode introduzir um `ChipRepository` mais explícito, por exemplo:

- `loadAggregate(chipId)`
- `appendToStream(chipId, event)`
- `saveProjection(...)`

Na versão atual, isso ainda está distribuído entre stores especializadas e serviços de aplicação.

Regra:

essa distribuição é aceitável enquanto a autoridade do domínio continuar concentrada no stream oficial e no replay do motor.

## Relação com a implementação atual

Este documento está alinhado com:

- `server/domain/chip/persistence.ts`
- `server/domain/chip/audit.ts`
- `server/domain/chip/*Store.ts`
- `server/services/chipCoreApiService.ts`
- `server/services/chipProjectionWorkerService.ts`
- `server/services/chipAuditService.ts`

## Declaração de congelamento

Este documento está congelado como referência de implementação dos repositories do chip na versão `1.0`.
