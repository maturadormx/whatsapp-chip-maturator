# Baseline congelada — v1.0.0-operational

## Status

Baseline operacional congelada após certificação local da Sprint E2.

## Escopo congelado

- stack Docker operacional
- health checks
- métricas e dashboards
- alertas e runbooks
- gates de certificação local E2
- fallback operacional para rebuild local

## Artefatos principais

- `E2_CERTIFICATION_REPORT.md`
- `evidencias/E2.1/`
- `evidencias/E2.2/`
- `evidencias/E2.3/`
- `evidencias/E2.4/`
- `evidencias/E2.5/`
- `evidencias/E2.6/`
- `scripts/certification/start-certification-stack.ps1`
- `scripts/certification/validate-*.ps1`
- `scripts/certification/certificacao-final.ps1`

## Regra de evolução

Não abrir novas features nesta baseline.
Os próximos ciclos devem priorizar:

1. operação contínua
2. refinamento de runbooks
3. observação de estabilidade
4. só depois integração externa e publicação
