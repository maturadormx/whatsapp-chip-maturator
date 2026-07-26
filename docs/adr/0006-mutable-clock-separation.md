# 0006 Mutable Clock Separation

## Status

Aceito

## Decisão

O contrato de produção expõe apenas `Clock`. A mutabilidade de teste fica separada em um contrato próprio.

## Consequência

Métodos de teste não vazam para a API de produção e o domínio permanece acoplado apenas ao mínimo necessário.
