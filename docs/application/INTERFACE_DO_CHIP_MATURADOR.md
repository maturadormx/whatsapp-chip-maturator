# Interface do Chip Maturador

## Governança

Status: `CONGELADO`

Versão: `1.0`

Data:

`2026-07-18`

Categoria:

`Application Layer`

Dependências:

- `API do Chip Maturador`

Documentos que dependem deste:

- `Auditoria`

Regra de governança:

este documento define a interface como consumidora exclusiva da `API`.

Ela não acessa nem interpreta diretamente o `Core do Produto`.

Nenhuma implementação deve alterar este documento.

Mudanças requerem decisão explícita de produto.

## Objetivo

Este documento define como a interface consome capacidades do sistema sem adquirir autoridade sobre domínio, eventos, máquina, motor ou persistência.

A interface existe para apresentar informação derivada, capturar intenção do operador e encaminhar operações permitidas para a `API`.

## Modelo conceitual

`Interface -> API -> Core do Produto`

Leitura funcional:

| Camada | Responsabilidade |
|---|---|
| `Interface` | apresenta informações e captura intenção do usuário |
| `API` | traduz intenções e respostas para o core |
| `Core do Produto` | aplica regras oficiais do sistema |

## Responsabilidades

A interface:

- consome respostas da API
- apresenta projeções e históricos expostos pela API
- coleta intenção do operador
- envia operações permitidas pela API
- exibe estados e leituras derivadas sem redefinir sua semântica

A interface nunca:

- acessa diretamente a máquina de estados
- interpreta eventos do domínio por conta própria
- acessa persistência diretamente
- invoca o motor diretamente
- redefine estados ou transições

## Limite principal

A interface conhece apenas a `API`.

Ela não conhece:

- `Máquina de Estados`
- `Contrato dos Eventos`
- `Motor de Estados`
- `Persistência`

## Garantia normativa

A interface nunca depende de tipos, estados, eventos ou estruturas internas do `Core do Produto`.

Toda informação consumida pela interface deve ser exposta pela `API`.

Regra:

se houver conflito entre comportamento desejado da interface e os contratos do core, a interface deve ser ajustada e o core prevalece.

## Próximos documentos

Depois deste documento, a sequência natural é:

- `Auditoria`

## Declaração de congelamento

Este documento está congelado como contrato de consumo da `API` pela `Application Layer`.
