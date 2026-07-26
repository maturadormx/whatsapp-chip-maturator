# ADR-002 — Maturação orientada a memória, identidade e contexto

## Status

Planejado

## Contexto

O maior risco atual do sistema não está apenas na arquitetura de leitura e materialização. O risco central está na própria lógica de maturação.

O cenário operacional mudou. Antes, um chip novo suportava dias de maturação repetitiva. Hoje, um chip novo pode ser restringido após uma única mensagem quando o padrão de uso parece automatizado. Isso desloca o problema principal de volume e frequência para naturalidade, previsibilidade e coerência do comportamento.

Em outras palavras, o risco não pode mais ser entendido apenas como:

`50 mensagens = risco`

O critério observado se aproxima mais de:

`esse usuário parece um robô?`

Por isso, delays aleatórios sobre um roteiro fixo deixaram de ser defesa suficiente. Um fluxo previsível continua sendo um padrão. E padrão repetível continua sendo risco.

Antes de definir quem o chip é, o sistema precisa lembrar o que ele já fez. Sem memória comportamental, qualquer tentativa futura de identidade tende a ser uma configuração estática. Com memória, a identidade pode emergir do histórico e não apenas de um perfil arbitrário.

## Decisão

A evolução da maturação deixa de ser guiada por fluxos fixos por fase e passa a ser guiada por memória, identidade, histórico, contexto e diversidade comportamental. Mas o maior risco desta fase deixou de ser técnico e passou a ser arquitetural: ligar componentes novos cedo demais.

Por isso, o próximo fechamento obrigatório é da camada de evidências. Antes disso:

- `Identity Engine` ainda não existe como engine decisório
- a etapa atual de identidade deve ser tratada como `Identity Snapshot Generator`
- `Behavior Engine` não recebe nenhuma integração nova
- a prioridade passa a ser rastreabilidade, versionamento e cobertura da evidência

O modelo de runtime imediato passa a convergir para o pipeline abaixo:

```text
WhatsApp Runtime
        │
        ▼
Evidence Engine
        │
        ▼
Evidence Normalizer
        │
        ▼
Evidence Catalog
        │
        ▼
Episode Builder
        │
        ▼
Behavior Memory
        │
        ▼
Identity Snapshot Generator
        │
        ▼
Identity Snapshot (somente leitura)
        │
        ▼
Behavior Engine (futuro)
```

Essa decisão substitui o princípio implícito:

`estado = executa fluxo`

por um princípio mais sólido:

`estado + evidência rastreável + memória episódica + identidade observada = base para futura decisão`

Regra obrigatória da arquitetura:

`nenhuma regra de decisão pode consumir behavior_timeline diretamente`

Toda decisão futura deve consumir apenas evidências normalizadas e classificadas.

Regra adicional obrigatória:

`nenhum componente acima do Episode Builder pode conhecer eventos do WhatsApp`

Ou seja, `Behavior Memory`, `Identity Engine` e `Behavior Engine` não podem conhecer `message_received`, `messages.upsert`, `groupAcceptInvite` ou qualquer detalhe do provedor. Acima dessa fronteira, o sistema só pode falar em `Evidence`, `Catalog`, `Episode`, `Memory` e `Score`.

## Princípios

### Evidence Engine

Responsável apenas por registrar fatos verificáveis.

Produz:

- `sessions`
- `activity_logs`
- `behavior_timeline`

Não decide comportamento.

### Evidence Normalizer

Responsável por transformar fatos crus em evidência comportamental utilizável.

Seu papel é impedir contaminação semântica da memória. Um evento bruto como `message_sent` pode significar resposta espontânea, ação de maturação, campanha, teste interno ou recuperação de fila. Esses casos não podem ser tratados como equivalentes.

Cada evidência normalizada deve carregar:

- `confidence`
- `normalizerVersion`
- rastro mínimo do evento bruto de origem

Exemplo de saída normalizada:

```json
{
  "origin": "maturation",
  "direction": "outgoing",
  "type": "greeting",
  "conversationAge": "2 days",
  "hourBucket": "morning",
  "responseDelay": "18 min",
  "initiatedBy": "chip"
}
```

Sem essa camada, o `Behavior Memory` aprende padrões errados.

### Evidence Catalog

Responsável por classificar a evidência normalizada em tipos de evidência independentes dos eventos do WhatsApp.

Cada evidência catalogada deve carregar:

- `catalogVersion`
- classe comportamental independente do provedor

Exemplos de catálogo:

- `HUMAN_REPLY`
- `HUMAN_INITIATED_CONVERSATION`
- `GROUP_INTERACTION`
- `STATUS_INTERACTION`
- `PROFILE_ACTIVITY`
- `SOCIAL_DISCOVERY`
- `PASSIVE_ACTIVITY`
- `ACTIVE_ACTIVITY`

O `Evidence Normalizer` interpreta um evento. O `Evidence Catalog` classifica o significado comportamental dessa interpretação.

### Episode Builder

Responsável por transformar evidência já normalizada e catalogada em episódios comportamentais coerentes.

Sua responsabilidade é explícita e própria. O sistema deve ter um serviço dedicado, `episodeBuilderService.ts`, para regras como:

- `message_received` → espera → `message_sent` → `ack` = `Conversation Episode`
- `status_viewed` → `profile_photo_updated` = `Discovery Episode`

O `Behavior Memory` nunca deve receber eventos soltos. Ele recebe apenas episódios.

### Behavior Memory

Responsável por consolidar episódios já normalizados e catalogados em memória comportamental utilizável.

Mantém, entre outros sinais:

- episódios recentes
- horários recorrentes
- tempos de resposta
- sequências repetidas
- blocos de inatividade
- padrões excessivamente previsíveis
- variação entre dias e janelas
- origens comportamentais dominantes
- resultados recorrentes dos episódios

Sem essa camada, o sistema só randomiza. Com essa camada, o sistema aprende o que evitar repetir.

### Identity Snapshot Generator

Responsável por gerar uma fotografia explicável de quem o chip parece ser naquele momento.

Produz `IdentitySnapshot` read-only com dimensões contínuas como:

- `communicationStyle`
- `activityRhythm`
- `socialExposure`
- `initiativeProfile`
- `responsiveness`
- `diversity`
- `predictability`

A identidade futura deve ser alimentada pela memória comportamental acumulada. Nesta fase, porém, ela ainda não existe como engine. Existe apenas como snapshot observável, explicável e auditável.

Cada dimensão deve expor episódios de suporte, episódios de contradição, `confidence`, `stability`, `maturity` e `drift`.

### Strategy Engine

Responsável por modular identidade e contexto em janelas temporais.

Exemplos:

- socializar mais nesta semana
- reduzir exposição por alguns dias
- priorizar observação
- responder mais e iniciar menos

Seu papel é impedir que identidade vire rigidez. A memória informa o que já aconteceu. A identidade define a tendência dominante. A estratégia define a inclinação do momento.

### Behavior Planner

Responsável por transformar intenção comportamental em plano executável orientado a oportunidade.

Decidir `responder` é diferente de decidir:

- responder agora
- esperar alguns minutos
- usar áudio
- usar texto
- reagir com emoji
- aguardar outra mensagem
- não agir

Seu papel é planejar tempo, formato e oportunidade antes da execução.

Quando essa camada for evoluída, ela deve separar três conceitos:

- `Opportunity Detection`
- `Opportunity Evaluation`
- `Opportunity Planning`

Detectar oportunidade não significa agir. O sistema deve poder concluir que existe oportunidade, avaliar que não vale interagir agora e então planejar `do_nothing`.

### Execution Engine

Responsável por transformar a intenção em ato executável.

Executa:

- abrir conversa
- visualizar status
- entrar em grupo
- responder
- aguardar
- não fazer nada

`não fazer nada` passa a ser uma ação válida do sistema. Inatividade deliberada é parte do comportamento humano e não pode ser tratada como ausência de plano.

## Ciclo comportamental futuro

O fluxo alvo deixa de ser linear e passa a ser cíclico:

```text
Evidence
      ↓
Evidence Normalizer
      ↓
Evidence Catalog
      ↓
Behavior Memory
      ↓
Identity Snapshot
      ↓
Strategy
      ↓
Behavior
      ↓
Execution
      ↓
Evidence
```

Esse ciclo é mais próximo de comportamento humano do que um fluxo fixo diário.

## Estrutura mínima do Behavior Memory

A primeira versão do `Behavior Memory` deve guardar persistência suficiente para impedir repetição previsível, sem ainda alterar a lógica atual de maturação.

Estrutura conceitual mínima:

- `behavior_memory`
- janela de `30 dias`
- episódios comportamentais
- horários
- ritmo
- sequências
- repetições
- diversidade
- blocos de inatividade

## Episódios em vez de eventos

O `Behavior Memory` não deve guardar eventos crus da timeline como unidade principal de aprendizado.

Ao invés de:

```text
09:00 message_sent
09:05 message_received
09:06 message_read
09:07 message_sent
```

deve guardar episódios:

```text
Conversation Episode

início: 09:00
fim: 09:07
ações: 4
iniciado_por: chip
respondeu: sim
tempo_resposta: 5 minutos
resultado: conversa continuou
```

Episódios preservam contexto, causalidade e desfecho. Isso é mais útil para memória, estratégia e identidade do que a simples repetição de eventos atômicos.

Nem todo episódio é uma conversa. Tipos esperados:

- `Conversation Episode`
- `Status Episode`
- `Discovery Episode`
- `Group Episode`
- `Passive Episode`
- `Media Episode`

Antes de decidir, o `Behavior Engine` deve consultar essa memória para evitar repetir:

- a mesma sequência de ações
- o mesmo horário de ativação
- a mesma cadência de presença
- o mesmo tipo de interação em dias consecutivos

Exemplos de objetivo imediato:

- se ontem o chip abriu conversa às `08:13`, respondeu às `08:22`, entrou em grupo às `09:05` e viu status às `09:11`, hoje a mesma sequência não deve ser reproduzida
- se na semana passada o chip sempre começou às `08h`, a semana seguinte deve deslocar as janelas para horários diferentes
- se o padrão de resposta ficou preso em `40 segundos`, os próximos tempos devem variar de forma coerente e não apenas randômica

## Evidence Quality

Além de `Human Score` e `Risk Score`, o `Operational Engine` deve convergir para uma terceira métrica:

- `Evidence Quality`

Essa métrica deve ser explicável por dimensões:

- `Naturalness`
- `Diversity`
- `Consistency`
- `Social Presence`

O score geral é derivado dessas quatro leituras.

Exemplos:

- `Naturalness`: horários humanos, tempos de resposta, pausas, ritmo
- `Diversity`: tipos de ação, grupos, contatos, mídia, status
- `Consistency`: repetição saudável, rotina, estabilidade
- `Social Presence`: recebe mensagens, responde, entra em grupos, participa, visualiza status

Exemplo conceitual:

- Chip A: `50 mensagens`, `1 contato`, sempre às `10h`
- Chip B: `15 mensagens`, `6 contatos`, `3 grupos`, status, leituras, horários variados, dias variados

Os dois podem parecer humanos. Mas o segundo produz evidências muito mais convincentes.

O objetivo da maturação deixa de ser maximizar mensagens. O objetivo passa a ser produzir evidência humana rica, variada e coerente.

## Evidence Coverage

`Evidence Coverage` é uma métrica separada de `Evidence Quality`.

Ela responde não se a evidência é boa, mas se ela cobre o suficiente do comportamento observado na janela analisada.

Leitura mínima esperada:

- `messages`
- `status`
- `groups`
- `profile`
- `passivity`
- `presence`

Exemplo:

- `Naturalness = 95`
- `Diversity = 90`
- `Coverage = 18%`

Isso significa: as evidências observadas são boas, mas ainda insuficientes para conclusões fortes.

## Identidade baseada em composição

A primeira versão da camada de identidade não deve nascer como engine. Ela deve nascer como `IdentitySnapshot` observável, com composição de dimensões contínuas.

Dimensões iniciais esperadas:

- `Communication Style`
- `Routine`
- `Social Profile`
- `Activity Profile`
- `Risk Tolerance`

Exemplo de composição:

- `Communication`: `reserved`
- `Routine`: `late_night`
- `Social`: `group_oriented`
- `Activity`: `passive`
- `Risk`: `low`

Essa composição cria variedade real sem exigir centenas de perfis fixos. Só depois de memória suficiente acumulada o sistema deve evoluir para adaptação automática.

## Exemplos de identidade

Chips em mesma fase não devem agir de forma parecida só porque compartilham estado operacional.

Exemplos:

### Chip A — Curioso

- entra muito em grupos
- vê muitos status
- escreve pouco
- recebe bastante

### Chip B — Conversador

- fala bastante
- quase não vê status
- não entra em grupo

### Chip C — Observador

- só lê
- quase nunca envia
- só envia depois de dias

Todos podem estar em `EM_MATURACAO`. Nenhum deve maturar da mesma forma.

## Critério de pronto da camada de evidências

Antes de tocar no `Behavior Engine`, o sistema precisa conseguir responder, para qualquer episódio ou leitura:

1. de quais eventos brutos esse resultado foi derivado
2. qual foi a sequência de normalização, catalogação e agrupamento em episódio
3. qual a `confidence` das evidências envolvidas
4. qual a `Evidence Coverage` disponível para o chip naquela janela
5. quais versões de `Normalizer` e `Catalog` geraram esse resultado

Se essas cinco respostas existirem de forma consistente, a camada de evidências está pronta.

## Consequências

O `Behavior Engine` deixa de ser tratado como engine de fluxo e passa a ser tratado como engine de decisão.

O sistema deixa de perguntar apenas `qual ação vem agora?` e passa a perguntar `qual comportamento faz sentido agora para esta identidade, neste contexto, evitando repetir um padrão reconhecível?`

A orientação principal deixa de ser ação e passa a ser oportunidade.

Em vez de pensar `qual ação devo executar agora?`, o sistema passa a pensar `existe uma oportunidade natural de interação agora?`

Se não existir oportunidade, a resposta correta pode ser `não agir`.

Isso torna impossível usar como base um roteiro diário do tipo:

```text
Dia 1 → abre conversa → entra em grupo → vê status → manda oi
Dia 2 → vê status → abre grupo → responde mensagem
Dia 3 → ...
```

Mesmo com delays aleatórios, isso continua sendo roteiro. E roteiro continua sendo padrão.

## Ordem de prioridade

As próximas fases devem seguir esta ordem:

1. finalizar a separação arquitetural com `OperationalMaterializationService`
2. blindar a regra com testes de regressão
3. criar um `Evidence Normalizer` antes de alimentar a memória
4. criar um `Evidence Catalog` para classificar a evidência normalizada
5. criar um `Episode Builder` explícito antes de alimentar o `Behavior Memory`
6. adicionar `confidence`, `normalizerVersion` e `catalogVersion` às evidências e episódios
7. introduzir `Evidence Quality` como nova métrica do `Operational Engine`, com dimensões explicáveis
8. introduzir `Evidence Coverage` como leitura independente
9. introduzir `Identity Snapshot Generator` em modo somente leitura
10. só depois conectar `Identity Snapshot` ao `Strategy Engine` e então evoluir o restante da cadeia de decisão

## Objetivo final

Dois chips iniciados no mesmo dia devem poder evoluir de maneiras significativamente diferentes, com ritmos, sequências, horários e períodos de inatividade distintos.

O objetivo não é adicionar aleatoriedade a um roteiro fixo. O objetivo é aproximar o sistema de um uso humano coerente, diverso e difícil de reduzir a um padrão automatizado.
