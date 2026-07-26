# Behavior Timeline MVP

Primeiro passo prático para provar a base observável do chip com dados reais do Baileys, antes de construir `Evidence Normalizer`, `Behavior Memory`, `Behavior Engine`, `Human Score`, `Risk Score`, `Evidence Quality` e `Mission Control`.

## Objetivo

Observar `1 chip real` por `24–48h` e registrar apenas eventos verificáveis que o stack atual realmente consegue sustentar.

## Eventos do MVP

| Evento | Origem real | Prova |
| --- | --- | --- |
| `message_sent` | `sendMessage()` | retorno com `messageId` |
| `message_acknowledged` | retorno do `sendMessage()` | `ackType=provider_accepted` |
| `message_received` | `messages.upsert` | mensagem inbound com `remoteJid` e `messageId` |
| `group_joined` | `groupAcceptInvite()` | retorno do grupo + metadata |
| `messages_read` | `readMessages()` | chamada explícita com chaves lidas |

## Store da Timeline

Tabela dedicada: `behavior_timeline_events`

Campos principais:

- `eventType`: tipo semântico do evento
- `source`: chamada/hook real que gerou o evento
- `direction`: `inbound`, `outbound` ou `system`
- `remoteJid`: conversa remota observada
- `remoteType`: `number`, `group`, `broadcast` ou `unknown`
- `remoteLabel`: número ou nome mais legível para inspeção
- `messageId`: identificador da mensagem quando existir
- `relatedMessageId`: vínculo com outro evento da mesma mensagem
- `ackType`: tipo de confirmação
- `groupJid` e `groupSubject`: contexto de grupo
- `contentPreview`: preview curto do conteúdo
- `payload`: evidência bruta serializada
- `occurredAt`: timestamp do fato

## Leitura recomendada

Se a Timeline ficar estável por alguns dias, ela já permite derivar depois:

- volume de envio vs. recebimento
- alternância de conversas
- distribuição de atividade ao longo do dia
- participação em grupos
- blocos de inatividade

Só depois disso faz sentido subir para Score.

## Limite proposital do MVP

`behavior_timeline_events` é um store de fatos brutos. Ele não deve ser usado diretamente como memória comportamental.

Antes de alimentar `Behavior Memory`, o projeto deve introduzir uma camada de `Evidence Normalizer` para distinguir origem, contexto e intenção prática de cada evento. A unidade posterior de memória também não deve ser o evento isolado, e sim episódios comportamentais reconstruídos a partir desses fatos.
