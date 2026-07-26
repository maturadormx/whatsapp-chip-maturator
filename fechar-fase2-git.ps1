$ErrorActionPreference = "Stop"

Write-Host "==> Rodando validacao final da Fase 2"
pnpm test
pnpm build

Write-Host "==> Verificando estado do Git"
git status

Write-Host "==> Adicionando alteracoes"
git add .

Write-Host "==> Criando commit da Fase 2"
git commit -m "feat(m2-fase2): MessageGateway abstraído, testado e documentado

- Commit 1: Contratos do gateway (MessageGateway, OutboundMessage, GatewayResult)
- Commit 2: Injeção no ExecutionService com adapter padrão
- Commit 3: FakeMessageGateway + testes unitários + integração
- Commit 4: ADR, rastreabilidade e documentação consolidada

105/105 testes passando. Build OK.
Nenhuma alteração em Retry, Budget, Ledger ou estados."

Write-Host "==> Criando tag local m2-fase-2"
git tag -a m2-fase-2 -m "Fase 2: MessageGateway abstraído, testado e documentado."

Write-Host "==> Conferencia final"
git log --oneline -n 5
git tag --list
