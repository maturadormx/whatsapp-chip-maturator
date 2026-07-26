# Política de Evolução dos Contratos

## Governança

Status: `CONGELADO`

Versão: `1.0`

Data:

`2026-07-18`

Categoria:

`Governança Arquitetural`

Regra de governança:

este documento define como os contratos oficiais do `whatsapp-chip-maturator` podem evoluir ao longo do tempo.

Ele existe para preservar estabilidade, previsibilidade e compatibilidade entre arquitetura e implementação.

## Objetivo

Toda mudança em contrato deve ser classificada antes de ser incorporada.

A classificação define o impacto esperado sobre implementações existentes e sobre a versão oficial da arquitetura contratual.

## Classificação das mudanças

| Tipo | Exemplo de versão | Natureza |
|---|---|---|
| `Patch` | `1.0.1` | ajuste editorial ou clarificação sem mudança semântica |
| `Minor` | `1.1` | evolução compatível com contratos anteriores |
| `Major` | `2.0` | mudança incompatível com a versão anterior |

## Patch

Uma mudança `Patch` é permitida quando:

- corrige redação
- remove ambiguidade textual
- melhora organização do texto
- corrige referência cruzada
- padroniza linguagem normativa sem alterar a semântica

Regra:

uma mudança `Patch` não pode alterar comportamento esperado, invariantes, ordem lógica, responsabilidades ou garantias contratuais.

## Minor

Uma mudança `Minor` é permitida quando:

- adiciona detalhe compatível
- amplia documentação de um comportamento já permitido
- introduz capacidade opcional sem quebrar leitores ou implementações existentes
- formaliza uma restrição que já era implicitamente obrigatória e não muda a semântica operacional

Regra:

uma mudança `Minor` deve preservar compatibilidade com implementações aderentes à versão anterior.

## Major

Uma mudança `Major` é obrigatória quando:

- altera significado de estado, evento ou operação
- muda invariantes do domínio
- quebra contratos de entrada ou saída
- altera precedência entre documentos
- modifica a semântica do replay, da persistência ou do motor
- exige adaptação obrigatória de implementações antes compatíveis

Regra:

nenhuma mudança incompatível pode ser publicada como `Patch` ou `Minor`.

## Processo de evolução

Toda proposta de mudança deve declarar explicitamente:

- qual documento será alterado
- qual versão atual está sendo substituída
- qual categoria de mudança está sendo aplicada
- qual impacto existe sobre contratos dependentes
- se há impacto sobre compatibilidade de implementação

## Regra de publicação

Uma nova versão só passa a ser oficial quando:

- a mudança foi decidida explicitamente
- a versão foi atualizada no documento alterado
- o índice `ARQUITETURA_CONTRATUAL_DO_MATURADOR.md` refletiu a nova composição ou a nova versão

## Compatibilidade retroativa

Implementações aderentes à `Arquitetura Contratual 1.0` permanecem válidas enquanto apenas mudanças `Patch` ou `Minor` compatíveis forem publicadas.

Mudanças `Major` inauguram uma nova linha normativa da arquitetura.

## Declaração normativa

Nenhum contrato oficial pode evoluir por conveniência local de implementação.

A implementação deve seguir o contrato vigente.
