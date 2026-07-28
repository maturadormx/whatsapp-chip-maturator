# Stack local de monitoramento

Esta stack permite receber logs estruturados do app em produção e acompanhar chips, runtime e eventos operacionais em um Docker local.

## Componentes

- `Vector`: recebe JSON via HTTP na porta `5140` e envia para o Loki
- `Loki`: armazena logs
- `Grafana`: consulta, dashboard e alertas

## Subir localmente

```bash
npm run local:monitoring:up
```

Acessos:

- Grafana: `http://localhost:3000`
- Loki: `http://localhost:3100`
- Vector API: `http://localhost:8686`

Credenciais default do Grafana:

```text
admin / admin
```

## Desligar

```bash
npm run local:monitoring:down
```

## Logs da stack

```bash
npm run local:monitoring:logs
```

## Envio do Railway

Configure no Railway:

```text
VECTOR_HTTP_ENDPOINT=http://SEU-ENDPOINT-SEGURO:5140/
LOG_LEVEL=info
LOG_SERVICE_NAME=whatsapp-chip-maturator
```

O ideal é que `SEU-ENDPOINT-SEGURO` seja exposto via:

- `Tailscale`
- `Cloudflare Tunnel`

Não exponha a porta `5140` diretamente na internet.

## Formato esperado do log

Exemplo de payload JSON:

```json
{
  "timestamp": "2026-07-28T18:00:00.000Z",
  "level": "info",
  "service": "whatsapp-chip-maturator",
  "event": "chip.health",
  "chipId": "123",
  "userId": "99",
  "status": "online",
  "connectionState": "open",
  "healthScore": 87
}
```

## Queries úteis no Grafana

Todos os logs de um chip:

```logql
{chipId="123"}
```

Health degradado:

```logql
{event="chip.health"} | json | healthScore < 50
```

Desconexões:

```logql
{event="chip.disconnected"}
```

Falhas operacionais:

```logql
{level="error"}
```

## Próximo passo recomendado

Depois de subir a stack local:

1. ligar um chip em produção
2. configurar `VECTOR_HTTP_ENDPOINT` no Railway
3. redeployar
4. abrir o Grafana e validar se os eventos aparecem por `chipId`, `event` e `level`
