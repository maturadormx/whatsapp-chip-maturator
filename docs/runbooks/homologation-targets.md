# Destinatários de homologação

Lista operacional atual de números autorizados para testes e campanhas de homologação do `whatsapp-chip-maturator`.

## Números ativos

- `65999922612`
- `31995014758`

## Uso obrigatório nos próximos gates

Usar ambos os números para validar:

- envio manual
- campanha agendada
- ACK de envio
- resposta inbound
- registro em `activity_logs`
- registro em `behavior_timeline_events`
- atualização de `scheduled_tasks`

## Regra operacional

Nenhuma feature nova deve entrar enquanto os gates operacionais não estiverem totalmente verdes. Os próximos testes de homologação devem priorizar estes dois números como destino padrão.
