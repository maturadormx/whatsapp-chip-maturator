# Uso local no seu PC

## Objetivo

Rodar o sistema só para você, em `localhost`, sem depender de hospedagem externa.

## O que foi preparado

- `.env` já configurado para uso local
- `docker-compose.local.yml` com MySQL local
- login local habilitado

## Pré-requisitos

- Node.js 20+
- `pnpm`
- Docker Desktop

## Passo a passo

### 1. Suba o MySQL local

```bash
docker compose -f docker-compose.local.yml up -d
```

### 2. Instale as dependências

```bash
pnpm install
```

### 3. Crie/atualize o banco

```bash
pnpm db:push
```

### 4. Rode o projeto

```bash
pnpm dev
```

### 5. Abra no navegador

```text
http://localhost:3000
```

### 6. Entre no sistema

Na tela de login, use:

- `Entrar localmente como Administrador Local`

## Banco local configurado

- host: `127.0.0.1`
- porta: `3307`
- database: `whatsapp_chip_maturator`
- user: `chip_user`
- password: `chip_pass`

## Comandos úteis

Parar banco:

```bash
docker compose -f docker-compose.local.yml down
```

Ver logs do banco:

```bash
docker compose -f docker-compose.local.yml logs -f mysql
```

## Observação sobre Dolphin Anty

Se você quiser usar `Dolphin Anty` depois para operação com várias sessões/abas, isso é uma camada separada. O sistema local não depende dele para funcionar.

Primeiro faça o app rodar localmente. Depois, se quiser, dá para estudar integração ou fluxo operacional com navegador antidetect.
