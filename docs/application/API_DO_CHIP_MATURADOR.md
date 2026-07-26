# API do Chip Maturador

## Governança

Status: `CONGELADO`

Versão: `1.0`

Data:

`2026-07-18`

Categoria:

`Application Layer`

Dependências:

- `Core do Produto`

Documentos que dependem deste:

- `Workers`
- `Interface`
- `Auditoria`

Regra de governança:

este documento define a fronteira entre consumidores externos e o `Core do Produto`.

Ele não define regras de domínio.

Para efeito de arquitetura, o `Core do Produto` é composto por:

- `Contrato de Domínio do Chip`
- `Máquina de Estados do Chip`
- `Contrato dos Eventos do Chip`
- `Motor de Estados do Chip`
- `Persistência do Histórico do Chip`

Nenhuma implementação deve alterar este documento.

Mudanças requerem decisão explícita de produto.

## Objetivo

A API constitui a fronteira entre consumidores externos e o core do produto.

Ela não define regras de domínio, estados, eventos ou políticas operacionais.

Sua responsabilidade é:

- receber requisições
- validar estrutura e semântica básica
- mapear operações para o domínio
- devolver respostas compatíveis com os contratos oficiais

## Modelo conceitual

`Cliente -> API -> Validação -> Core do Produto -> Motor -> Persistência`

Leitura funcional:

| Camada | Responsabilidade |
|---|---|
| `Cliente` | envia intenção e consome resposta |
| `API` | fronteira contratual de entrada e saída |
| `Validação` | valida forma e consistência básica |
| `Core do Produto` | aplica regras de domínio |
| `Motor` | interpreta histórico e deriva estado |
| `Persistência` | preserva histórico oficial |

## Responsabilidades

A API:

- recebe requisições
- valida estrutura
- autentica e autoriza, quando aplicável
- converte requisições em operações compatíveis com o core
- converte resultados em respostas

A API nunca:

- altera regras da máquina de estados
- cria estados
- interpreta histórico
- modifica eventos
- inventa transições

## Operações permitidas

As operações públicas do contrato são:

- `CreateChip`
- `PairChip`
- `AppendEvent`
- `GetChipHistory`
- `GetCurrentState`
- `ReplayHistory`
- `CloseChip`

Regra:

este documento define operações contratuais, não endpoints HTTP específicos.

## Operações vs eventos

Operações da API e eventos do domínio não são a mesma coisa.

| Tipo | Natureza |
|---|---|
| `CreateChip` | operação da API |
| `PairChip` | operação da API |
| `AppendEvent` | operação da API |
| `GetChipHistory` | operação da API |
| `GetCurrentState` | operação da API |
| `ReplayHistory` | operação da API |
| `CloseChip` | operação da API |
| `chip_created` | evento do domínio |
| `chip_paired` | evento do domínio |
| `incident_opened` | evento do domínio |
| `recovery_started` | evento do domínio |
| `chip_closed` | evento do domínio |

Regra:

a operação externa pede algo ao sistema.

o evento registra um fato que efetivamente ocorreu no domínio.

## Contratos de entrada

Toda operação deve definir:

- estrutura mínima
- campos obrigatórios
- validação sintática
- validação semântica básica

## Contratos de saída

Toda operação deve definir:

- resposta de sucesso
- resposta de erro
- quando retorna histórico
- quando retorna projeção de estado

## Validações

### Sintáticas

Exemplos de validação sintática:

- JSON bem formado
- campos obrigatórios presentes
- tipos corretos
- UUID válido
- data em `ISO-8601`

### Semânticas

Exemplos de validação semântica:

- chip existe
- operação compatível com a fase atual
- evento conhecido
- `sequence` não enviada pelo cliente quando for responsabilidade da persistência

## Erros

A API deve separar claramente categorias de erro:

| Categoria | Responsável |
|---|---|
| `Requisição inválida` | API |
| `Evento inválido` | Core |
| `Violação de transição` | Máquina de Estados |
| `Inconsistência histórica` | Motor |
| `Persistência indisponível` | Infraestrutura |

## Versionamento

O versionamento da API é independente do versionamento dos eventos.

Regra:

evoluções de transporte ou contrato externo não podem alterar a semântica dos eventos nem as regras do domínio.

## Limites da API

A API não possui autoridade para modificar regras do domínio.

Toda decisão de negócio pertence exclusivamente ao `Core do Produto`.

## Garantia da API

A API não redefine o comportamento do sistema.

Ela apenas expõe capacidades do `Core do Produto` para consumidores externos.

Regra:

se houver conflito entre a API e o core, a API deve ser ajustada e o core prevalece.

## Relação com o core

| Documento | Responsabilidade |
|---|---|
| `Contrato de Domínio` | identidade e invariantes |
| `Máquina de Estados` | transições válidas |
| `Contrato dos Eventos` | fatos e schemas |
| `Motor de Estados` | interpretação determinística |
| `Persistência` | histórico oficial |
| `API` | exposição contratual do core |

## Próximos documentos

Depois deste documento, a sequência natural é:

- `Workers`
- `Interface`
- `Auditoria`

## Declaração de congelamento

Este documento está congelado como fronteira contratual da `Application Layer`.
