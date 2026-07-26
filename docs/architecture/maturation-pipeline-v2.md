# Maturation Pipeline v2

## Status

Proposto como arquitetura-alvo do motor de maturação.

Este documento complementa a baseline arquitetural e detalha como o projeto deve evoluir de um conjunto de automações operacionais para uma pipeline coerente de comportamento humano simulado.

## Objetivo

O projeto não deve responder apenas à pergunta:

`o sistema consegue enviar mensagens?`

Ele deve responder, antes disso:

`este chip se comporta como uma pessoa plausível usando WhatsApp?`

O foco principal deixa de ser volume de envio e passa a ser coerência social, ritmo humano, diversidade de ações, memória comportamental e aprovação explícita para uso em campanhas.

## Pipeline

```text
PersonaEngine
       ↓
ContactBehaviorEngine
       ↓
GroupBehaviorEngine
       ↓
PresenceBehaviorEngine
       ↓
ConversationBehaviorEngine
       ↓
CertificationEngine
       ↓
BulkDispatch
```

## Regra fundamental

Toda ação executada pelo chip deve responder à pergunta:

`isso faz sentido para a persona dele?`

Se a resposta for `não`, a ação não deve acontecer.

Essa regra impede que o motor vire uma sequência aleatória de automações e garante coerência entre agenda, grupos, presença, conversas e certificação.

## Fronteiras

### Maturação

A maturação existe para construir sinais sociais plausíveis:

- identidade
- agenda
- grupos
- presença
- leitura
- observação
- inbound
- respostas espaçadas
- diversidade comportamental

### Campanhas

Campanhas existem para usar chips já aprovados:

- fila
- ACK
- retries
- throughput
- metas comerciais

`BulkDispatch` não participa da maturação. Ele apenas consome chips aprovados pelo `CertificationEngine`.

## Engines

### PersonaEngine

Responsabilidade única:

criar e manter a identidade base do chip.

Entrada:

`chip`

Saída:

`chip_persona`

Nunca:

- adiciona contato
- cria grupo
- altera presença
- envia mensagem

Ele só cria contexto para as outras engines.

### ContactBehaviorEngine

Responsabilidade única:

construir e manter uma agenda coerente com a persona.

Entrada:

- `chip_persona`
- histórico de contatos já adicionados
- sinais do `CertificationEngine`

Saída:

- contatos adicionados
- contatos editados
- contatos removidos
- métricas de coerência social da agenda

Regras:

- a agenda não cresce em ritmo fixo
- a distribuição de DDDs deve parecer plausível
- nomes precisam parecer humanos e coerentes com o contexto do chip

Distribuição inicial recomendada:

- `60%` DDD principal
- `20%` DDDs vizinhos
- `15%` capitais
- `5%` aleatórios

### GroupBehaviorEngine

Responsabilidade única:

construir sinais de sociabilidade em grupos.

Entrada:

- `chip_persona`
- agenda já existente
- convites disponíveis
- grupos próprios do sistema

Saída:

- grupos criados
- grupos ingressados
- grupos abandonados
- alterações de nome/foto/descrição quando fizer sentido

Ordem de prioridade:

1. grupos próprios entre chips do sistema
2. convites enviados manualmente
3. lista curada de grupos de teste
4. links públicos apenas se houver justificativa operacional

### PresenceBehaviorEngine

Responsabilidade única:

simular uso passivo plausível.

Entrada:

- `chip_persona`
- rotina esperada
- estado atual do chip
- memória social recente

Saída:

- online/offline
- abrir lista de chats
- abrir grupo
- ver status
- digitar sem enviar
- ficar ocioso
- fechar sessão de uso

Esse engine pode produzir sinais humanos fortes sem enviar nenhuma mensagem.

### ConversationBehaviorEngine

Responsabilidade única:

produzir respostas e interações conversacionais coerentes com a persona e com o contexto social do chip.

Entrada:

- `chip_persona`
- inbound recente
- memória de conversas
- contexto de grupo ou contato

Saída:

- respostas curtas
- reações
- compartilhamento ocasional de contato ou mídia
- iniciativas raras e justificadas

Regra inicial:

- `80%` comportamento reativo
- `20%` comportamento proativo

Mesmo no comportamento proativo, o padrão deve ser curto e plausível.

### CertificationEngine

Responsabilidade única:

responder se o chip já pode executar ações mais arriscadas, especialmente campanhas.

Entrada:

- identidade
- agenda
- grupos
- presença
- inbound
- conversas
- saúde operacional
- risco
- diversidade comportamental

Saída:

estágio explícito do chip:

```text
BEBÊ
INICIANDO
MATURANDO
OPERACIONAL
APROVADO
```

Também deve responder a perguntas como:

```ts
certification.canExecute("send_campaign")
```

O `CertificationEngine` não cria comportamento. Ele apenas lê evidências.

## Modelo de dados

### `chip_persona`

Tabela proposta para persistir identidade do chip:

```sql
chip_persona

id
chip_id
name
age_range
gender
city
state
primary_ddd
profession
routine_type
interests
relationship_profile
activity_level
created_at
updated_at
```

Essa tabela deve mudar pouco. Ela representa quem o chip parece ser e serve como base de todas as decisões futuras.

### Exemplo de persona

```yaml
Nome:
  Carlos Henrique

DDD:
  23

Cidade:
  Campos

Profissão:
  Mecânico

Rotina:
  Comercial

Uso:
  Médio

Interesses:
  - carros
  - futebol
  - família
  - oficina
```

## Evidências

Cada engine precisa gerar sinais claros para o `CertificationEngine`.

### ContactBehaviorEngine

Eventos esperados:

- `contact_added`
- `contact_edited`
- `contact_removed`

Métricas esperadas:

- `same_ddd_ratio`
- `agenda_diversity`
- `social_graph_score`

### GroupBehaviorEngine

Eventos esperados:

- `group_created`
- `group_joined`
- `group_left`
- `group_subject_updated`
- `group_photo_updated`

### PresenceBehaviorEngine

Eventos esperados:

- `wake_up`
- `idle`
- `sleep`
- `chat_list_opened`
- `status_viewed`
- `group_opened`
- `presence_online`
- `presence_offline`
- `typing_started`
- `typing_aborted`

### ConversationBehaviorEngine

Eventos esperados:

- `message_received`
- `message_sent`
- `message_replied`
- `reaction_sent`
- `media_forwarded`
- `contact_shared`

## Integração com o estado atual

### O que já existe hoje

O projeto já possui uma base útil para a pipeline:

- infraestrutura operacional estável
- reboot validado
- `passiveBehaviorEngine` rodando no boot
- atualização de `nome`
- atualização de `bio`
- sincronização de contatos da sessão
- sinais passivos como `wake_up`, `idle`, `sleep`, `chat_list_opened`, `status_viewed`
- `CertificationEngine` parcial espalhado no estado operacional atual

### O que já existe como capability, mas ainda não entra no ciclo passivo

- atualização de foto de perfil

### O que ainda é lacuna funcional

- `chip_persona` persistida
- agenda CRUD real
- geração inteligente de contatos por DDD
- motor de grupos coerente por contexto
- presença mais rica baseada em rotina
- conversação reativa com memória social
- `CertificationEngine` explícito como engine isolado

## Estrutura sugerida

```text
server/
  maturation/
    engines/
      persona/
        PersonaEngine.ts
      contact/
        ContactBehaviorEngine.ts
      group/
        GroupBehaviorEngine.ts
      presence/
        PresenceBehaviorEngine.ts
      conversation/
        ConversationBehaviorEngine.ts
      certification/
        CertificationEngine.ts
    models/
      Persona.ts
    services/
    schedulers/
    scoring/
```

Cada engine deve ser:

- isolado
- testável
- observável
- reutilizável

## Sprint 1

### Escopo

Sprint inicial recomendada:

- `PersonaEngine`
- `ContactBehaviorEngine`

### O que entra

#### PersonaEngine

- geração da persona inicial
- persistência em `chip_persona`
- regras mínimas de coerência por cidade, DDD e rotina

#### ContactBehaviorEngine

- agenda baseada em persona
- distribuição de DDD plausível
- nomes coerentes com contexto
- crescimento em ritmo humano
- eventos `contact_added`, `contact_edited`, `contact_removed`
- primeiras métricas consumíveis pelo `CertificationEngine`

### O que não entra

- grupos
- presença rica
- conversas
- campanhas

### Critério de conclusão

A Sprint 1 só termina quando for possível observar:

```text
novo chip
↓
persona criada
↓
agenda criada automaticamente
↓
DDD coerente
↓
nomes coerentes
↓
agenda cresce em ritmo humano
↓
eventos gravados
↓
CertificationEngine já enxerga esses sinais
```

Sem enviar uma única mensagem.

## Invariantes

- `BulkDispatch` nunca altera maturidade
- `CertificationEngine` é a única verdade para liberação de campanhas
- nenhuma ação deve acontecer sem coerência com a persona
- nenhum engine deve assumir comportamento fixo por dia
- agenda, grupos, presença e conversas precisam contar a mesma história social

## Próximos ciclos

### Sprint 2

- `GroupBehaviorEngine`

### Sprint 3

- `PresenceBehaviorEngine`

### Sprint 4

- `ConversationBehaviorEngine`

### Sprint 5

- `CertificationEngine` explícito

### Depois

- adaptação final do `BulkDispatch` para consumir exclusivamente chips aprovados

## Decisão operacional

Até a pipeline de maturação estar completa, qualquer ajuste nessa frente deve ser tratado como:

`lacuna estrutural do motor de maturação`

e não como expansão do módulo de campanhas.
