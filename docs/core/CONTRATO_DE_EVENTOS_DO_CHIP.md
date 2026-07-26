# Contrato dos Eventos do Chip

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

Documentos que dependem deste:

- `Motor de Estados do Chip`
- `Persistência`
- `API dos Chips`
- `Workers`
- `Interface`
- `Auditoria`

Regra de governança:

este documento define fatos de domínio, não decisões de implementação.

Nenhuma implementação deve alterar este documento.

Mudanças requerem decisão explícita de produto.

## Modelo conceitual

Este documento define os `Eventos` como a unidade fundamental de verdade do sistema.

A relação entre os artefatos do domínio é:

`Fato (Evento) -> Histórico Append-Only -> Motor de Estados -> Máquina de Estados -> Estado Derivado`

Leitura funcional:

- `Evento`: fato imutável que ocorreu na vida do chip
- `Histórico`: fonte persistente e append-only dos fatos
- `Motor de Estados`: interpreta o histórico
- `Máquina de Estados`: define transições válidas
- `Estado Derivado`: projeção atual calculada a partir do histórico

## Objetivo

Este documento define os fatos oficiais que podem ocorrer durante a vida de um `Chip`.

Eventos representam fatos imutáveis do domínio.

Eles constituem a única fonte oficial para reconstrução da linha de vida do chip.

## Princípios

- eventos são imutáveis
- eventos nunca são alterados após persistidos
- eventos podem ser adicionados, nunca modificados
- o significado de um `event_type` nunca muda
- todo evento pertence exatamente a um chip
- todo evento possui identidade única
- todo evento participa da ordem lógica oficial do chip

## Garantias semânticas

As regras abaixo nunca podem mudar sem revisão arquitetural deliberada:

- o significado de um `event_type` é estável ao longo do tempo
- alterações de schema não mudam a semântica do fato
- se a semântica mudar, nasce um novo `event_type`
- o histórico do chip é append-only
- o replay reconstrói estado apenas a partir do histórico

## Fato vs comando

Este contrato descreve fatos consumados do domínio.

Ele não descreve intenção, desejo, solicitação ou comando.

Exemplo incorreto para este documento:

- `recover_chip_requested`
- `close_chip_commanded`

Exemplo correto para este documento:

- `recovery_started`
- `chip_closed`

## Estrutura canônica

Todo evento deve conter os seguintes campos:

| Campo | Tipo | Descrição | Obrigatório |
|---|---|---|---|
| `event_id` | UUID | Identificador único do evento | sim |
| `chip_id` | UUID | Identificador do chip ao qual o evento pertence | sim |
| `event_type` | string | Tipo do evento | sim |
| `event_version` | integer | Versão do schema daquele tipo de evento | sim |
| `sequence` | integer | Ordem lógica oficial do histórico do chip | sim |
| `occurred_at` | ISO-8601 | Momento em que o fato ocorreu | sim |
| `recorded_at` | ISO-8601 | Momento em que o fato foi persistido | sim |
| `payload` | object | Dados específicos do evento | sim |
| `metadata` | object | Metadados adicionais | não |

Regra:

o schema do `payload` é definido exclusivamente por `event_type` e `event_version`.

## Semântica dos campos

- `event_id`: identifica unicamente um fato; nunca define ordem
- `chip_id`: agrega o evento a exatamente um chip
- `event_type`: nome estável do fato de domínio
- `event_version`: versão do schema daquele tipo de evento
- `sequence`: ordem lógica oficial do histórico do chip
- `occurred_at`: momento em que o fato ocorreu no mundo real
- `recorded_at`: momento em que o sistema persistiu o fato
- `payload`: estrutura definida exclusivamente por `event_type` e `event_version`
- `metadata`: correlação, causalidade e metadados de rastreamento

## Catálogo oficial de eventos

Os eventos oficiais da vida do chip são:

- `chip_created`
- `chip_paired`
- `chip_state_changed`
- `incident_opened`
- `incident_classified`
- `diagnosis_started`
- `diagnosis_finished`
- `recovery_started`
- `recovery_finished`
- `recovery_failed`
- `chip_isolated`
- `chip_state_restored`
- `chip_closed`

## Eventos oficiais

### chip_created

Significado:

o chip passou a existir como entidade identificável no sistema.

Pré-condições:

nenhuma. É o primeiro evento do chip.

Pós-condições esperadas:

chip em `CRIADO`.

Payload obrigatório:

- `created_by`
- `sprint`

### chip_paired

Significado:

o pareamento foi concluído e a identidade operacional do chip foi confirmada.

Pré-condições:

chip já criado e apto ao primeiro pareamento.

Pós-condições esperadas:

chip em `PAREADO`.

Payload obrigatório:

- `paired_with`

Payload opcional:

- `device_id`

### chip_state_changed

Significado:

o chip mudou de estado fora do fluxo de incidente.

Pré-condições:

transição válida na máquina de estados.

Pós-condições esperadas:

estado derivado atualizado.

Payload obrigatório:

- `from_state`
- `to_state`
- `trigger`

Payload opcional:

- `reason`

### incident_opened

Significado:

um incidente foi aberto para o chip.

Pré-condições:

chip em estado compatível com abertura de incidente.

Pós-condições esperadas:

chip em `INCIDENTE` com preservação de `previous_state`.

Payload obrigatório:

- `previous_state`
- `incident_class`
- `incident_origin`

Payload opcional:

- `trigger_event`

### incident_classified

Significado:

o incidente foi classificado com maior precisão.

Pré-condições:

incidente previamente aberto.

Pós-condições esperadas:

incidente enriquecido com severidade e detalhe.

Payload obrigatório:

- `incident_id`
- `incident_class`
- `severity`

Payload opcional:

- `sub_classification`

### diagnosis_started

Significado:

o diagnóstico do incidente foi iniciado.

Pré-condições:

incidente aberto.

Pós-condições esperadas:

chip em `DIAGNOSTICO`.

Payload obrigatório:

- `incident_id`

Payload opcional:

- `method`

### diagnosis_finished

Significado:

o diagnóstico foi concluído.

Pré-condições:

diagnóstico iniciado.

Pós-condições esperadas:

chip apto a entrar em `RECUPERACAO`.

Payload obrigatório:

- `incident_id`
- `finding`

Payload opcional:

- `recommended_action`

### recovery_started

Significado:

uma tentativa formal de recuperação foi iniciada.

Pré-condições:

diagnóstico concluído.

Pós-condições esperadas:

chip em `RECUPERACAO`.

Payload obrigatório:

- `incident_id`
- `action`
- `attempt`

### recovery_finished

Significado:

a recuperação foi concluída com sucesso.

Pré-condições:

recuperação iniciada.

Pós-condições esperadas:

restauração do `previous_state`.

Payload obrigatório:

- `incident_id`
- `restored_state`

Payload opcional:

- `duration_ms`

### recovery_failed

Significado:

a recuperação falhou.

Pré-condições:

recuperação iniciada.

Pós-condições esperadas:

encaminhamento para `ISOLADO` por evento posterior compatível.

Payload obrigatório:

- `incident_id`
- `reason`
- `attempts`

### chip_isolated

Significado:

o chip foi colocado em isolamento, aguardando operador.

Pré-condições:

falha de recuperação ou quebra de continuidade.

Pós-condições esperadas:

chip em `ISOLADO`.

Payload obrigatório:

- `reason`

Payload opcional:

- `previous_state`

### chip_state_restored

Significado:

o estado do chip foi explicitamente restaurado após incidente.

Pré-condições:

recuperação concluída com sucesso.

Pós-condições esperadas:

retorno ao `previous_state`.

Payload obrigatório:

- `restored_state`
- `incident_id`

### chip_closed

Significado:

a vida do chip foi encerrada definitivamente.

Pré-condições:

chip existente.

Pós-condições esperadas:

chip em `ENCERRADO`.

Payload obrigatório:

- `reason`
- `closed_by`

Payload opcional:

- `final_state`

## Versionamento

Regras de versionamento:

- um `event_type` nunca muda de significado
- mudanças incompatíveis geram nova `event_version`
- mudanças compatíveis preservam leitura anterior
- replay deve funcionar independentemente da versão

## Ordem lógica

Definições:

- `sequence`: número inteiro monotônico do histórico daquele chip
- ordem lógica: definida por `sequence`, nunca por timestamps

Regras:

- `sequence` é monotônica e única por `chip_id`
- não existe garantia de ordenação global entre chips distintos
- o replay utiliza `sequence` como ordem oficial
- `occurred_at` e `recorded_at` são metadados, não determinantes de ordem
- dois eventos com a mesma `sequence` para o mesmo `chip_id` são proibidos

Responsabilidade:

este contrato define que cada evento possui uma `sequence` única e monotônica dentro do histórico do seu `chip_id`.

A materialização dessa garantia pertence à camada de `Persistência`.

O motor apenas consome a ordem já garantida.

## Idempotência

Regras:

- `event_id` identifica unicamente um fato
- `event_id` nunca pode ser reutilizado
- reprocessar o mesmo `event_id` nunca altera o resultado
- eventos duplicados são reconhecidos pela identidade e ignorados

## Correlação e causalidade

Campos opcionais em `metadata`:

- `correlation_id`: agrupa eventos relacionados à mesma cadeia operacional
- `causation_id`: identifica o evento imediatamente causador

## Classes de incidente

Classes oficiais:

- `AUTENTICACAO`
- `SESSAO`
- `REDE`
- `ARMAZENAMENTO`
- `PROCESSO`
- `CONFIGURACAO`
- `DESCONHECIDO`

## Origens de incidente

Origens oficiais:

- `WHATSAPP`
- `SISTEMA`
- `BANCO`
- `OPERADOR`
- `INFRAESTRUTURA`
- `INTERNA`

## Replay

Replay é o processo de reconstrução do estado derivado mediante reaplicação integral do histórico de eventos em ordem lógica.

Regra:

nenhuma projeção persistida participa desse processo.

## Evento inválido vs evento desconhecido

### Evento inválido

O `event_type` existe e o schema é conhecido, mas o fato quebra regra de domínio ou pré-condição.

Exemplo:

`recovery_finished` sem `recovery_started`.

### Evento desconhecido

O `event_type` não existe neste contrato.

Exemplo:

`chip_magic`.

Regra:

o tratamento de evento inválido ou desconhecido não pertence a este contrato.

Essa decisão pertence à camada de ingestão e persistência.

## Compatibilidade retroativa

Regras:

- eventos antigos continuam válidos
- replay de históricos antigos deve continuar produzindo o mesmo estado
- nenhum `event_type` pode ser removido sem migração explícita
- a evolução não pode quebrar a leitura de versões anteriores

## Garantias do contrato

- todo evento possui identidade única
- todo evento pertence exatamente a um chip
- o significado de um evento nunca muda
- o histórico é append-only
- o replay é determinístico
- a ordem lógica prevalece sobre timestamps
- eventos duplicados são reconhecidos e ignorados
- o histórico nunca depende do estado derivado para existir

## Relação com a máquina de estados

| Documento | Responsabilidade |
|---|---|
| `Contrato de Domínio` | identidade e invariantes |
| `Máquina de Estados` | estados e transições |
| `Contrato dos Eventos` | fatos, schema e metadados |
| `Motor de Estados` | aplicação determinística dos eventos |
| `Persistência` | armazenamento e ordenação oficial |

## Status atual

Este documento está congelado como contrato normativo do `Core do Produto`.

Próximo documento:

`Motor de Estados do Chip`
