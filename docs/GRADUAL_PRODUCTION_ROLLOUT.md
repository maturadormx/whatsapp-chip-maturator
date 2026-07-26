# Rollout gradual de produção

## Fase 0

- Publicar a stack sem chips reais.
- Confirmar `live`, `ready`, `health` e `/internal/metrics`.
- Confirmar acesso ao domínio principal e ao Grafana.
- Confirmar backup e restore em ambiente de teste.

## Fase 1

- Conectar de 1 a 3 chips de homologação.
- Observar CPU, RAM, Redis, MySQL e filas por pelo menos 24 horas.
- Validar reconexão, scheduler, replay, dashboard e observabilidade.
- Não ativar carga alta nessa fase.

## Fase 2

- Subir para 5 a 10 chips.
- Comparar métricas reais com o `CapacityPlanner`.
- Ajustar quotas, autoscaling, cache e alertas.
- Validar custos por chip e saúde do cluster.

## Fase 3

- Expandir para um lote controlado de operação real.
- Ativar experimentos, otimização e automações públicas somente após estabilidade.
- Revisar trilhas de compliance, retenção e backup diário.

## Gatilhos de pausa

- `health` instável
- filas represadas
- Redis com reconnect em cascata
- crescimento anormal de memória
- erro de migração
- perda de sessão de chips
- aumento súbito de falhas `FAILED`

## Critérios para ampliar carga

- uptime estável
- backup diário concluindo
- restore testado recentemente
- alertas sem ruído excessivo
- custo por chip dentro do esperado
- nenhum gargalo crítico em MySQL ou Redis

## Critérios para rollback

- regressão em `ready` ou `health`
- erro de migração não reversível automaticamente
- falha de autenticação em massa
- degradação contínua após restart controlado

## Comando operacional

- Preflight: `bash scripts/release/preflight-production.sh`
- Deploy: `bash scripts/release/deploy-production.sh`
- Smoke: `bash scripts/release/smoke-production.sh http://127.0.0.1:3000`
- Rollback: `bash scripts/release/rollback-production.sh`
