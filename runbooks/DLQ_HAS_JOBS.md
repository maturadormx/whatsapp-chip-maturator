# DLQ_HAS_JOBS

## Detecção

- Alerta `DlqHasJobs` ativo.
- Dashboard `DLQ` com `dlq_current_size > 0`.

## Diagnóstico

1. Veja o tamanho atual:
   `curl http://localhost:3000/internal/metrics | findstr dlq_`
2. Inspecione logs recentes:
   `docker logs --tail 200 whatsapp-chip-maturator-app`
3. Verifique saúde das dependências:
   `curl http://localhost:3000/health`
   `docker exec whatsapp-chip-maturator-mysql mysql -uroot -proot_pass_local -e "SELECT 1"`

## Mitigação

1. Corrija a causa raiz mais recente encontrada nos logs.
2. Garanta que MySQL e Redis estejam saudáveis.
3. Reinicie a aplicação para voltar a consumir normalmente:
   `docker compose -f docker-compose.operations.yml restart app`

## Validação

- `dlq_current_size` para de crescer.
- Novos eventos voltam a concluir sem erro.
- `pipeline_completed_total` volta a subir.

## Escalonamento

- Se a DLQ continuar crescendo após a recuperação, abrir incidente de processamento e revisar payloads ou dependências externas.
