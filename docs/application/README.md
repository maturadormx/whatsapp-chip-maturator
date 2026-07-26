# Application Layer

## Objetivo

Esta pasta reúne os contratos da camada de aplicação do `whatsapp-chip-maturator`.

Aqui não nasce regra de domínio.

Aqui nascem os adaptadores e orquestradores que expõem o `Core do Produto` para consumidores externos e para os fluxos internos do sistema.

Todos os documentos desta pasta integram a `Arquitetura Contratual do Maturador 1.0`.

## Relação com o core

O `Core do Produto` já está congelado até:

- `Contrato de Domínio do Chip`
- `Máquina de Estados do Chip`
- `Contrato dos Eventos do Chip`
- `Motor de Estados do Chip`
- `Persistência do Histórico do Chip`

A `Application Layer` existe para:

- receber entradas externas
- validar estrutura e semântica básica
- mapear operações para o core
- devolver respostas compatíveis com os contratos oficiais

## Fluxo arquitetural

Fluxo síncrono:

`Interface -> API -> Core do Produto`

Fluxo assíncrono:

`Core do Produto -> Persistência -> Eventos Persistidos -> Workers / Auditoria`

Regra:

os `Workers` não fazem parte do caminho síncrono entre interface e API.

A `Auditoria` também observa a partir de fatos já persistidos e não participa da decisão de domínio.

## Documentos desta camada

### API do Chip Maturador

- [API do Chip Maturador](computer://C:\Users\AORUS\AppData\Roaming\TRAE%20SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\application\API_DO_CHIP_MATURADOR.md)

Define a fronteira contratual entre consumidores externos e o core do produto.

Está congelada como camada de exposição do core.

### Workers do Chip Maturador

- [Workers do Chip Maturador](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\application\WORKERS_DO_CHIP_MATURADOR.md)

Define os workers como orquestradores e reatores da camada de aplicação, sem poder para reinterpretar o domínio.

Estão congelados como camada assíncrona de reação a fatos persistidos.

### Interface do Chip Maturador

- [Interface do Chip Maturador](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\application\INTERFACE_DO_CHIP_MATURADOR.md)

Define a interface como consumidora exclusiva da API, sem acesso direto ao core.

Está congelada como camada de consumo contratual da API.

### Auditoria do Chip Maturador

- [Auditoria do Chip Maturador](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\application\AUDITORIA_DO_CHIP_MATURADOR.md)

Define a camada responsável por rastreabilidade, verificação de integridade, conformidade e replay para validação do comportamento do sistema.

Também congela a independência da auditoria, a hierarquia das evidências e os tipos oficiais de verificação.

## Governança da arquitetura

- [Arquitetura Contratual do Maturador](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\ARQUITETURA_CONTRATUAL_DO_MATURADOR.md)
- [Política de Evolução dos Contratos](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\POLITICA_DE_EVOLUCAO_DOS_CONTRATOS.md)

Esses documentos definem a versão oficial da arquitetura e o regime de evolução dos contratos.

## Regra de dependência

As dependências sempre apontam para baixo:

`Application Layer -> Persistência -> Motor -> Eventos -> Máquina -> Domínio`

Nenhum documento desta camada redefine o core.
