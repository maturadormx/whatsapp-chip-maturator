# Persistência do Histórico do Chip

## Governança

Status: `CONGELADO`

Versão: `1.0`

Data:

`2026-07-18`

Categoria:

`Core do Produto`

Dependências:

- `Contrato de Domínio do Chip`
- `Máquina de Estados do Chip`
- `Contrato dos Eventos do Chip`
- `Motor de Estados do Chip`

Documentos que dependem deste:

- `API`
- `Workers`
- `Interface`
- `Auditoria`

Regra de governança:

este documento define como o histórico oficial do chip é preservado com integridade suficiente para que o motor cumpra seu contrato.

Ele não escolhe tecnologia específica de armazenamento.

Nenhuma implementação deve alterar este documento.

Mudanças requerem decisão explícita de produto.

## Objetivo

Este documento define como o histórico oficial de eventos do chip deve ser armazenado de forma íntegra, ordenada e auditável.

Ele não define projeções.

Ele não define estado derivado.

Ele não define interface de usuário.

Ele não valida regras de domínio.

## Unidade de persistência

A unidade oficial de persistência é o `Evento`.

Não são persistidos como fonte primária de verdade:

- estados derivados
- projeções
- resumos
- caches

Esses artefatos podem existir, mas nunca substituem o histórico append-only.

## Modelo conceitual

`Evento -> Stream do Chip -> Persistência -> Leitura ordenada -> Motor de Estados`

Leitura funcional:

| Camada | Responsabilidade |
|---|---|
| `Contrato de Domínio` | identidade e invariantes |
| `Máquina de Estados` | estados e transições válidas |
| `Contrato dos Eventos` | fatos, schema e semântica |
| `Motor de Estados` | interpretação determinística |
| `Persistência` | preservação íntegra e ordenação oficial do histórico |

Regra:

a `Persistência` não valida regras de domínio.

Ela garante durabilidade, ordenação, atomicidade e integridade do histórico oficial.

## Garantias da persistência

| Garantia | Descrição |
|---|---|
| `Atomicidade` | um evento é persistido por inteiro ou não é persistido |
| `Durabilidade` | um evento confirmado não pode desaparecer silenciosamente |
| `Consistência por chip` | o stream de um chip preserva identidade única |
| `Integridade` | não pode haver evento estruturalmente corrompido aceito como válido |
| `Idempotência` | o mesmo `event_id` não gera duplicação lógica |
| `Ordem lógica` | cada evento persistido recebe posição única e monotônica no stream do chip |
| `Imutabilidade` | evento persistido não é editado nem sobrescrito |

## Sequence como propriedade de contrato

O `Contrato dos Eventos do Chip` define que existe uma `sequence` única e monotônica por `chip_id`.

A camada de `Persistência` é responsável por materializar essa garantia.

Regra:

cabe à persistência garantir que cada evento persistido receba uma `sequence` única e monotônica dentro do histórico do seu `chip_id`.

O mecanismo usado para garantir isso é decisão de implementação e não faz parte deste contrato.

## Escrita

### Objetivo da escrita

Persistir um novo evento no stream oficial do chip sem violar:

- identidade do chip
- unicidade do evento
- monotonicidade da `sequence`
- append-only

### Compromisso de persistência

Um evento só passa a integrar o histórico oficial do `chip_id` quando, simultaneamente:

- recebeu uma `sequence` válida para aquele `chip_id`
- foi persistido integralmente
- tornou-se visível para leituras futuras do histórico

Regra:

antes desse ponto, o evento não faz parte do histórico oficial e não pode ser utilizado em replay pelo `Motor de Estados`.

### Regras de escrita

- nenhum evento pode ser sobrescrito
- nenhum evento pode ser inserido retroativamente no meio do stream já oficializado
- nenhum `event_id` pode ser reutilizado
- nenhum evento pode receber `sequence` já utilizada no mesmo `chip_id`
- nenhuma escrita pode confirmar parcialmente um evento

## Estabilidade do histórico

Após confirmado, o histórico oficial de um `chip_id` é imutável.

São proibidos:

- remoção de eventos
- alteração de `sequence`
- reordenação lógica
- substituição de eventos

Regra:

a única forma de evolução do histórico é pela adição de novos eventos ao final do stream.

## Leitura

A persistência deve permitir, no mínimo:

- leitura do histórico completo de um chip
- leitura parcial do histórico de um chip
- leitura em ordem lógica oficial
- leitura apta a replay pelo motor

## Concorrência

O contrato de persistência deve responder corretamente a cenários de:

- dois workers tentando gravar evento para o mesmo `chip_id`
- tentativas concorrentes de atribuição de `sequence`
- duplicação por reprocessamento do mesmo `event_id`

Regra:

nenhuma concorrência pode produzir duas `sequence` iguais para o mesmo `chip_id`.

## Integridade

As seguintes violações tornam o histórico inválido ou inconsistente:

- `sequence` repetida para o mesmo `chip_id`
- `sequence` regressiva
- `event_id` duplicado
- `chip_id` divergente dentro do mesmo stream
- evento estruturalmente incompatível com o `Contrato dos Eventos`
- quebra de append-only

## Versionamento físico

A persistência deve suportar evolução física sem alterar a semântica dos eventos.

Regra:

mudanças de armazenamento não podem alterar:

- `event_id`
- `chip_id`
- `event_type`
- `event_version`
- `sequence`
- `occurred_at`
- `recorded_at`
- `payload`

## Histórico completo vs parcial

| Tipo | Garantia |
|---|---|
| `Histórico completo` | permite replay integral e reconstrução total |
| `Histórico parcial` | permite projeção parcial, desde que essa limitação seja explícita |

Regra:

a persistência deve permitir distinguir formalmente histórico completo de histórico parcial.

## Relação com o motor

| Documento | Responsabilidade |
|---|---|
| `Contrato de Domínio` | identidade |
| `Máquina de Estados` | transições |
| `Contrato dos Eventos` | fatos |
| `Motor` | interpretação |
| `Persistência` | preservação íntegra do histórico |

## Garantias do contrato

- a persistência nunca reescreve o histórico oficial
- a persistência nunca altera a semântica do evento
- a persistência nunca cria duas `sequence` válidas para a mesma posição lógica do mesmo chip
- a persistência nunca trata projeção como fonte primária de verdade
- a persistência preserva a ordem oficial necessária ao replay

## Declaração de congelamento

Este documento está congelado como contrato de preservação do histórico oficial do chip.

## Próximos documentos

Depois deste documento, a sequência natural é:

- `API`
- `Workers`
- `Interface`
