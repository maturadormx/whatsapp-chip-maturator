# Sprint 1 — PersonaEngine + BehaviorPlanner + ContactBehaviorEngine

## Status

Proposto como especificação técnica de implementação.

Este documento define a primeira sprint real do motor de maturação como engenharia de longa duração, não como uma lista de tarefas isoladas.

## Objetivo

A Sprint 1 deve estabelecer a base arquitetural que permitirá evoluir grupos, presença, conversas e certificação sem reescrever o núcleo nas próximas sprints.

O objetivo não é apenas "adicionar contatos".

O objetivo é fazer o sistema responder, de forma consistente:

`quem é este chip, o que faz sentido ele fazer agora, e como essa ação deve parecer humana?`

## Princípio da Sprint 1

Nenhum engine decide sozinho o que fazer.

O fluxo passa a ser:

```text
PersonaEngine
        ↓
BehaviorPlanner
        ↓
ContactBehaviorEngine
```

Essa separação é obrigatória para evitar duas falhas:

- regras de decisão espalhadas entre engines
- engines executando ações incompatíveis com a persona do chip

## Arquitetura

```text
Chip
  ↓
PersonaEngine
  ↓
chip_persona
  ↓
BehaviorPlanner
  ↓
BehaviorPlan
  ↓
ContactBehaviorEngine
  ↓
contact_added / contact_edited / contact_removed
  ↓
CertificationEngine (somente leitura de sinais)
```

## Componentes

### PersonaEngine

Responsabilidade:

criar e persistir a identidade do chip.

Entrada:

- `chip`
- contexto inicial do ambiente
- regras default de persona

Saída:

- `chip_persona`

Nunca:

- adiciona contato
- edita contato
- remove contato
- cria grupo
- envia mensagem

### BehaviorPlanner

Responsabilidade:

decidir qual comportamento é esperado agora para aquela persona.

Entrada:

- `chip_persona`
- horário atual
- dia da semana
- estado atual do chip
- histórico recente de ações
- limites operacionais da sprint

Saída:

- `BehaviorPlan`

Exemplos de decisão:

- `agora é terça, 14h, rotina comercial → adicionar um contato`
- `agora é sábado, 21h → abrir chat list e ficar online por alguns minutos`
- `já adicionou contatos demais hoje → não fazer nada`

Importante:

O `BehaviorPlanner` decide **o que** faz sentido acontecer.

Os engines decidem apenas **como executar** a ação escolhida.

### ContactBehaviorEngine

Responsabilidade:

executar o plano de agenda produzido pelo `BehaviorPlanner`.

Entrada:

- `BehaviorPlan`
- `chip_persona`
- agenda atual
- contatos já conhecidos

Saída:

- agenda atualizada
- eventos comportamentais persistidos
- sinais consumíveis pelo `CertificationEngine`

## Modelo de dados

### Tabela `chip_persona`

Estrutura proposta:

```sql
chip_persona
---------------------
id
chipId
displayName
homeState
homeCity
primaryDDD
secondaryDDDs
profession
ageRange
socialProfile
wakeHour
sleepHour
weekendProfile
interests
createdAt
updatedAt
```

### Semântica

- `displayName`: nome social principal da persona
- `homeState`, `homeCity`: base geográfica
- `primaryDDD`: DDD dominante
- `secondaryDDDs`: DDDs adjacentes ou plausíveis
- `profession`: profissão coerente com grupos e contatos futuros
- `ageRange`: faixa etária
- `socialProfile`: perfil comportamental, por exemplo `extrovertido`, `reservado`, `comercial`
- `wakeHour`, `sleepHour`: limites principais de rotina
- `weekendProfile`: padrão de fim de semana
- `interests`: interesses que influenciam nomes de grupos, contatos e contextos sociais

### Exemplo

```yaml
Chip:
  mx1

Nome:
  João Henrique

Cidade:
  Volta Redonda

DDD principal:
  24

DDDs secundários:
  - 21
  - 22

Profissão:
  Representante comercial

Faixa etária:
  30–35

Interesses:
  - carros
  - futebol
  - família

Perfil:
  extrovertido

Rotina:
  trabalha 08h–18h
  responde mais à noite
  dorme 23h
```

## Tabelas futuras já previstas

Essas tabelas não precisam entrar obrigatoriamente na primeira migração da sprint, mas a arquitetura já deve prever sua existência.

### `persona_contacts_rules`

Responsável por regras derivadas da persona para agenda:

- proporção do DDD principal
- proporção de DDDs vizinhos
- proporção de capitais
- proporção de aleatórios
- categorias de nomes coerentes

### `persona_group_rules`

Responsável por contextos sociais prováveis da persona:

- família
- trabalho
- bairro
- igreja
- clientes
- futebol

### `persona_presence_rules`

Responsável por rotina de uso:

- janelas de atividade
- janelas ociosas
- padrões de fim de semana
- tolerância de repetição

## Serviços

Estrutura recomendada:

```text
server/
  maturation/
    engines/
      PersonaEngine.ts
      ContactBehaviorEngine.ts
      BehaviorPlanner.ts
    services/
      persona/
        PersonaService.ts
        PersonaRepository.ts
        PersonaFactory.ts
      contact/
        ContactBehaviorService.ts
        ContactRepository.ts
        ContactNameFactory.ts
      planner/
        BehaviorPlannerService.ts
        BehaviorPlanRepository.ts
```

## Responsabilidades por serviço

### `PersonaFactory`

Cria personas iniciais plausíveis a partir do chip.

Regras mínimas:

- gerar nome
- escolher cidade base
- definir DDD principal
- definir DDDs secundários
- profissão
- rotina
- perfil social

### `PersonaRepository`

Responsável por persistir e recuperar `chip_persona`.

### `PersonaService`

Orquestra criação, leitura e atualização controlada da persona.

### `BehaviorPlannerService`

Produz um `BehaviorPlan` para a janela atual.

Saída mínima sugerida:

```ts
type BehaviorPlan = {
  chipId: number;
  personaId: number;
  planType: "contact_behavior";
  action: "add_contact" | "edit_contact" | "remove_contact" | "noop";
  scheduledFor: Date;
  rationale: string;
  context: {
    localHour: number;
    weekday: number;
    personaMode: string;
  };
};
```

### `ContactNameFactory`

Gera nomes coerentes com a persona.

Exemplos:

- `Carlos Oficina`
- `Ana Trabalho`
- `Lucas Mercado`
- `Fernanda Escola`
- `Marcos Igreja`

### `ContactBehaviorService`

Executa o plano gerado para contatos.

### `ContactRepository`

Persiste a agenda gerada pelo maturador e seu histórico de mutações.

## Scheduler

O scheduler atual precisa mudar de semântica.

### Antes

Pergunta implícita:

`o que faço agora?`

### Depois

Pergunta obrigatória:

`segundo a persona deste chip, qual comportamento é esperado agora?`

Esse deslocamento é central. O scheduler deixa de ser um executor de tarefas genéricas e passa a ser um orquestrador de comportamento contextualizado.

## Regras do ContactBehaviorEngine

### Distribuição de DDD

Exemplo recomendado:

- `60%` DDD principal
- `25%` DDDs secundários
- `10%` capitais relacionadas
- `5%` aleatórios

O objetivo não é precisão sociológica absoluta.

O objetivo é que a agenda não pareça vazia nem artificial.

### Frequência

Não usar regra fixa como:

`3 contatos por dia`

Usar ritmo humano variável:

- segunda: `2`
- terça: `0`
- quarta: `1`
- quinta: `3`
- sexta: `0`

### Critérios de decisão

O engine deve conseguir responder:

- qual contato adicionar?
- quando adicionar?
- de qual DDD?
- qual frequência?
- esse contato faz sentido para essa persona?
- esse contato já é conhecido?
- essa ação seria repetitiva demais neste dia?

## Evidências produzidas

A Sprint 1 precisa produzir sinais úteis para o `CertificationEngine`, mesmo que ele ainda não esteja completo.

Eventos mínimos:

- `contact_added`
- `contact_edited`
- `contact_removed`

Métricas mínimas:

- `same_ddd_ratio`
- `agenda_diversity`
- `social_graph_score`
- `contact_growth_rate`

Exemplo de snapshot consumível:

```json
{
  "contact_added": 14,
  "contact_removed": 1,
  "same_ddd_ratio": 0.72,
  "agenda_diversity": 0.81
}
```

## O que não entra na Sprint 1

Não entra:

- grupos
- presença rica
- conversas
- campanhas

A Sprint 1 precisa sair limpa e autoconsistente.

## Critério de conclusão

A Sprint 1 só termina quando for possível observar:

```text
novo chip
↓
persona criada automaticamente
↓
agenda criada com base nessa persona
↓
DDD coerente
↓
nomes coerentes
↓
frequência coerente
↓
eventos gravados
↓
CertificationEngine já consegue enxergar esses sinais
```

Sem enviar uma única mensagem.

## Invariantes

- nenhum engine toma decisão sem consultar a persona
- nenhum engine executa ação fora do plano produzido pelo `BehaviorPlanner`
- a agenda nunca cresce por regra fixa espalhada no código
- `BulkDispatch` continua fora do processo de maturação
- o `CertificationEngine` é o consumidor futuro desses sinais, não o criador deles

## Impacto no projeto

Depois desta sprint, o projeto deixa de ser apenas um maturador com ações isoladas e passa a se comportar como um sistema de simulação de comportamento social.

Esse é o ponto em que a arquitetura começa a refletir o objetivo real do produto:

construir reputação e plausibilidade antes de qualquer uso comercial do chip.

## Ordem mínima de implementação

### Passo 1

Criar `chip_persona` e o contrato de persona.

### Passo 2

Criar `PersonaFactory`, `PersonaRepository` e `PersonaService`.

### Passo 3

Criar `BehaviorPlanner` como camada decisória explícita.

### Passo 4

Adaptar o motor de contatos para obedecer exclusivamente ao plano gerado.

### Passo 5

Persistir eventos e métricas de agenda de forma consumível pelo `CertificationEngine`.

## Decisão arquitetural

Se houver conflito entre rapidez de implementação e coerência da pipeline, a coerência da pipeline vence.

Essa sprint existe para impedir que grupos, presença e conversas sejam implementados sobre uma base errada.
