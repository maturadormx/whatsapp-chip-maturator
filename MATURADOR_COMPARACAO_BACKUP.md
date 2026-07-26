# MATURADOR_COMPARACAO_BACKUP

## Objetivo

Comparar:

- projeto atual: `whatsapp-chip-maturator`
- backup limpo: `whatsapp-chip-maturator-backup-limpo-20260724-095146`

## Resumo numérico

| Medida | Atual | Backup |
|---|---:|---:|
| Diretórios | 141 | 21 |
| Arquivos | 4111 | 88 |
| Arquivos idênticos | 87 | 87 |
| Arquivos diferentes no mesmo caminho | 0 | 0 |
| Arquivos só no atual | 4024 | - |
| Arquivos só no backup | - | 1 |
| Diretórios só no atual | 120 | - |
| Diretórios só no backup | - | 0 |

## Conclusão do comparativo

O backup limpo não é uma versão paralela divergente do código. Ele é um recorte muito menor da mesma base.

### Evidência central

- `87` arquivos são exatamente iguais
- `0` arquivos compartilhados mudaram de conteúdo
- o backup tem apenas `1` arquivo que não aparece no atual

## Arquivo que existe apenas no backup

- `docs/architecture/ARQUITETURA_CONTRATUAL_DO_MATURADOR.md`

## O que existe apenas no atual

Os itens do atual que não estão no backup se concentram em categorias operacionais e de expansão:

### Operação e sessão

- `auth_info_1` até `auth_info_12`
- `.manus-logs/`
- logs na raiz

### Build e distribuição

- `dist/`

### Dados e evidências

- `datasets/`
- `evidencias/`

### Infraestrutura

- `drizzle/`
- `monitoring/`
- `grafana/`

### Documentação expandida

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

### Código e scripts

- `server/` com toda a árvore modular
- `scripts/`
- `tests/`
- `patches/`
- `release/`
- `reports/`

## Pastas novas no atual

Principais diretórios presentes no atual e ausentes no backup:

- `.github/`
- `.manus-logs/`
- `datasets/`
- `dist/`
- `drizzle/`
- `evidencias/`
- `forensics/`
- `grafana/`
- `monitoring/`
- `patches/`
- `release/`
- `reports/`
- `runbooks/`
- `scripts/`
- `server/`

## Pastas antigas exclusivas do backup

- nenhuma

## Arquivos iguais

Exemplos relevantes de arquivos idênticos entre atual e backup:

- `.env.example`
- `.gitignore`
- `Dockerfile`
- `client/src/App.tsx`
- `client/src/components/AIChatBox.tsx`
- `client/src/pages/AdminDashboard.tsx`
- `client/src/pages/BulkDispatch.tsx`
- `client/src/pages/ControlCenter.tsx`
- `client/src/pages/Dashboard.tsx`
- `docs/adr/*`
- `docs/application/*`
- grande parte da base documental arquitetural

## Arquivos diferentes

- nenhum

## Arquivos maiores ou menores

- nenhum arquivo compartilhado apresentou diferença de tamanho

## Leitura forense

O backup limpo é um subconjunto estável do projeto. O projeto atual é esse subconjunto mais:

- infraestrutura
- runtime
- docs expandidos
- dados
- logs
- artefatos operacionais

Isso significa:

- o backup não corrige o código atual
- o backup ajuda a isolar uma cópia mais limpa
- o atual preserva a evolução operacional e arquitetural posterior

## Conclusão

Se o objetivo é recuperar o projeto, a comparação mostra:

1. o código-base do backup e do atual é compatível
2. o atual não destruiu o backup
3. a diferença principal está no acúmulo de artefatos e expansão operacional
4. o único item confirmado como exclusivo do backup é `docs/architecture/ARQUITETURA_CONTRATUAL_DO_MATURADOR.md`
