# MATURADOR_BASELINE_RECONSTRUCAO

## Objetivo

Definir como o `whatsapp-chip-maturator` deveria ser e comparar essa baseline com a pasta atual.

Este documento existe para separar:

- o que é estrutura essencial
- o que é crescimento operacional legítimo
- o que é ruído de runtime
- o que está ausente

## Baseline esperada

A baseline documental e operacional do projeto, consolidada por:

- `BASELINE_FREEZE_v1.0.0-operational.md`
- `WHATSAPP_MATURATOR_ARCHITECTURE.md`
- `IMPLEMENTACAO_DO_MATURADOR.md`
- `PROJECT.md`
- `PROJECT_STATUS.md`

aponta que a forma esperada do projeto inclui, no mínimo:

```text
whatsapp-chip-maturator/
├── client/
├── server/
├── shared/
├── docs/
├── scripts/
├── tests/
├── drizzle/
├── monitoring/
├── runbooks/
├── package.json
├── package-lock.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── drizzle.config.ts
├── README.md
├── CHANGELOG.md
├── PROJECT.md
├── PROJECT_STATUS.md
└── BASELINE_FREEZE_v1.0.0-operational.md
```

## Estrutura esperada por camada

### Frontend

- `client/src/pages`
- `client/src/components`
- `client/src/contexts`
- `client/src/hooks`
- `client/src/lib`
- `client/src/_core`

### Backend

- `server/_core`
- `server/application`
- `server/domain`
- `server/gateways`
- `server/inbound`
- `server/infrastructure`
- `server/metrics`
- `server/ports`
- `server/repositories`
- `server/routers`
- `server/routes`
- `server/rules`
- `server/runtime`
- `server/scheduled`
- `server/services`
- `server/telemetry`
- `server/utils`

### Shared

- `shared/_core`
- `shared/const.ts`
- `shared/types.ts`

### Operação e governança

- `docs/adr`
- `docs/application`
- `docs/architecture`
- `docs/core`
- `docs/governance`
- `docs/history`
- `docs/implementation`
- `docs/operations`
- `docs/release`
- `docs/reviews`
- `docs/roadmap`
- `docs/runbooks`

## Comparação

## ✔ Existe

### Núcleo do produto

- `client/`
- `server/`
- `shared/`
- `docs/`
- `scripts/`
- `tests/`
- `drizzle/`

### Configuração e contratos

- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`
- `tsconfig.json`
- `vite.config.ts`
- `vitest.config.ts`
- `drizzle.config.ts`

### Documentos principais

- `README.md`
- `CHANGELOG.md`
- `PROJECT.md`
- `PROJECT_STATUS.md`
- `BASELINE_FREEZE_v1.0.0-operational.md`
- `WHATSAPP_MATURATOR_ARCHITECTURE.md`
- `IMPLEMENTACAO_DO_MATURADOR.md`

### Operação

- `monitoring/`
- `grafana/`
- `runbooks/`
- `release/`
- `reports/`
- `evidencias/`

## ❌ Falta

- `.git`
- `electron/`
- `agent/` como módulo separado

### Leitura

- a ausência de `.git` é a perda estrutural importante
- a ausência de `electron/` não é necessariamente perda, porque ele não aparece como camada principal na arquitetura congelada
- `agent/` separado não faz parte da organização atual do projeto

## ⚠ Mudou

### A pasta atual ficou muito mais operacional do que o backup limpo

Diferenças confirmadas:

- `141` diretórios no atual
- `21` diretórios no backup
- `4111` arquivos no atual
- `88` arquivos no backup

### O que foi acrescentado no atual

Principais grupos acrescentados:

- `.github/`
- `.manus-logs/`
- `auth_info_1` até `auth_info_12`
- `datasets/`
- `dist/`
- `docs/certification`
- `docs/core`
- `docs/future`
- `docs/governance`
- `docs/history`
- `docs/implementation`
- `docs/operations`
- `docs/release`
- `docs/reviews`
- `docs/roadmap`
- `docs/runbooks`
- `drizzle/meta`
- `drizzle/migrations`
- `evidencias/`
- `forensics/`
- `grafana/`
- `monitoring/`
- `patches/`
- `release/v1.0.0-operational`
- `reports/`
- `scripts/*`
- `server/*`

### O que o backup tem e o atual não tem

A comparação encontrou apenas um arquivo exclusivo do backup:

- `docs/architecture/ARQUITETURA_CONTRATUAL_DO_MATURADOR.md`

### O que permaneceu igual

`87` arquivos são idênticos entre atual e backup.

### O que mudou de conteúdo

- `0` arquivos diferentes com mesmo caminho

Leitura:

o backup não é uma “versão melhor” do código. Ele é um recorte limpo e reduzido. O atual expandiu o projeto com runtime, infraestrutura, docs e operação, mas preservou o conteúdo compartilhado.

## Interpretação

O estado atual não representa perda da baseline. Ele representa uma evolução operacional sobre a baseline limpa.

O que precisa ser tratado com cuidado não é reconstrução de código base, e sim:

- remoção lógica entre código-fonte e artefatos operacionais
- controle de `.env`
- controle de `auth_info_*`
- restauração de `.git`

## Uso deste documento

Use esta baseline para responder:

1. o que é código essencial
2. o que é infraestrutura operacional
3. o que veio do backup limpo
4. o que foi agregado depois
5. o que não pode ser confundido com “corrupção”
