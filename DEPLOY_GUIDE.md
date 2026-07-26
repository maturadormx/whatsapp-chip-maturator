# Deploy do WhatsApp Chip Maturator

## Atualização

Esta base agora possui uma trilha operacional mais completa para hospedagem:

- `docs/PRODUCTION_HOSTING_RUNBOOK.md`
- `docs/GRADUAL_PRODUCTION_ROLLOUT.md`
- `.env.production.example`
- `deploy/Caddyfile`
- `scripts/release/bootstrap-linux.sh`
- `scripts/release/preflight-production.sh`
- `scripts/release/deploy-production.sh`
- `scripts/release/rollback-production.sh`
- `scripts/backup/backup-platform-state.sh`
- `scripts/backup/restore-platform-state.sh`

## Estado atual

- `pnpm check`: ok
- `pnpm build`: ok
- frontend com páginas principais revisadas visualmente
- fluxo de conexão protegido quando não há login

## Variáveis obrigatórias

Arquivos prontos no projeto:

- `.env.example`
- `.env.production`
- `ecosystem.config.cjs`

Para produção em VPS, use `.env.production` como base e troque apenas os valores reais.

Variáveis que precisam de valor real:

- `DATABASE_URL`
- `OAUTH_SERVER_URL`
- `JWT_SECRET`
- `VITE_OAUTH_PORTAL_URL`
- `VITE_APP_ID`

## Instalação

```bash
pnpm install
```

Se o ambiente tiver problema com `pnpm`, uma alternativa prática para materializar dependências locais foi:

```bash
npm install --legacy-peer-deps
```

## Desenvolvimento

```bash
pnpm dev
```

Servidor local esperado:

- `http://localhost:3000`

## Build de produção

```bash
pnpm build
```

Saída gerada:

- `dist/index.js`
- `dist/public`

## Subida em produção

Depois do build:

```bash
pnpm start
```

Comando revisado de produção:

```bash
NODE_ENV=production node dist/index.js
```

No projeto, isso já está encapsulado por:

```bash
pnpm start
```

## VPS com PM2

Fluxo recomendado:

```bash
pnpm install
pnpm build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Comandos úteis:

```bash
pm2 status
pm2 logs whatsapp-chip-maturator
pm2 restart whatsapp-chip-maturator
```

## VPS Linux passo a passo

### 1. Instalar runtime

Recomendado:

- Node.js 20+
- `pnpm`
- `pm2`

Exemplo:

```bash
npm install -g pnpm pm2
```

### 2. Subir o projeto

```bash
git clone <seu-repo>
cd whatsapp-chip-maturator
cp .env.production .env
```

Agora edite o `.env` com os valores reais.

### 3. Instalar e buildar

```bash
pnpm install
pnpm build
```

### 4. Rodar em produção

Sem gerenciador:

```bash
pnpm start
```

Com PM2:

```bash
pm2 start ecosystem.config.cjs
```

### 5. Proxy reverso

A aplicação sobe por padrão em:

- `PORT=3000`

Coloque Nginx, Apache ou painel apontando para:

- `http://127.0.0.1:3000`

## Painel de hospedagem

Se for painel tipo Node App / Plesk / aaPanel / CyberPanel:

- comando de build: `pnpm build`
- comando de start: `pnpm start`
- porta interna: `3000`
- arquivo de ambiente: `.env`

## O que falta para subir de verdade

Do lado de código, o projeto está pronto para build e start.

O que ainda precisa ser preenchido:

- credenciais do banco
- URL real do servidor OAuth
- URL real do portal OAuth
- `VITE_APP_ID`
- `JWT_SECRET`

## Banco e migração

Se precisar gerar/aplicar mudanças de schema:

```bash
pnpm db:push
```

Importante:

- `drizzle` exige `DATABASE_URL`

## O que ainda depende de ambiente externo

- login OAuth real
- callback OAuth funcional
- conexão persistida no banco real
- fluxo completo de `conectar -> maturar -> disparar` com credenciais válidas

## Checklist final

- copiar `.env.production` para `.env`
- preencher credenciais reais
- validar banco acessível
- validar OAuth acessível
- rodar `pnpm build`
- subir com `pnpm start`
- testar login
- testar conexão de chip
- testar disparo
