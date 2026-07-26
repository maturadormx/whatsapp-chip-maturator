# MATURADOR_STATUS_REAL

## Baseline auditada

- Baseline oficial: estado atual de `whatsapp-chip-maturator`
- Tipo de auditoria: funcional e técnica
- Objetivo: medir o estado real de deploy, não apenas a estrutura

## Legenda

- `OK`: existe, está coerente com a documentação e passou na validação relevante
- `⚠`: existe, mas está parcial, bloqueado por dependência, schema, build ou runtime
- `❌`: não validado, quebrado ou ausente para uso real

## Resumo executivo

O projeto está **arquiteturalmente forte e funcionalmente incompleto para produção**. A maior parte dos módulos existe em código e está alinhada com a documentação, porém o estado atual de dependências, build, typecheck, runtime do backend e schema do banco impede classificar a cópia como pronta para deploy.

Diagnóstico consolidado:

- Estrutura e documentação: **muito fortes**
- Cobertura de módulos: **alta**
- Build do frontend: **quebrado**
- Start do backend: **quebrado**
- Banco em Docker: **conecta, mas schema ativo está parcial**
- Scheduler / Queue / Runtime / Gateway / Bulk Dispatch: **existem, porém sem validação operacional completa no estado atual**
- Segurança e deploy: **parciais**

## Evidências de execução

Validações executadas nesta auditoria:

1. `node node_modules/vite/bin/vite.js build`
   - Resultado: `❌`
   - Erro: `Cannot find package 'esbuild' imported from ... node_modules\vite\dist\node\cli.js`

2. `node node_modules/typescript/bin/tsc --noEmit`
   - Resultado: `❌`
   - Erros reais encontrados:
     - módulos não resolvidos: `jose`, `@opentelemetry/api`, `ioredis`, `@hapi/boom`, `@opentelemetry/auto-instrumentations-node`
     - grande volume de erros de tipagem em `server/db.ts`, `server/routers/chips.ts`, `server/routers/operations.ts`, `server/services/runtimeSupervisorService.ts` e outros

3. `node node_modules/vitest/vitest.mjs run`
   - Resultado: `❌`
   - Erro: `Cannot find package 'loupe' imported from ... node_modules\@vitest\utils\dist\index.js`

4. `node node_modules/tsx/dist/cli.mjs scripts/maintenance/validate-architecture-boundaries.ts`
   - Resultado: `❌`
   - Erro: tenta ler `scripts\server\services`, caminho inexistente
   - Causa real: `validate-architecture-boundaries.ts` calcula `rootDir` como `scripts/`, então monta `scripts/server/services` em vez de `server/services`

5. Start direto do backend em modo degradado
   - Resultado: `❌`
   - Erro: `Cannot find package 'express' imported from server/_core/index.ts`

6. Verificação do banco em Docker
   - Resultado: `⚠`
   - Tabelas confirmadas no MySQL ativo:
     - `observation_runtime_events`
     - `observation_runtime_records`
   - Não foi encontrada a malha mais ampla de tabelas esperadas pelo backend operacional de chips

## 1. Frontend

**Status:** `⚠`

### O que existe

- roteamento real em `client/src/App.tsx`
- páginas reais para:
  - `Dashboard`
  - `BulkDispatch`
  - `RuntimeConsole`
  - `ControlCenter`
  - `Reports`
  - `Logs`
  - `ConnectChip`
  - `UserWorkspace`

### O que falhou

- o frontend não compila no estado atual porque o build quebra antes de gerar artefato
- o erro imediato é de resolução de dependência do `vite/esbuild`

### Leitura

O frontend **existe e está materializado**, mas **não está liberado para empacotamento/deploy**.

## 2. Backend

**Status:** `❌`

### O que existe

- entrypoint real em `server/_core/index.ts`
- Express + tRPC + health routes
- inicialização de runtime, storage proxy, OAuth, inbound, métricas e scheduler

### O que falhou

- o backend não sobe no estado atual
- start direto falhou com:
  - `Cannot find package 'express' imported from server/_core/index.ts`
- o build de produção também não gera `dist/index.js`, então `scripts/operational/start.mjs` fica bloqueado

### Leitura

O backend é **real e amplo**, mas **não inicializa de forma confiável hoje**.

## 3. Banco

**Status:** `⚠`

### O que existe

- Docker MySQL ativo
- `DATABASE_URL` configurado na base local
- repositórios MySQL e Drizzle presentes em código

### O que foi confirmado

- o container responde
- existem tabelas de runtime observacional:
  - `observation_runtime_events`
  - `observation_runtime_records`

### O que está parcial

- o backend depende de uma superfície de dados muito maior para chips, operações, runtime, campanhas e reconciliação
- essa superfície não apareceu materializada no banco ativo durante a auditoria

### Leitura

O banco **existe e conecta**, mas o **schema atualmente persistido está parcial em relação ao backend**.

## 4. Scheduler

**Status:** `⚠`

### Evidências

- `server/infrastructure/scheduler/IntervalScheduler.ts`
- `server/services/schedulingService.ts`
- heartbeats:
  - `maturationHeartbeat.ts`
  - `marketingHeartbeat.ts`
  - `behaviorMemoryShadowHeartbeat.ts`
  - `chipProjectionHeartbeat.ts`

### Leitura

O scheduler **está implementado em código**, porém sua validação operacional real ficou bloqueada pelo estado geral do backend e do banco.

## 5. Queue

**Status:** `⚠`

### Evidências

- `server/infrastructure/queue/BullMQAdapter.ts`
- `server/infrastructure/queue/ObservationWorker.ts`
- `server/infrastructure/queue/QueuePublishingScheduler.ts`
- testes dedicados da fila

### Bloqueios

- `tsc` falha em imports de `@opentelemetry/api` e `ioredis`
- sem backend saudável, a fila não foi validada ponta a ponta

### Leitura

A fila **existe e faz parte da arquitetura real**, mas **não pode ser considerada operacionalmente pronta**.

## 6. Gateway

**Status:** `⚠`

### Evidências

- `server/gateways/*`
- `MessageGateway`
- `MockMessageGateway`
- `server/services/whatsappService.ts`
- ADRs de gateway

### Bloqueios

- `tsc` falha em `@hapi/boom`
- backend não sobe
- sem runtime íntegro, o gateway WhatsApp não foi validado em execução real

### Leitura

O gateway **está implementado**, mas **sem validação operacional suficiente para produção**.

## 7. Runtime

**Status:** `⚠`

### Evidências

- `server/runtime/observationRuntime.ts`
- health endpoints:
  - `/live`
  - `/ready`
  - `/health`
- rota de métricas em `/api/runtime/metrics`

### Bloqueios

- runtime depende de backend inicializável
- schema do banco está parcial
- queue/scheduler não chegaram a uma execução estável nesta auditoria

### Leitura

O runtime é **um módulo real**, não um placeholder. Hoje ele está **arquiteturalmente pronto, mas operacionalmente bloqueado**.

## 8. Bulk Dispatch

**Status:** `⚠`

### Evidências

- página `client/src/pages/BulkDispatch.tsx`
- serviço `server/services/bulkDispatchService.ts`

### Bloqueios

- frontend não builda
- backend não sobe
- operação depende de chips e runtime íntegros

### Leitura

O Bulk Dispatch **existe**, mas **não pode ser certificado como funcional no estado atual**.

## 9. Learning Engine

**Status:** `⚠`

### Evidências

- `adaptiveLearningEngineService.ts`
- `fleetLearningService.ts`
- `behaviorMemoryService.ts`
- `behaviorMemoryShadowService.ts`
- ADR-005 e ADR-006

### Leitura

O Learning Engine **existe de fato**, mas em formato **distribuído pelo backend**, não como subsistema isolado. Está **parcialmente validado**: presente em código e documentação, porém sem execução operacional íntegra na baseline atual.

## 10. Dashboard

**Status:** `⚠`

### Evidências

- `client/src/pages/Dashboard.tsx`
- `client/src/pages/AdminDashboard.tsx`
- rota `/dashboard`

### Leitura

O Dashboard **existe e está alinhado com a documentação de superfícies**, mas a compilação quebrada do frontend impede considerá-lo pronto para produção.

## 11. Segurança

**Status:** `⚠`

### Evidências de risco

- `docker-compose.operations.yml` usa:
  - `JWT_SECRET: local-dev-secret`
  - `OAUTH_SERVER_URL: http://oauth-placeholder.local`
  - `VITE_OAUTH_PORTAL_URL: http://portal-placeholder.local`
  - `GF_SECURITY_ADMIN_PASSWORD: admin`
- `.env` local ainda contém segredos e defaults de desenvolvimento

### Leitura

A base tem consciência de produção, mas **a configuração atual ainda é insegura para publicação direta**.

## 12. Deploy

**Status:** `⚠`

### O que existe

- `docker-compose.operations.yml`
- `docker-compose.prod.yml`
- `Dockerfile`
- workflows em `.github/workflows/`
- `DEPLOY_GUIDE.md`

### O que impede deploy agora

- build quebrado
- backend não sobe
- testes não executam
- schema ativo do banco está parcial
- secrets e placeholders ainda precisam ser endurecidos

### Leitura

O projeto **já tem trilha de deploy desenhada**, mas **a publicação agora seria prematura**.

## 13. Pendências

- normalizar a instalação de dependências para eliminar falsos negativos de ambiente
- restaurar um `node_modules` íntegro e coerente com o `package.json`
- corrigir o build do frontend
- corrigir o start do backend
- corrigir o script `validate-architecture-boundaries.ts`
- alinhar schema do banco com o backend atual
- rodar validação real de:
  - Dashboard
  - Runtime Console
  - Bulk Dispatch
  - Scheduler
  - Queue
  - Gateway WhatsApp
- revisar segredos, placeholders e credenciais default
- executar uma rodada específica de detecção de itens mortos:
  - dependências não usadas
  - arquivos nunca importados
  - logs e builds antigos

## 14. Correções necessárias

### Prioridade 1

1. Reinstalar/normalizar dependências do projeto
2. Fazer `build`, `tsc`, `vitest` e `validate:architecture` ficarem verdes
3. Fazer o backend iniciar com `/live`, `/ready` e `/health` respondendo

### Prioridade 2

4. Aplicar ou revisar migrations para materializar o schema real esperado pelo backend
5. Validar queue, scheduler e runtime com MySQL + Redis
6. Validar o fluxo de chips e o gateway WhatsApp

### Prioridade 3

7. Endurecer segurança:
   - trocar `JWT_SECRET`
   - remover placeholders OAuth
   - trocar senha default do Grafana
   - separar `.env.production`
8. Executar limpeza técnica:
   - dependências mortas
   - arquivos nunca usados
   - logs, caches e builds antigos
   - `.gitignore` definitivo

## 15. Pronto para Produção (%)

**Prontidão real estimada: `62%`**

### Como chegar a esse número

- `+` arquitetura, módulos, documentação, Docker e superfícies de produto estão amplamente presentes
- `+` backend e frontend não são esqueletos; há produto real
- `-` build, testes e typecheck estão vermelhos
- `-` backend não sobe
- `-` schema ativo do banco não acompanha toda a expectativa do código
- `-` segurança e segredos ainda estão em modo parcial de operação/local

## Tabela final de módulos

| Módulo | Documentação | Código | Situação |
|---|---|---|---|
| Frontend | ✔ | ✔ | `⚠` |
| Backend | ✔ | ✔ | `❌` |
| Banco | ✔ | Parcial | `⚠` |
| Scheduler | ✔ | ✔ | `⚠` |
| Queue | ✔ | ✔ | `⚠` |
| Gateway | ✔ | ✔ | `⚠` |
| Runtime | ✔ | ✔ | `⚠` |
| Bulk Dispatch | ✔ | ✔ | `⚠` |
| Learning Engine | ✔ | Parcial | `⚠` |
| Dashboard | ✔ | ✔ | `⚠` |
| Segurança | ✔ | Parcial | `⚠` |
| Deploy | ✔ | ✔ | `⚠` |
| Voice | Parcial | Parcial | `⚠` |
| Electron | Não | Não | Ignorar |

## Veredito final

O `whatsapp-chip-maturator` **não precisa mais ser tratado como projeto perdido**. Ele deve ser tratado como **projeto recuperado, porém ainda em estabilização técnica**.

Em resumo:

- **Recuperação estrutural:** concluída
- **Recuperação documental:** concluída
- **Recuperação operacional:** parcial
- **Pronto para produção hoje:** não
- **Próxima fase correta:** estabilizar dependências, runtime, banco e segurança até obter uma baseline de deploy limpa
