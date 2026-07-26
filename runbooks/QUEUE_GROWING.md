# QUEUE_GROWING

## Detecção

- Alerta `QueueGrowing` ativo.
- Dashboard `Queue` com `pending`, `delayed` ou `failed` acima do normal.

## Diagnóstico

1. Consulte as métricas:
   `curl http://localhost:3000/internal/metrics`
2. Verifique a aplicação:
   `curl http://localhost:3000/ready`
3. Verifique os logs do app:
   `docker logs --tail 150 whatsapp-chip-maturator-app`
4. Valide Redis e MySQL:
   `docker exec whatsapp-chip-maturator-redis redis-cli ping`
   `docker exec whatsapp-chip-maturator-mysql mysql -uroot -proot_pass_local -e "SELECT 1"`

## Mitigação

1. Se o MySQL estiver indisponível, recupere o banco primeiro.
2. Se o Redis estiver indisponível, recupere o Redis primeiro.
3. Após recuperar dependências, reinicie a aplicação:
   `docker compose -f docker-compose.operations.yml restart app`

## Validação

- `queue_pending_observations` cai.
- `queue_delayed_jobs` estabiliza ou zera.
- `worker_jobs_processed_total` volta a crescer.

## Escalonamento

- Se `queue_failed_jobs` continuar subindo após recuperar banco e Redis, investigar falhas da pipeline e DLQ.
