# 0009 Mock Gateway Script

## Status

Aceito

## Decisão

O `MockMessageGateway` passa a usar script determinístico em vez de configuração probabilística.

## Consequência

Testes ficam reproduzíveis, cenários ficam literais e `reset()` restaura exatamente o script inicial do cenário.
