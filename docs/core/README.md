# Core do Produto

## Objetivo

Esta pasta reúne os contratos mais estáveis do `whatsapp-chip-maturator`.

Esses documentos não existem para detalhar API, banco, interface ou automações. Eles existem para congelar o comportamento do produto antes da implementação.

O conjunto oficial destes contratos é consolidado em [Arquitetura Contratual do Maturador](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\ARQUITETURA_CONTRATUAL_DO_MATURADOR.md).

## Regra de leitura

Todo código operacional do projeto deve existir para cumprir estes contratos.

Se um serviço, endpoint, tabela, job ou interface entrar em conflito com este núcleo, o conflito precisa ser tratado como decisão arquitetural deliberada, e não como ajuste casual de implementação.

## Documentos centrais

### Arquitetura

- [Arquitetura do projeto de maturação de WhatsApp](computer://C:\Users\AORUS\AppData\Roaming\TRAE%20SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\WHATSAPP_MATURATOR_ARCHITECTURE.md)

Congela a visão estrutural geral do sistema, seus domínios e o papel de cada camada.

### Especificação do Chip

- [Especificação do Chip](computer://C:\Users\AORUS\AppData\Roaming\TRAE%20SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\ESPECIFICACAO_DO_CHIP.md)

Define o `Chip` como entidade permanente do domínio, com nascimento único, identidade contínua, timeline preservada e auditoria obrigatória.

### Máquina de Estados do Chip

- [Máquina de Estados do Chip](computer://C:\Users\AORUS\AppData\Roaming\TRAE%20SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\core\MAQUINA_DE_ESTADOS_DO_CHIP.md)

Define a linha da vida do chip, as transições válidas e a regra de retorno ao estado anterior após recuperação.

Também congela que `estado_atual` é derivado dos eventos e nunca a fonte primária da verdade.

### Contrato de Eventos do Chip

- [Contrato de Eventos do Chip](computer://C:\Users\AORUS\AppData\Roaming\TRAE%20SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\core\CONTRATO_DE_EVENTOS_DO_CHIP.md)

Define os fatos oficiais da vida do chip, a semântica estável de cada evento, a estrutura canônica, a ordem lógica, idempotência, replay e o catálogo oficial de eventos.

### Motor de Estados do Chip

- [Motor de Estados do Chip](computer://C:\Users\AORUS\AppData\Roaming\TRAE%20SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\core\MOTOR_DE_ESTADOS_DO_CHIP.md)

Define o algoritmo determinístico que interpreta o histórico do chip, aplica o contrato dos eventos sobre a máquina de estados e devolve o estado derivado.

Também congela o contrato de entrada, saída, inconsistências oficiais, replay, limites e garantias do motor.

### Persistência do Histórico do Chip

- [Persistência do Histórico do Chip](computer://C:\Users\AORUS\AppData\Roaming\TRAE%20SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\core\PERSISTENCIA_DO_HISTORICO_DO_CHIP.md)

Define como o histórico oficial do chip é preservado com atomicidade, integridade, idempotência, ordem lógica e leitura adequada para replay.

Também congela o ponto exato em que um evento passa a integrar o histórico oficial e a estabilidade imutável do stream após confirmação.

Materialização física correspondente:

- [Modelo de Persistência do Chip](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\implementation\MODELO_DE_PERSISTENCIA_DO_CHIP.md)

### Sprint 0

- [Operation Checklist](computer://C:\Users\AORUS\AppData\Roaming\TRAE%20SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\OPERATION_CHECKLIST.md)

Congela os critérios de aceite da Sprint 0 e os gates de sobrevivência operacional.

### Incidentes

- [Sprint 0 Operational Incidents](computer://C:\Users\AORUS\AppData\Roaming\TRAE%20SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\SPRINT0_OPERATIONAL_INCIDENTS.md)

Registra os desvios reais da janela operacional e impede que a memória do projeto fique apenas na cabeça de quem está executando.

## Contratos operacionais

Os contratos operacionais do projeto passam a nascer deste núcleo:

- a vida do chip é contínua
- a identidade do chip é imutável
- fatos de domínio acontecem antes da transição de estado
- o contrato dos eventos define fatos, schema e ordem lógica
- o motor interpreta o histórico, não redefine o domínio
- o motor não tem efeitos colaterais
- a persistência materializa a ordem lógica sem redefinir o contrato
- incidente vem antes de recuperação
- recuperação não renasce o chip
- recuperação falha leva a isolamento, não a renascimento
- timeline não é apagada
- eventos são a fonte da verdade
- auditoria acompanha toda transição
- Sprint 0 valida comportamento, não expansão de funcionalidade

## Regra de mudança

Esses documentos não devem mudar por conveniência de implementação.

Eles só devem mudar quando houver decisão explícita de produto ou de arquitetura.

A classificação dessa mudança deve seguir a [Política de Evolução dos Contratos](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\POLITICA_DE_EVOLUCAO_DOS_CONTRATOS.md).

## Transição de camada

Com o `Core do Produto` congelado até a `Persistência`, a próxima etapa natural do projeto deixa de ser core e passa a ser `Application Layer`.

Primeiro documento dessa camada:

- `API`
