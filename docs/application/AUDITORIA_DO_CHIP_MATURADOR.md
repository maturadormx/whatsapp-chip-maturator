# Auditoria do Chip Maturador

## Governança

Status: `CONGELADO`

Versão: `1.2`

Data:

`2026-07-18`

Categoria:

`Application Layer`

Dependências:

- `Core do Produto`
- `API do Chip Maturador`
- `Workers do Chip Maturador`
- `Interface do Chip Maturador`

Regra de governança:

este documento define a camada responsável por rastreabilidade, conformidade e verificação do comportamento observado do sistema.

Ele não redefine regras de domínio nem altera o comportamento oficial do produto.

Nenhuma implementação deve alterar este documento.

Mudanças requerem decisão explícita de produto.

## Objetivo

Este documento define como o sistema registra, verifica e relata o comportamento do chip e das camadas de aplicação.

A auditoria existe para:

- rastrear operações
- verificar integridade
- detectar inconsistências
- produzir relatórios de conformidade
- executar replay para validação

## Modelo conceitual

`Histórico Oficial + Operações da Application Layer -> Auditoria -> Relatórios / alertas / evidências`

Leitura funcional:

| Camada | Responsabilidade |
|---|---|
| `Histórico Oficial` | fonte primária de verdade do comportamento do chip |
| `Application Layer` | origem das operações, integrações e interações observáveis |
| `Auditoria` | verifica consistência, conformidade, rastreabilidade e determinismo |
| `Saídas` | relatórios, alertas, evidências e validações |

## Independência

Princípio:

a auditoria é uma camada exclusivamente observadora.

Sua indisponibilidade não altera:

- o comportamento do `Core do Produto`
- o resultado das operações da `API`
- a execução dos `Workers`
- a evolução do histórico oficial

Consequência:

a indisponibilidade da auditoria pode impedir:

- geração de relatórios
- emissão de alertas
- produção de evidências

Ela nunca altera o comportamento funcional do sistema.

## Responsabilidades

A auditoria:

- registra operações relevantes
- verifica conformidade entre histórico e comportamento observado
- detecta inconsistências
- confirma replay determinístico
- produz evidências e relatórios

A auditoria nunca:

- altera o histórico oficial
- redefine estados
- corrige automaticamente o domínio
- substitui o motor de estados

## Fontes auditáveis

A auditoria pode observar:

- histórico oficial de eventos
- resultados do motor de estados
- operações expostas pela API
- reações executadas por workers
- respostas exibidas pela interface, quando registradas formalmente

## Hierarquia das evidências

| Fonte | Natureza |
|---|---|
| `Histórico oficial de eventos` | evidência primária |
| `Resultado do Motor de Estados` | evidência derivada |
| `Operações da API` | evidência operacional |
| `Execuções dos Workers` | evidência operacional |
| `Registros da Interface` | evidência auxiliar |

Regra:

em caso de divergência, o histórico oficial prevalece sobre qualquer outra evidência.

## Garantias da auditoria

A auditoria:

- nunca altera evidências observadas
- nunca modifica eventos
- nunca altera projeções produzidas pelo motor
- nunca reordena fatos
- nunca produz novos fatos de domínio

## Imutabilidade das evidências de auditoria

Princípio:

toda evidência produzida pela auditoria é somente leitura após sua persistência.

Regra:

correções, complementações ou reclassificações nunca modificam uma evidência existente.

Elas devem gerar uma nova evidência relacionada, preservando a rastreabilidade entre o registro original e o registro posterior.

## Escopo mínimo

Esta camada deve cobrir, no mínimo:

- registro de operações
- rastreabilidade
- verificação de integridade
- detecção de inconsistências
- relatórios de conformidade
- replay para validação

## Tipos de verificação

| Tipo | Objetivo |
|---|---|
| `Integridade` | verificar consistência do histórico |
| `Conformidade` | verificar aderência aos contratos |
| `Consistência` | verificar projeções derivadas |
| `Determinismo` | verificar replay |
| `Operacional` | verificar execução da camada de aplicação |

## Replay para auditoria

A auditoria pode solicitar replay do histórico oficial para validar:

- consistência das projeções
- determinismo do motor de estados
- conformidade do comportamento observado

Regra:

o replay utiliza exclusivamente:

- `Histórico Oficial`
- `Motor de Estados`

Nenhuma projeção persistida participa dessa validação.

## Relação com o core

| Documento | Responsabilidade |
|---|---|
| `Core do Produto` | define o comportamento oficial |
| `Application Layer` | executa adaptação, integração e exposição |
| `Auditoria` | verifica se a execução respeita o comportamento oficial |

## Resultado esperado

| Pergunta | Resposta esperada |
|---|---|
| O que aconteceu? | registro das operações |
| Quando aconteceu? | rastreabilidade temporal |
| Em que ordem aconteceu? | sequência lógica oficial |
| Qual estado foi derivado? | verificação com o motor |
| Houve inconsistência? | detecção e registro |
| O comportamento respeitou os contratos do sistema? | verificação de conformidade |
| O comportamento pode ser reproduzido? | replay determinístico do histórico oficial |

## Declaração de congelamento

Este documento está congelado como contrato de rastreabilidade, conformidade e verificação da `Application Layer`.
