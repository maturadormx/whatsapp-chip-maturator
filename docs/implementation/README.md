# Implementação

## Objetivo

Esta pasta reúne documentos de implementação que materializam fisicamente os contratos já congelados.

Eles não substituem o `Core do Produto`.

Eles existem para mostrar como os contratos foram traduzidos para código, tabelas, stores, workers e serviços reais.

## Regra de leitura

Se houver conflito entre um documento desta pasta e um contrato congelado do `Core do Produto`, o contrato congelado prevalece.

Documentos desta pasta devem obedecer à `Arquitetura Contratual do Maturador 1.0`.

Em caso de divergência, os documentos do `Core` prevalecem sobre qualquer documento da pasta `implementation`.

A documentação de implementação descreve uma materialização atual e pode evoluir sem alterar o contrato arquitetural.

## Documentos atuais

### Modelo de Persistência do Chip

- [Modelo de Persistência do Chip](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\implementation\MODELO_DE_PERSISTENCIA_DO_CHIP.md)

Traduz o contrato de persistência para a materialização física atual em `MySQL + Drizzle`, separando stream oficial, projeções derivadas, checkpoints assíncronos e evidências append-only da auditoria.

### Entidades e Value Objects do Chip

- [Entidades e Value Objects do Chip](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\implementation\ENTIDADES_E_VALUE_OBJECTS_DO_CHIP.md)

Identifica como os conceitos centrais do domínio foram materializados em tipos, objetos de valor e saídas do motor na implementação atual.

### Aggregate do Chip

- [Aggregate do Chip](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\implementation\AGGREGATE_DO_CHIP.md)

Define como o aggregate foi implementado semanticamente por replay sobre o stream oficial, sem criar uma fonte paralela de verdade.

### Event Store do Chip

- [Event Store do Chip](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\implementation\EVENT_STORE_DO_CHIP.md)

Define a interface e as implementações responsáveis por anexar eventos, ler histórico e expor fatos persistidos para consumo assíncrono.

### Repositories do Chip

- [Repositories do Chip](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\implementation\REPOSITORIES_DO_CHIP.md)

Define como a noção de repositório foi distribuída entre stream oficial, projeções derivadas e evidências append-only na implementação atual.

### API do Chip — Implementação

- [API do Chip — Implementação](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\implementation\API_DO_CHIP_IMPLEMENTACAO.md)

Descreve a fronteira atual da API contratual do chip, com serviço de aplicação, router `tRPC`, validação de entrada, tradução de erros e integração com o Event Store.

### Workers do Chip — Implementação

- [Workers do Chip — Implementação](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\implementation\WORKERS_DO_CHIP_IMPLEMENTACAO.md)

Descreve o worker atual de projeção, o uso de checkpoints, o consumo de fatos persistidos e a integração com heartbeat e runtime administrativo.

### Auditoria do Chip — Implementação

- [Auditoria do Chip — Implementação](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\implementation\AUDITORIA_DO_CHIP_IMPLEMENTACAO.md)

Descreve a auditoria baseada em replay, a produção de evidências append-only e a sua integração com a API e o runtime.

### Runtime e Integração com o legado

- [Runtime e Integração com o legado](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\implementation\RUNTIME_E_INTEGRACAO_COM_O_LEGADO.md)

Descreve como a nova espinha contratual foi encaixada no runtime real do projeto, convivendo com estruturas operacionais legadas de forma controlada.

### Interface e Console Administrativo

- [Interface e Console Administrativo](computer://C:\Users\AORUS\AppData\Roaming\TRAE SOLO\ModularData\ai-agent\work-mode-projects\6a54f97e29ef92b9a21a9633\whatsapp-chip-maturator\docs\implementation\INTERFACE_E_CONSOLE_ADMINISTRATIVO.md)

Descreve a superfície administrativa atual do sistema, incluindo runtime supervisor, rotas de operação da nova espinha contratual e convivência com o console legado.
