# PIPELINE_FAILURE_RATE_HIGH

## Detecção

- Alerta `PipelineFailureRateHigh` ativo.
- Dashboard `Pipeline` com taxa de falha acima de 5%.

## Diagnóstico

1. Reproduza o estado de saúde:
   `curl http://localhost:3000/health`
2. Leia os logs recentes do app:
   `docker logs --tail 200 whatsapp-chip-maturator-app`
3. Confirme disponibilidade do MySQL:
   `docker exec whatsapp-chip-maturator-mysql mysql -uroot -proot_pass_local -e "SELECT 1"`
4. Verifique métricas de falha:
   `curl http://localhost:3000/internal/metrics | findstr pipeline_`

## Mitigação

1. Se houver falha de banco, recupere o MySQL.
2. Se houver erro de payload ou regra, isole a origem do evento e suspenda a carga problemática.
3. Reinicie a aplicação após corrigir a causa:
   `docker compose -f docker-compose.operations.yml restart app`

## Validação

- `pipeline_failed_total` deixa de crescer.
- `pipeline_completed_total` volta a acompanhar `pipeline_started_total`.
- O alerta sai do Alertmanager.

## Escalonamento

- Se a taxa continuar alta com dependências saudáveis, abrir incidente de regressão na pipeline/regra de negócio.
