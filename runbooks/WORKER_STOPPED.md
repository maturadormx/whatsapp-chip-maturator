# WORKER_STOPPED

## Detecção

- Alerta `WorkerStopped` ativo no Alertmanager.
- Dashboard `Worker` com `worker_running = 0`.
- `GET /ready` pode mostrar fila parada ou backlog subindo.

## Diagnóstico

1. Verifique o estado da stack:
   `docker compose -f docker-compose.operations.yml ps`
2. Verifique a saúde da aplicação:
   `curl http://localhost:3000/live`
   `curl http://localhost:3000/ready`
3. Inspecione os logs:
   `docker logs --tail 100 whatsapp-chip-maturator-app`
4. Valide o Redis:
   `docker exec whatsapp-chip-maturator-redis redis-cli ping`

## Mitigação

1. Reinicie a aplicação:
   `docker compose -f docker-compose.operations.yml restart app`
2. Aguarde a aplicação voltar:
   `docker compose -f docker-compose.operations.yml ps`
3. Confirme que o worker voltou:
   `curl http://localhost:3000/internal/metrics | findstr worker_running`

## Validação

- `worker_running` volta para `1`.
- `GET /ready` responde `ok: true`.
- `queue_pending_observations` e `queue_delayed_jobs` deixam de crescer.

## Escalonamento

- Se o Redis não responder `PONG`, trate como incidente de Redis.
- Se o app reiniciar mas o worker seguir em `0`, escale para manutenção da runtime/queue.
