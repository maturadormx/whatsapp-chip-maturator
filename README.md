# WhatsApp Chip Maturator

Plataforma Node.js e TypeScript para maturação operacional de chips WhatsApp, com backend modular, console web, observabilidade, filas, políticas comportamentais e trilha de documentação arquitetural.

## O que o projeto faz

O projeto combina:

- backend HTTP e runtime operacional em `server/`
- frontend React/Vite em `client/`
- persistência e migrations com Drizzle em `drizzle/`
- automação operacional, validação e release em `scripts/`
- documentação técnica, ADRs e runbooks em `docs/`

O foco é oferecer uma base operável para:

- gestão e maturação de chips
- execução de rotinas comportamentais
- simulação e observabilidade operacional
- filas, scheduler e processamento assíncrono
- publicação e operação com Docker e workflows

## Stack principal

- Node.js
- TypeScript
- React 19
- Vite
- Express
- tRPC
- Drizzle ORM
- MySQL
- Redis
- BullMQ
- Baileys
- Prometheus / Grafana
- Docker / Docker Compose

## Requisitos

- Node.js 22 recomendado
- npm 10 recomendado
- Docker Desktop para fluxos com banco local
- MySQL 8 para persistência local ou de homologação
- Redis 7 para filas e recursos distribuídos

## Instalação

Clone o projeto e instale as dependências:

```bash
npm install
```

## Execução

### Modo rápido de desenvolvimento

O comando abaixo sobe o backend em modo de desenvolvimento com driver em memória por padrão, sem exigir banco nem Redis para um primeiro boot.

```bash
npm run dev
```

### Modo local com MySQL

Suba o banco local:

```bash
npm run local:db:up
```

Materialize as migrations:

```bash
npm run db:push
```

Se quiser forçar serviços persistentes durante o desenvolvimento:

```bash
set DEV_USE_PERSISTENT_SERVICES=true
npm run dev
```

No PowerShell:

```powershell
$env:DEV_USE_PERSISTENT_SERVICES='true'
npm run dev
```

### Build de produção

```bash
npm run check
npm test
npm run build
```

Para iniciar o build gerado:

```bash
npm run start
```

## Variáveis de ambiente

O projeto não deve versionar arquivos `.env` reais.

Para ambientes de produção e staging, use o template:

```text
.env.production.example
```

Copie para `.env.production` e preencha os segredos fora do Git.

## Arquitetura

Em alto nível, a base está organizada assim:

- `client/`: interface web, páginas, componentes e integrações do frontend
- `server/`: domínio, aplicação, gateways, serviços, métricas, runtime e rotas
- `drizzle/`: schema, relations e migrations
- `scripts/`: build, dev, testes, manutenção, certificação, release e backup
- `docs/`: arquitetura, implementação, ADRs, operações, governança e runbooks
- `deploy/`, `monitoring/`, `grafana/`: hospedagem, métricas e observabilidade
- `datasets/`: cenários sintéticos e bases auxiliares

### Camadas principais

- `server/domain/`: regras de domínio, estado do chip e contratos internos
- `server/application/`: casos de uso e pipelines de aplicação
- `server/infrastructure/`: persistência, fila, scheduler e logging
- `server/services/`: serviços operacionais, plataforma, comportamento, distribuição e observabilidade
- `server/_core/`: bootstrap do runtime, integrações centrais e superfícies HTTP

## Estrutura de pastas

```text
whatsapp-chip-maturator/
├── client/
├── datasets/
├── deploy/
├── docs/
├── drizzle/
├── grafana/
├── monitoring/
├── patches/
├── release/
├── runbooks/
├── scripts/
├── server/
├── shared/
├── .github/workflows/
├── docker-compose.local.yml
├── docker-compose.prod.yml
├── Dockerfile
├── package.json
└── README.md
```

## Qualidade e validação

Comandos principais:

```bash
npm run check
npm test
npm run build
```

Validações adicionais:

```bash
npm run validate:architecture
npm run validate:fitness
npm run validate:contracts
```

## GitHub Actions

Os workflows ficam em `.github/workflows/`:

- `ci.yml`: valida instalação, typecheck, testes, build e imagem Docker
- `docker.yml`: publica imagem em `ghcr.io`
- `deploy-production.yml`: deploy manual para produção
- `deploy-staging.yml`: deploy manual para staging

## Documentação complementar

Os documentos técnicos mais importantes estão em:

- `docs/README.md`
- `docs/architecture/README.md`
- `docs/implementation/README.md`
- `docs/PRODUCTION_HOSTING_RUNBOOK.md`
- `docs/GRADUAL_PRODUCTION_ROLLOUT.md`

## Estado desta publicação

Esta preparação foi ajustada para publicação profissional no GitHub, com foco em:

- ignorar artefatos locais e sensíveis
- manter apenas código, documentação e configuração relevante
- garantir instalação limpa com `npm`
- preservar os workflows úteis e reduzir gatilhos de deploy indevidos
