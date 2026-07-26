# 0003 Mock Gateway

## Status

Aceito

## Decisão

O ambiente de teste e desenvolvimento local usa um `MockMessageGateway` como adapter de teste do contrato `MessageGateway`.

## Consequência

O núcleo continua estável enquanto o comportamento de transporte pode ser simulado sem infraestrutura externa.
