# Workers do Chip Maturador

## Governança

Status: `CONGELADO`

Versão: `1.0`

Data:

`2026-07-18`

Categoria:

`Application Layer`

Dependências:

- `Core do Produto`
- `API do Chip Maturador`

Documentos que dependem deste:

- `Interface`
- `Auditoria`

Regra de governança:

este documento define os workers como orquestradores e reatores da camada de aplicação.

Eles não definem domínio, não criam regra de estado e não reinterpretam o core.

Nenhuma implementação deve alterar este documento.

Mudanças requerem decisão explícita de produto.

## Objetivo

Este documento define como os workers reagem a fatos já persistidos ou coordenam operações permitidas do sistema.

Eles existem para integrar, acionar e propagar efeitos externos sem capturar para si a lógica do domínio.

Regra:

um worker somente reage a eventos oficialmente persistidos.

Consequência:

um worker nunca reage diretamente a:

- requisição HTTP
- estado derivado
- cache
- projeção

## Modelo conceitual

`Evento Persistido -> Worker -> API externa / fila / webhook / notificação / projeção`

Leitura funcional:

| Camada | Responsabilidade |
|---|---|
| `Evento Persistido` | fato já oficializado no histórico |
| `Worker` | orquestra reações e integrações |
| `Destino externo` | fila, webhook, notificação, API externa ou projeção |

Regra:

o worker não faz parte do caminho síncrono de requisição da interface para a API.

Ele opera a partir de fatos já persistidos ou de gatilhos assíncronos autorizados.

## Responsabilidades

Os workers:

- reagem a eventos já persistidos
- coordenam chamadas externas autorizadas
- atualizam projeções derivadas, quando permitido
- executam rotinas operacionais recorrentes
- acionam integrações externas

Os workers nunca:

- decidem estados
- criam transições
- interpretam o domínio por conta própria
- alteram a máquina de estados
- redefinem o significado dos eventos
- instanciam o motor para decidir estado por conta própria
- aplicam a máquina de estados diretamente
- reconstruem histórico por fora do core

## Gatilhos de execução

Um worker pode ser iniciado exclusivamente por:

- evento persistido
- agendamento (`scheduler`)
- mensagem de fila
- solicitação explícita da camada de aplicação

Um worker nunca é iniciado por:

- mudança de estado em memória
- projeção derivada
- decisão interna do `Motor de Estados`

## Garantia dos workers

A indisponibilidade de um worker não altera o histórico oficial do chip.

Ela apenas adia:

- integrações
- notificações
- projeções
- efeitos assíncronos permitidos

## Papel na arquitetura

O worker não substitui:

- o `Contrato de Domínio`
- a `Máquina de Estados`
- o `Contrato dos Eventos`
- o `Motor de Estados`

Ele apenas reage a fatos já oficializados ou solicita operações permitidas via `API` ou serviço de aplicação equivalente.

## Tipos de worker

Esta camada pode conter, por exemplo:

- worker de reação a evento persistido
- worker de rotina operacional agendada

### Worker de projeção

Responsável por:

- atualizar `read models`
- atualizar índices
- materializar consultas derivadas

### Worker de integração

Responsável por:

- enviar webhook
- enviar mensagem
- chamar API externa
- enviar notificação

## Relação com o core

| Documento | Responsabilidade |
|---|---|
| `Core do Produto` | regras e interpretação oficial |
| `API` | fronteira contratual |
| `Workers` | orquestração e reação |

## Próximos documentos

Depois deste documento, a sequência natural é:

- `Interface`
- `Auditoria`

## Declaração de congelamento

Este documento está congelado como contrato de orquestração assíncrona da `Application Layer`.
