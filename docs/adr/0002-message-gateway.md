# 0002 Message Gateway

## Status

Aceito

## Decisão

O envio externo é expresso por um contrato explícito: `MessageGateway`.

## Consequência

O domínio deixa de depender de uma implementação concreta de transporte e passa a falar apenas com a semântica pública do envio.
