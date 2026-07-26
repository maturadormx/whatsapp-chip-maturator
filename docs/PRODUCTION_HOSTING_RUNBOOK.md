# Runbook de hospedagem

## Objetivo

Este runbook prepara a plataforma para publicação controlada em um servidor Linux, com MySQL, Redis, proxy reverso, HTTPS, backup, monitoramento e rollout gradual.

## Arquivos principais

- `docker-compose.prod.yml`
- `deploy/Caddyfile`
- `.env.production.example`
- `scripts/release/bootstrap-linux.sh`
- `scripts/release/preflight-production.sh`
- `scripts/release/deploy-production.sh`
- `scripts/release/rollback-production.sh`
- `scripts/backup/backup-platform-state.sh`
- `scripts/backup/restore-platform-state.sh`

## Sequência recomendada

1. Provisionar o servidor Linux.
2. Rodar `scripts/release/bootstrap-linux.sh` como root.
3. Copiar `.env.production.example` para `.env.production` e preencher os segredos reais.
4. Validar o ambiente com `scripts/release/preflight-production.sh`.
5. Executar `scripts/release/deploy-production.sh`.
6. Confirmar `live`, `ready`, `health`, métricas e teste de evento.
7. Subir o perfil `ops` se o ambiente já estiver pronto para observabilidade completa.
8. Fazer rollout gradual de chips reais.

## Variáveis críticas

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `COOKIE_SECRET`
- `SESSION_SECRET`
- `SECRETS_MASTER_KEY`
- `APP_DOMAIN`
- `GRAFANA_DOMAIN`
- `OAUTH_SERVER_URL`
- `VITE_OAUTH_PORTAL_URL`
- `VITE_APP_ID`

## Banco e Redis

- O MySQL sobe com volume persistente em `mysql_prod_data`.
- O Redis sobe com `appendonly yes` e snapshot periódico.
- O deploy executa `npm run db:push` após a stack subir.

## Proxy e TLS

- O proxy padrão é `Caddy`.
- O domínio principal aponta para a aplicação.
- O domínio de observabilidade pode apontar para o Grafana.
- O Caddy cuida automaticamente do TLS quando os domínios já resolvem para o servidor.

## Backups

- Backup completo da plataforma: `scripts/backup/backup-platform-state.sh`
- Restore completo da plataforma: `scripts/backup/restore-platform-state.sh`
- Sempre gerar backup antes de upgrade, rollback ou mudança estrutural.

## Pipeline

- `ci.yml` valida typecheck, testes, build e imagem Docker.
- `deploy-staging.yml` prepara e publica em staging remoto.
- `deploy-production.yml` prepara e publica em produção remota.

## Critérios mínimos para publicar

- `npm run check` sem erro
- `npm run build` sem erro
- `docker compose config` válido
- MySQL saudável
- Redis saudável
- `db:push` executado
- smoke test verde
- backup gerado
- rollback testado
