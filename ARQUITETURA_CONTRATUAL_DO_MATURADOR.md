# Arquitetura Contratual do Maturador

## Governança

Status: `CONGELADO`

Versão da arquitetura: `1.0`

Data:

`2026-07-18`

Categoria:

`Índice Normativo`

Regra de governança:

este documento define o conjunto oficial dos contratos que compõem a base normativa do `whatsapp-chip-maturator`.

Toda implementação deve ser compatível com esta arquitetura contratual.

Nenhuma implementação possui autoridade para reinterpretar estes contratos por conveniência técnica.

Mudanças nesta arquitetura requerem decisão explícita de produto e arquitetura.

## Objetivo

Este documento identifica a versão oficial da arquitetura contratual e reúne os contratos normativos que governam o comportamento do sistema.

Ele existe para que a equipe possa afirmar, de forma objetiva, se uma implementação é ou não compatível com a arquitetura vigente.

## Escopo da arquitetura 1.0

A `Arquitetura Contratual 1.0` é composta por nove contratos oficiais.

### Core do Produto

| Documento | Papel |
|---|---|
| `Contrato de Domínio do Chip` | define identidade, permanência e invariantes do chip |
| `Máquina de Estados do Chip` | define estados, transições válidas e restauração por `estado_anterior` |
| `Contrato dos Eventos do Chip` | define fatos oficiais, estrutura canônica, ordem lógica e replay |
| `Motor de Estados do Chip` | define a interpretação determinística do histórico |
| `Persistência do Histórico do Chip` | define compromisso, estabilidade e integridade do histórico oficial |

### Application Layer

| Documento | Papel |
|---|---|
| `API do Chip Maturador` | define a fronteira contratual de entrada e saída do sistema |
| `Workers do Chip Maturador` | define a orquestração assíncrona reagindo apenas a fatos persistidos |
| `Interface do Chip Maturador` | define a interface como consumidora exclusiva da API |
| `Auditoria do Chip Maturador` | define rastreabilidade, conformidade, evidências e replay auditável |

## Regra de precedência

Em caso de divergência entre documentos, a leitura normativa deve respeitar a seguinte hierarquia:

`Contrato de Domínio -> Máquina de Estados -> Contrato dos Eventos -> Motor -> Persistência -> API -> Workers -> Interface -> Auditoria`

Regra:

nenhum documento da `Application Layer` pode redefinir qualquer regra do `Core do Produto`.

## Compatibilidade de implementação

Uma implementação é compatível com a `Arquitetura Contratual 1.0` quando:

- preserva o histórico oficial como fonte primária de verdade
- trata o estado como derivação do histórico
- mantém o motor como função pura e determinística
- respeita a separação entre `Core do Produto` e `Application Layer`
- impede que `API`, `Workers`, `Interface` ou `Auditoria` invadam a autoridade do domínio

## Política de evolução

A evolução desta arquitetura é regida por:

- `POLITICA_DE_EVOLUCAO_DOS_CONTRATOS.md`

## Declaração normativa

A base normativa do sistema está estabelecida nesta versão.

Toda implementação futura deve obedecer à `Arquitetura Contratual do Maturador 1.0`.
