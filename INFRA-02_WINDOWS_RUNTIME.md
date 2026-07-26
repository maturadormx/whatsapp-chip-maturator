# INFRA-02 — Windows Runtime / esbuild cleanup lock

## Status

Known Issue

## Sintoma

No Windows, o build do frontend pode falhar no cleanup temporário do `esbuild` com erro `Access is denied` durante `vite build`.

## Impacto

- Não bloqueia a operação da aplicação.
- Não bloqueia testes.
- Não bloqueia build em Linux.

## Evidência

- `npm run build` falha no Windows durante remoção de `esbuild-*`.
- O mesmo build passa em Docker/Linux.

## Workaround oficial

- Usar Docker ou WSL para build e operação.
- Fluxo operacional validado pela Sprint E1 com stack Docker.

## Próxima ação

- Manter em backlog de infraestrutura.
- Não bloquear dashboards, alertas, runbooks, auditoria final nem preparação para produção.
