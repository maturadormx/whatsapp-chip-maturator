# 0010 Persistir Observation antes de gerar Fact

## Status

Aceito

## Decisão

Toda entrada HTTP válida gera uma `Observation`. A `Observation` é persistida antes de qualquer transformação. `Fact` é sempre derivado e pode ser regenerado a partir da `Observation` persistida.

## Invariantes

- `Observation` nunca é modificada após criada
- `Fact` nunca é persistido antes da `Observation`
- toda `Fact` possui exatamente uma `Observation` de origem
- `Observation` pode existir sem `Fact`
- `Observation` é persistida exatamente uma vez para cada processamento bem-sucedido do pipeline

## Consequências

Positivas:

- rastreabilidade completa da entrada ao estado derivado
- replay possível para debugging ou reprocessamento
- regras de negócio determinísticas (mesma entrada → mesmo Fact)
- `Event Store` pode ser introduzido futuramente sem alterar o contrato HTTP

Negativas:

- overhead de I/O no caminho crítico (aceitável no estágio atual)

## Política de falha

Se `repository.save(observation)` falhar:

- o pipeline é interrompido imediatamente
- `FactFactory` não é executada
- o erro é propagado ao chamador
- o endpoint HTTP retorna `500 Internal Server Error`

## Observação operacional

`Observation` é o registro canônico da entrada. `Fact` é sempre derivado e pode ser regenerado a partir da `Observation` persistida.

