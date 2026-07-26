# Arquitetura do projeto de maturação de WhatsApp

## Visão geral

O projeto `whatsapp-chip-maturator` é um monólito modular full-stack voltado para operação real de chips WhatsApp, com dois domínios de negócio principais já consolidados:

- `Maturação`
- `Marketing / Disparo`

Além disso, existe uma camada administrativa forte para operação, billing, auditoria e monitoramento.

## Governança arquitetural

A arquitetura do sistema é governada pelos ADRs em `docs/adr/`.

Documentos de referência:

- `ADR-001` — Materialização do Estado Operacional
- `ADR-002` — Maturação orientada a memória, identidade e contexto
- `ADR-003` — Shadow Mode da Pipeline de Evidências
- `ADR-004` — Identity Observability com Identity Snapshot Generator
- `ADR-005` — Learning Engine como camada de hipóteses e conhecimento
- `ADR-006` — Knowledge Base e Hypothesis Model
- `docs/architecture/pipeline-health-dashboard-shadow-mode.md`
- `docs/architecture/risk-model-operacional.md`
- `docs/architecture/strategy-engine-especificacao-tecnica.md`
- `docs/architecture/digital-credibility-model.md`
- `docs/architecture/platform-vocabulary-and-invariants.md`
- `docs/architecture/platform-health-metrics.md`
- `docs/architecture/behavior-sandbox-replay.md`
- `docs/architecture/behavior-observability-signals.md`
- `docs/architecture/ground-truth-and-validation.md`
- `docs/architecture/longitudinal-learning-foundation.md`
- `docs/architecture/social-trajectories-and-silence-intelligence.md`
- `docs/architecture/adaptive-intelligence-phase.md`
- `docs/architecture/fleet-learning-phase.md`

Todo refinamento estrutural relevante deve partir desses registros antes de alterar serviços, routers, heartbeat ou comportamento da interface.

Contratos públicos reutilizáveis e envelopes transversais ficam centralizados em `server/contracts/`.

Em termos de produto, a identidade que apareceu no histórico do projeto foi:

- marca: `M13 GROUP`
- produto: `W.M.S.E`

O desenho atual já não é de MVP simples. Ele está estruturado como uma plataforma operacional com:

- frontend React premium
- backend Node com tRPC
- MySQL com Drizzle
- integração real com WhatsApp via `baileys`
- schedulers automáticos
- gestão de usuários, planos e auditoria

## Objetivo do sistema

O sistema foi construído para operar chips de WhatsApp em duas frentes complementares:

1. `Maturação`
   - aquecer chips com comportamento controlado e humanizado
   - diferenciar alvo individual e grupo
   - aplicar ritmo, rotação, cooldown e regras operacionais

2. `Marketing`
   - disparar campanhas com distribuição entre múltiplos chips
   - usar rotação, retry, supressão e score de risco
   - manter analytics por campanha, por chip e por execução

O sistema não é apenas um dashboard. Ele já possui camada de execução contínua.

No desenho arquitetural mais recente, o objetivo de longo prazo da plataforma deixa de ser apenas maturar ou disparar com segurança operacional. O alvo passa a ser:

`maximizar a credibilidade digital do chip enquanto minimiza exposição ao risco`

No desenho mais recente, a maturação deixa de perseguir volume de mensagens e passa a perseguir produção de evidências humanas variadas e coerentes. Isso implica os princípios abaixo:

- `behavior_timeline` continua sendo evidência bruta, não memória
- nenhuma regra de decisão pode consumir `behavior_timeline` diretamente
- `Evidence Normalizer` deve atribuir `confidence` e `normalizerVersion` para cada evidência
- `Evidence Catalog` deve atribuir `catalogVersion` e semântica comportamental independente do WhatsApp
- `Episode Builder` deve ser o primeiro ponto autorizado a agrupar evidências em episódios
- `Behavior Memory` deve ser alimentado apenas por episódios, nunca por eventos isolados
- `Identity Snapshot Generator` permanece somente leitura até a camada observável estar madura
- `Learning Engine` transforma observações da frota em `Hypothesis` e `Knowledge`, sem executar ações
- `Fleet Learning` agrega projeções dos chips para descobrir coortes, padrões e promoções de conhecimento compartilhado
- `Knowledge Base` é somente leitura para o futuro `Strategy Engine`
- `Strategy Engine` deverá consumir apenas `Identity Snapshot` e `Knowledge Base`
- `Behavior Engine` fica explicitamente adiado para uma fase futura

## Arquitetura em alto nível

```text
Frontend React/Vite
    ↓
tRPC Client + React Query
    ↓
Backend Node/Express + tRPC
    ↓
Serviços de domínio
    ├─ Maturação
    ├─ Evidence Normalizer
    ├─ Evidence Catalog
    ├─ Episode Builder
    ├─ Behavior Memory
    ├─ Identity Snapshot Generator (somente leitura)
    ├─ Adaptive Learning Engine
    ├─ Fleet Learning
    ├─ Knowledge Base viva
    ├─ Strategy Engine (futuro)
    ├─ Risk Model (futuro)
    ├─ Behavior Planner
    ├─ Marketing
    ├─ WhatsApp Session Layer
    ├─ Scheduling / Heartbeats
    └─ Admin / Billing / Auditoria
    ↓
Persistência
    ├─ MySQL + Drizzle
    ├─ auth_info_<chipId> para sessões WhatsApp
    └─ Storage auxiliar
```

## Stack

### Frontend

- `React 19`
- `Vite`
- `TypeScript`
- `Wouter`
- `TanStack React Query`
- `tRPC client`
- `Tailwind`
- componentes `Radix UI`
- `Recharts`
- `Framer Motion`

### Backend

- `Node.js`
- `Express`
- `tRPC`
- `TypeScript`
- `Drizzle ORM`
- `MySQL`
- `baileys`
- schedulers próprios via heartbeat

## Leituras operacionais

O backend hoje já materializa:

- `Human Score`
- `Risk Score`
- `Evidence Coverage`

A próxima métrica prevista pelo desenho arquitetural é:

- `Evidence Quality`

Ela deve medir a riqueza e diversidade das evidências humanas produzidas pelo chip, e não apenas o volume de mensagens.

As dimensões previstas são:

- `Naturalness`
- `Diversity`
- `Consistency`
- `Social Presence`

`Evidence Coverage` é uma leitura independente de qualidade. Um chip pode ter evidência boa, mas pouca cobertura. A leitura operacional mínima deve dizer quanto o sistema conhece, naquele período, sobre:

- `messages`
- `status`
- `groups`
- `profile`
- `passivity`
- `presence`

### Infra local

- `Docker` para MySQL local
- login local habilitado
- build full-stack com `vite` + `esbuild`

## Estrutura física do repositório

## Raiz

Arquivos importantes da raiz:

- `package.json`
- `LOCAL_SETUP.md`
- `DEPLOY_GUIDE.md`
- `.env.example`
- `.env.production`

Pastas principais:

- `client/`
- `server/`
- `docs/adr/`
- `auth_info_4/` e demais diretórios de sessão WhatsApp

## Frontend

Base do app:

- `client/src/App.tsx`
- `client/src/main.tsx`
- `client/src/index.css`

Páginas:

- `client/src/pages/Dashboard.tsx`
- `client/src/pages/Operations.tsx`
- `client/src/pages/ConnectChip.tsx`
- `client/src/pages/BulkDispatch.tsx`
- `client/src/pages/AdminDashboard.tsx`
- `client/src/pages/AdminSystemsHub.tsx`
- `client/src/pages/Login.tsx`
- `client/src/pages/Profile.tsx`
- `client/src/pages/Plans.tsx`
- `client/src/pages/Reports.tsx`
- `client/src/pages/Logs.tsx`
- `client/src/pages/UserWorkspace.tsx`
- `client/src/pages/SystemDemo.tsx`

Infra de UI:

- `client/src/components/`
- `client/src/components/ui/`
- `client/src/contexts/ThemeContext.tsx`
- `client/src/lib/trpc.ts`
- `client/src/lib/access.ts`
- `client/src/_core/hooks/useAuth.ts`

## Backend

Núcleo:

- `server/_core/index.ts`
- `server/_core/trpc.ts`
- `server/_core/context.ts`
- `server/_core/env.ts`
- `server/_core/rbac.ts`
- `server/_core/heartbeat.ts`
- `server/_core/systemRouter.ts`

Routers:

- `server/routers.ts`
- `server/routers/chips.ts`
- `server/routers/whatsapp.ts`
- `server/routers/admin.ts`
- `server/routers/operations.ts`

Serviços:

- `server/services/whatsappService.ts`
- `server/services/maturationEngine.ts`
- `server/services/bulkDispatchService.ts`
- `server/services/schedulingService.ts`

Schedulers:

- `server/scheduled/maturationHeartbeat.ts`
- `server/scheduled/marketingHeartbeat.ts`

Persistência:

- `server/db.ts`
- `server/storage.ts`

Regras e utilitários:

- `server/utils/messageLibrary.ts`
- `server/utils/operationalRules.ts`
- `server/utils/marketingCampaigns.ts`
- `server/utils/marketingSuppression.ts`
- `server/utils/targets.ts`
- `server/operational-rules.json`

## Camadas lógicas

## 1. Presentation Layer

Responsável por:

- navegação
- layout
- páginas operacionais
- páginas administrativas
- consumo do backend via `tRPC`

Arquivos centrais:

- `client/src/App.tsx`
- `client/src/pages/*`
- `client/src/components/*`

## 2. Application Layer

Responsável por:

- autenticação
- contexto do usuário
- autorização
- roteamento de casos de uso
- agregação de dados para o frontend

Arquivos centrais:

- `server/routers.ts`
- `server/routers/*.ts`
- `server/_core/trpc.ts`
- `server/_core/context.ts`
- `server/_core/rbac.ts`

## 3. Domain Layer

Responsável por:

- regras de maturação
- regras de campanhas
- lógica de execução
- integrações com WhatsApp
- agendamento

Arquivos centrais:

- `server/services/maturationEngine.ts`
- `server/services/bulkDispatchService.ts`
- `server/services/schedulingService.ts`
- `server/services/whatsappService.ts`

## 4. Persistence / Infra Layer

Responsável por:

- banco MySQL
- repositórios/helpers em `db.ts`
- sessões persistidas do WhatsApp
- storage externo quando necessário

Arquivos centrais:

- `server/db.ts`
- `server/storage.ts`
- `auth_info_<chipId>/`

## Domínios de negócio

## Pipeline de evidências

O pipeline alvo da maturação agora é fechado antes de qualquer integração comportamental futura:

```text
Raw Event
    ↓
Evidence Normalizer
    ↓
Evidence Catalog
    ↓
Episode Builder
    ↓
Behavior Memory
    ↓
Identity Snapshot Generator
    ↓
Identity Snapshot (somente leitura)
    ↓
Adaptive Learning Engine
    ↓
Hypothesis / Knowledge Base viva
    ↓
Strategy Engine (futuro)
    ↓
Behavior Engine (futuro)
```

Regra obrigatória:

- nenhum componente acima do `Episode Builder` pode conhecer eventos do WhatsApp, `messages.upsert`, `groupAcceptInvite` ou detalhes do `baileys`
- acima dessa fronteira, todo consumo deve acontecer em termos de `Evidence`, `Catalog`, `Episode`, `Memory` e `Score`

Regras adicionais da próxima camada:

- `Learning Engine` não executa comportamento nem altera identidade
- `Knowledge Base` é escrita apenas pelo `Learning Engine`
- `Strategy Engine` não pode acessar `behavior_timeline` nem evidência bruta

## Critério de pronto

A camada de evidências só é considerada pronta quando for possível responder, para qualquer episódio ou leitura futura:

1. de quais eventos brutos o resultado foi derivado
2. qual foi a sequência de normalização, catalogação e agrupamento
3. qual a `confidence` das evidências envolvidas
4. qual a `Evidence Coverage` disponível para o chip na janela analisada
5. quais versões de `Normalizer` e `Catalog` produziram o resultado

## 1. Maturação

Objetivo:

- aquecer chips com comportamento semelhante ao humano

Motor central:

- `server/services/maturationEngine.ts`

Conceitos principais:

- perfis:
  - `suave`
  - `normal`
  - `ultra`
- cada perfil controla:
  - atraso mínimo e máximo
  - duração de digitação
  - rotação de mensagens
  - rotação de reações
  - chance de simular áudio
  - chance de simular imagem
  - chance de reagir

Tipos de alvo:

- `number`
- `group`

O histórico do projeto já deixou claro que grupos e números têm comportamentos diferentes no motor.

Fluxo resumido:

```text
Seleção de chip
    ↓
Seleção de targets
    ↓
Perfil de maturação
    ↓
Criação de executionJob
    ↓
Aplicação de regras operacionais
    ↓
Simulação de typing / reação / envio
    ↓
Registro em attempts + logs
```

## 2. Marketing / Disparo

Objetivo:

- executar campanhas reais em lote com distribuição entre chips

Peças principais:

- `server/services/bulkDispatchService.ts`
- `server/services/schedulingService.ts`
- `server/utils/marketingCampaigns.ts`
- `server/utils/marketingSuppression.ts`

Capacidades já presentes no histórico:

- campanhas salvas
- importação de CSV
- tags por contato
- distribuição entre 3–5 chips
- estratégias de rotação
- retry inteligente
- blacklist de supressão
- score de risco por chip
- pausa automática quando risco aumenta
- analytics por campanha e por chip

Fluxo resumido:

```text
Importação de targets
    ↓
Segmentação por tag
    ↓
Criação da campanha
    ↓
Escolha da estratégia de rotação
    ↓
Scheduler executa
    ↓
Retry / suppression / pause por risco
    ↓
Analytics e logs
```

## 3. Admin

Objetivo:

- operar o negócio e controlar a plataforma

Peças principais:

- `client/src/pages/AdminDashboard.tsx`
- `client/src/pages/AdminSystemsHub.tsx`
- `server/routers/admin.ts`
- `server/db.ts`

Recursos já implementados segundo o histórico:

- gestão de usuários
- gestão de papéis
- gestão de planos
- gestão de assinaturas
- visão de frota
- trilha de auditoria
- hub de sistemas

## 4. WhatsApp Session Layer

Objetivo:

- conectar chips reais ao WhatsApp e abstrair envio/recebimento

Arquivo central:

- `server/services/whatsappService.ts`

Responsabilidades:

- inicializar sessão por chip
- gerar QR Code
- salvar credenciais localmente
- restaurar sessões no startup
- reconectar quando possível
- atualizar status do chip
- registrar mensagens recebidas

Estratégia de persistência:

- cada chip tem seu diretório `auth_info_<chipId>`
- o sistema usa `useMultiFileAuthState`

Estado de sessão mantido em memória:

- `socket`
- `qrCode`
- `isConnected`
- `lastActivity`

Fluxo resumido:

```text
Chip cadastrado
    ↓
initializeChipSession
    ↓
QR Code
    ↓
Pareamento
    ↓
Sessão persistida em auth_info_<chipId>
    ↓
restoreChipSessionsOnStartup no boot
```

## 5. Scheduler / Heartbeat

Objetivo:

- transformar ações em operação contínua

Arquivos centrais:

- `server/_core/heartbeat.ts`
- `server/scheduled/maturationHeartbeat.ts`
- `server/scheduled/marketingHeartbeat.ts`

Responsabilidades:

- encontrar execuções pendentes
- disparar jobs automaticamente
- atualizar estados de execução
- manter o sistema trabalhando sem clique manual

Estados operacionais citados no histórico:

- `pending`
- `executing`
- `paused`
- `finalized`

## Modelo de dados

As entidades principais observadas em `server/db.ts` são:

- `users`
- `whatsappChips`
- `activityLogs`
- `scheduledTasks`
- `userSubscriptions`
- `subscriptionPlans`
- `maturationProfiles`
- `messageTemplates`
- `maturationTargets`
- `executionJobs`
- `executionAttempts`
- `adminAuditLogs`

## Significado prático das entidades

`users`
- usuários da plataforma
- login, nome, email, papel

`whatsappChips`
- cada chip/linha operacional
- status e flags de pausa

`activityLogs`
- trilha detalhada de eventos
- conexão, erro, mensagem enviada, mensagem recebida

`scheduledTasks`
- tarefas programadas do sistema

`userSubscriptions`
- assinatura ativa por usuário

`subscriptionPlans`
- planos, preços e limites

`maturationProfiles`
- parametrização operacional da maturação

`messageTemplates`
- biblioteca de mensagens

`maturationTargets`
- targets de número e grupo

`executionJobs`
- unidade principal de execução

`executionAttempts`
- tentativas granulares por target

`adminAuditLogs`
- auditoria administrativa

## API

A API principal é um `appRouter` em `server/routers.ts`.

Namespaces principais:

- `system`
- `admin`
- `auth`
- `chips`
- `maturation`
- `scheduling`
- `whatsapp`
- `operations`

## Papel de cada namespace

`auth`
- login local
- sessão
- perfil do usuário
- plano e limites
- resumo do workspace

`chips`
- CRUD e operação de chips

`maturation`
- fluxos específicos de maturação

`scheduling`
- tarefas agendadas

`whatsapp`
- ações ligadas à sessão real do WhatsApp

`operations`
- visão operacional de execuções

`admin`
- gestão da camada administrativa

## Frontend por superfície

## Área do usuário

Páginas operacionais principais:

- `Dashboard`
- `ConnectChip`
- `Operations`
- `BulkDispatch`
- `Logs`
- `Reports`
- `Profile`
- `Plans`
- `UserWorkspace`

## Área administrativa

Páginas:

- `AdminDashboard`
- `AdminSystemsHub`

## Experiência comercial / demo

Página de apoio:

- `SystemDemo.tsx`

## Segurança e acesso

Autenticação:

- login local habilitado
- sessão por cookie
- token de sessão via SDK

Autorização:

- `rbac`
- separação entre `admin` e `user`

Limites:

- os planos controlam uso de chips, mensagens e tarefas
- frontend consulta esses limites via `auth.getMyPlanLimits`

## Estado atual de maturidade

Pelo histórico consolidado, este projeto já está além de uma prova de conceito.

Já existem:

- execução real com WhatsApp
- operação de múltiplos chips
- scheduler automático
- campanhas
- marketing e maturação separados por domínio
- administração forte
- identidade visual premium consolidada

O sistema hoje pode ser descrito como:

`plataforma operacional de WhatsApp com domínios de maturação, disparo e administração, construída como monólito modular`

## Riscos e pontos sensíveis

Os pontos mais sensíveis da arquitetura atual são:

1. `Sessões WhatsApp locais`
   - dependem da integridade dos diretórios `auth_info_<chipId>`

2. `Acoplamento operacional no monólito`
   - facilita evolução rápida
   - mas aumenta impacto cruzado entre maturação, marketing e admin

3. `Regras operacionais espalhadas`
   - parte está em serviços
   - parte em utils
   - parte em JSON operacional

4. `Scheduler interno`
   - prático para operação inicial
   - pode exigir observabilidade maior conforme a escala cresce

## Próximos refinamentos possíveis

Sem mudar o modelo central, as IAs podem te ajudar a refinar:

- boundaries entre `maturação` e `marketing`
- padronização de casos de uso
- desenho de repositórios
- observabilidade e métricas
- política de retry e risco
- multi-tenant mais explícito
- versionamento de regras operacionais
- desacoplamento futuro do scheduler

## Resumo curto para outras IAs

```text
Projeto: whatsapp-chip-maturator / W.M.S.E

Tipo:
- monólito modular full-stack

Stack:
- frontend: React + Vite + TypeScript + Wouter + React Query + tRPC
- backend: Node + Express + tRPC + TypeScript
- banco: MySQL + Drizzle
- WhatsApp: Baileys

Domínios:
1. Maturação
2. Marketing / Disparo
3. Admin
4. WhatsApp Session Layer
5. Scheduler / Heartbeat

Pastas principais:
- client/src/pages
- client/src/components
- server/routers
- server/services
- server/utils
- server/_core

Entidades principais:
- users
- whatsappChips
- activityLogs
- scheduledTasks
- userSubscriptions
- subscriptionPlans
- maturationProfiles
- messageTemplates
- maturationTargets
- executionJobs
- executionAttempts
- adminAuditLogs

Características:
- múltiplos chips com sessão persistida
- maturação com perfis suave/normal/ultra
- campanhas com rotação entre chips
- scheduler automático
- admin completo com planos e auditoria
```
