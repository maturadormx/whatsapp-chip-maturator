# AUDITORIA COMPLETA

## whatsapp-chip-maturator
**Data:** 2026-07-22
**Estado atual:** operacional
**Baseline:** `v1.0.0-operational`

---

## Resumo

O repositório já está em estado maduro para operação, mas ainda carrega vestígios típicos de desenvolvimento acelerado:

- documentação importante ainda espalhada entre raiz, `docs/` e `release/`
- páginas e componentes com forte sinal de orfandade
- scripts históricos e alternativos coexistindo com scripts oficiais
- diretórios de autenticação e artefatos operacionais misturados ao código-fonte
- relatórios intermediários antigos ainda presentes na raiz

Isso não bloqueia a operação.
Mas justifica uma faxina técnica antes de iniciar o Disparador.

---

## Resultado da varredura

| Item | Situação | Ação |
|---|---|---|
| Arquivos mortos / órfãos | 5 candidatos fortes | revisar e remover |
| Pastas operacionais misturadas ao código | 10+ diretórios `auth_info_*` | mover para área runtime |
| Scripts antigos / redundantes | 4 candidatos | arquivar ou consolidar |
| Dependências / componentes pouco integrados | 3 blocos suspeitos | revisar antes de remover |
| Markdown duplicado / disperso | alto | reorganizar e indexar |
| Pastas vazias | não conclusivo nesta rodada | revisar depois com limpeza controlada |

---

## Classificação

Nesta revisão, a classificação passa a seguir três níveis:

- `Confirmado`
- `Suspeito`
- `Precisa rastreamento`

### 🟢 Confirmado

#### 1. `client/src/pages/Home.tsx`

Motivo:
- página de exemplo/template
- não está roteada em `App.tsx`
- contém texto explícito de exemplo:
  - `Example Page`
  - `replace with your own feature implementation`

Ação sugerida:
- remover

#### 2. `validate-fluxos.sh`

Motivo:
- foi substituído na certificação local por `validate-fluxos.ps1`
- o host atual é Windows
- a própria rodada anterior mostrou inadequação do uso de `bash` aqui

Ação sugerida:
- arquivar ou remover

#### 3. `coleta-evidencias.sh`

Motivo:
- há contraparte PowerShell
- shell script sem valor claro para o fluxo operacional atual em Windows

Ação sugerida:
- arquivar ou remover

#### 4. relatórios intermediários de sprint já superados

Candidatos:
- `SPRINT_E2_DIFF.txt`
- `SPRINT_E2_LOCAL_DIFF.txt`
- `SPRINT_E2_GATES_DIFF.txt`
- `SPRINT_E2_FINAL_DIFF.txt`

Motivo:
- a decisão final já foi consolidada em:
  - `E2_CERTIFICATION_REPORT.md`
  - `BASELINE_FREEZE_v1.0.0-operational.md`
  - `MATURADOR_v1.0.0_OPERATIONAL_DIFF.txt`

Ação sugerida:
- mover para pasta histórica ou arquivar fora da raiz

#### 5. `aceite-operacional-d2.txt`

Motivo:
- artefato histórico pontual
- baixo valor como documento-raiz permanente

Ação sugerida:
- arquivar em pasta histórica

---

### 🟡 Suspeito

#### 1. `client/src/pages/ComponentShowcase.tsx`

Motivo:
- não aparece roteada em `App.tsx`
- usa componentes como `AIChatBox`
- parece showroom interno de UI

Risco:
- pode estar servindo como laboratório visual/manual

Ação sugerida:
- revisar com cuidado
- confirmar se faz parte de QA ou validação manual
- se não fizer parte da rotina do time, mover para `internal/` ou remover

#### 2. `client/src/components/AIChatBox.tsx`

Motivo:
- evidência de uso encontrada apenas via `ComponentShowcase.tsx`
- não há indício de uso no produto operacional principal

Ação sugerida:
- revisar junto com `ComponentShowcase.tsx`
- só remover após confirmação de `0` referências úteis

#### 3. `client/src/components/Map.tsx`

Motivo:
- componente genérico de Google Maps
- não apareceu integrado às telas operacionais principais
- adiciona superfície técnica e dependência ambiental (`VITE_FRONTEND_FORGE_API_KEY`)

Ação sugerida:
- revisar uso real
- se não houver tela operacional consumindo, mover para laboratório ou remover

#### 4. `client/src/components/ManusDialog.tsx`

Motivo:
- diálogo visual específico
- não apareceu integrado às rotas principais inspecionadas

Ação sugerida:
- revisar uso real antes de remover

#### 5. `client/src/components/DashboardLayout.tsx`

Motivo:
- existe como shell genérico
- a navegação operacional real hoje parece girar mais em torno de `Navbar` + `SystemSidebar`

Risco:
- pode ainda ser dependência indireta ou base de evolução futura

Ação sugerida:
- revisar com rastreamento de uso antes de qualquer remoção
- não assumir que está morto apenas porque o app gira em torno de `Navbar` + `SystemSidebar`

#### 6. `client/public/__manus__/debug-collector.js`

Motivo:
- artefato de debug/tooling
- valor operacional atual não está claro

Ação sugerida:
- revisar

#### 7. scripts de coleta e auditoria não claramente oficiais

Candidatos:
- `coleta-evidencias.ps1`
- `validar-alertas.ps1`

Motivo:
- parecem úteis, mas precisam ser classificados entre:
  - oficiais
  - históricos
  - descartáveis

Ação sugerida:
- reorganizar em `scripts/official` vs `scripts/historical` ou documentar melhor

---

### 🔍 Precisa rastreamento

#### 1. `auth_info_*`

Motivo:
- parecem conter sessão, QR, cookies, tokens ou estado operacional
- não devem ser tratados automaticamente como lixo

Ação sugerida:
- não migrar sem entender consumo real
- criar área dedicada como:
  - `runtime/`
  - `storage/`
  - `sessions/`
- garantir exclusão via `.gitignore`

#### 2. Dependências do projeto

Motivo:
- inspeção manual só produz suspeita
- remoção de pacote exige prova objetiva

Ação sugerida:
- executar auditoria automática com:
  - `depcheck`
  - `ts-prune`
  - `knip`

Objetivo:
- packages mortos
- imports mortos
- exports mortos
- símbolos não utilizados

#### 3. Componentes e páginas amarelas

Motivo:
- `Map`, `AIChatBox`, `DashboardLayout`, `ManusDialog`, `ComponentShowcase` não devem ser removidos por aparência

Ação sugerida:
- rastrear imports/uso real antes de decidir

---

### 🔴 Manter

#### 1. `docs/adr/`

Motivo:
- conjunto denso de decisões arquiteturais
- alta rastreabilidade

#### 2. `docs/architecture/`

Motivo:
- referência estrutural principal

#### 3. `docs/core/`

Motivo:
- congela contratos do produto

#### 4. `docs/operations/`

Motivo:
- governança e operação continuam úteis em modo de operação contínua

#### 5. `E2_CERTIFICATION_REPORT.md`

Motivo:
- documento oficial da certificação

#### 6. `BASELINE_FREEZE_v1.0.0-operational.md`

Motivo:
- baseline oficial

#### 7. `FINAL_CHECKLIST.md`

Motivo:
- síntese executiva rápida

#### 8. `ROADMAP.md`

Motivo:
- direção pós-E2 sem abrir desenvolvimento ainda

#### 9. `PROJECT_STATUS.md`

Motivo:
- leitura de estado em menos de 1 minuto

#### 10. `release/v1.0.0-operational/`

Motivo:
- snapshot oficial da versão

---

## Organização documental

### Situação atual

Existe uma base boa em `docs/`, com subáreas como:

- `adr/`
- `architecture/`
- `core/`
- `operations/`
- `implementation/`
- `application/`
- `governance/`

Mas ainda coexistem muitos documentos importantes na raiz:

- baseline
- certificação
- release
- diffs intermediários
- arquitetura consolidada
- notas históricas

### Ação recomendada

Não mover tudo de forma destrutiva agora.
Primeiro, usar índices por domínio, como começou a ser feito nesta rodada:

- `docs/README.md`
- `docs/certification/README.md`
- `docs/release/README.md`
- `docs/roadmap/README.md`

Depois, numa limpeza controlada:
- mover históricos para `docs/history/`
- deixar a raiz só com documentos oficiais de entrada

---

## Scripts

### Scripts oficiais claros

- `build.mjs`
- `dev.mjs`
- `start.mjs`
- `test.mjs`
- `validate-architecture-boundaries.ts`
- `validate-architecture-fitness.ts`
- `validate-behavior-sandbox.ts`
- `validate-operational-calculation.ts`
- `validate-reproducibility.ps1`
- `validate-fluxos.ps1`
- `validate-observability.ps1`
- `validate-chaos.ps1`
- `validate-disposable.ps1`
- `certificacao-final.ps1`
- `start-certification-stack.ps1`

### Scripts históricos / alternativos / revisar

- `validate-fluxos.sh`
- `coleta-evidencias.sh`
- `coleta-evidencias.ps1`
- `validar-alertas.ps1`
- `rollback-production.sh`
- `smoke-production.sh`
- `backup-mysql.sh`
- `restore-mysql.sh`
- `tag-operational.ps1`

Leitura:
- alguns permanecem úteis
- mas já merecem classificação formal entre `oficial`, `histórico` e `operacional-avulso`

---

## Diretórios de runtime misturados ao repositório

Achado importante:

Foram encontrados vários diretórios `auth_info_*` na raiz do projeto.

Isso é forte sinal de mistura entre:

- código-fonte
- estado operacional
- credenciais/sessões locais

Risco:
- poluição do repositório
- dificuldade de backup limpo
- chance de exposição acidental de estado

Ação recomendada:
- não mover automaticamente nesta etapa
- primeiro entender consumo real
- depois definir área dedicada como `runtime/`, `storage/` ou `sessions/`
- garantir exclusão adequada via `.gitignore`

Classificação:
- 🔍 precisa rastreamento

---

## Dependências inúteis

Nesta rodada eu não removi dependências.
E a metodologia correta daqui para frente deve ser automática, não apenas descritiva.

Suspeitas objetivas para revisão:

- `@types/google.maps`
  - depende do uso real de `Map.tsx`
- `streamdown`
  - aparece em `Home.tsx`, que hoje é candidato a remoção
- blocos ligados a demo/showcase

Classificação:
- 🔍 precisa rastreamento

Recomendação:
- rodar auditoria posterior com:
  - `depcheck`
  - `ts-prune`
  - `knip`
- só depois decidir exclusões em `package.json`

---

## Tabela consolidada

| Item | Situação | Ação | Classe |
|---|---|---|---|
| `client/src/pages/Home.tsx` | página exemplo, não roteada | remover | 🟢 Confirmado |
| `validate-fluxos.sh` | substituído por PowerShell | arquivar/remover | 🟢 Confirmado |
| `coleta-evidencias.sh` | baixo valor no host atual | arquivar/remover | 🟢 Confirmado |
| diffs intermediários E2 | documentação histórica dispersa | arquivar | 🟢 Confirmado |
| `aceite-operacional-d2.txt` | histórico pontual | arquivar | 🟢 Confirmado |
| `client/src/pages/ComponentShowcase.tsx` | showroom possivelmente interno | revisar | 🟡 Suspeito |
| `client/src/components/AIChatBox.tsx` | dependente do showcase | revisar | 🟡 Suspeito |
| `client/src/components/Map.tsx` | sem uso operacional evidente | revisar | 🟡 Suspeito |
| `client/src/components/ManusDialog.tsx` | sem uso operacional evidente | revisar | 🟡 Suspeito |
| `client/src/components/DashboardLayout.tsx` | shell genérico | revisar com muito cuidado | 🟡 Suspeito |
| `coleta-evidencias.ps1` | utilitário, uso pouco claro | revisar | 🟡 Suspeito |
| `validar-alertas.ps1` | utilitário, uso pouco claro | revisar | 🟡 Suspeito |
| `auth_info_*` | estado operacional misturado ao repo | rastrear consumo antes de mover | 🔍 Precisa rastreamento |
| dependências suspeitas | sem prova automática ainda | auditar com ferramenta | 🔍 Precisa rastreamento |
| docs principais | estrutura viva e útil | manter | 🔴 Manter |

---

## Conclusão

O projeto está operacional e maduro.
O que falta agora não é evolução funcional.

O próximo passo correto é:

1. arquivar tudo que é verde
2. reorganizar documentação
3. reorganizar scripts por categoria
4. executar auditoria automática de código e dependências
5. só então decidir sobre os itens amarelos e de rastreamento

## Veredito

- ✅ Sprint E2 encerrada
- ✅ Baseline congelada
- 🟡 Auditoria completa executada
- 🟡 Limpeza do projeto ainda pendente
- ✅ Projeto pronto para operação contínua
- ✅ Próxima evolução correta: auditoria + limpeza antes do Disparador
