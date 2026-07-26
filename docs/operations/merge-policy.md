# Política de merge

## Princípio

Integração é o gargalo. Merge deve reduzir risco, não acelerar regressões.

## Regras

- nenhuma mudança entra com suíte quebrada
- `pnpm test` e `pnpm build` devem estar verdes
- mudanças de contrato exigem ADR
- PRs devem ser pequenos o suficiente para localizar regressões
