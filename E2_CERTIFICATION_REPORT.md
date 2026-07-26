# E2 CERTIFICATION REPORT
## whatsapp-chip-maturator
**Data:** 2026-07-22
**Versão:** `v1.0.0-operational`

---

### Resumo executivo
Sistema certificado localmente com 5 gates.
O Gate E foi validado com fallback operacional para imagem local já construída.

### Topologia validada

- `app`, `worker` e `scheduler` compartilham o mesmo processo/container
- `POST /api/inbound/events` segue fluxo direto para a pipeline
- o caminho `scheduler -> queue -> worker -> pipeline` é acompanhado por métricas e dashboards

### Gates

| Gate | Status | Evidência | Nota |
|---|---|---|---|
| A — Ambiente | PASS | `evidencias/E2.1/` | Reprodutibilidade comprovada |
| B — Fluxos | PASS | `evidencias/E2.2/fluxos.log` | Pipeline 0→1, payload inválido e recovery OK |
| C — Observabilidade | PASS | `evidencias/E2.3/observabilidade.md` | Sem dependência de `docker logs` para leitura rotineira |
| D — Resiliência | PASS | `evidencias/E2.4/chaos.log` | Chaos controlado com recuperação automática |
| E — Descartável | PASS (Fallback Operacional) | `evidencias/E2.5/disposable.log`, `evidencias/E2.6/rodada-*.log` | 2 rebuilds completos e 1 fallback corretamente ativado |

### Decisão de engenharia

**Fallback operacional**

O launcher `scripts/certification/start-certification-stack.ps1` detecta falhas externas de registry, como `TLS handshake timeout`, e reaproveita a imagem local já validada com `docker compose up -d --no-build`.

Esse comportamento é:

- intencional
- testado
- documentado
- adequado para certificação local tolerante a falhas externas

### Known issues

- `INFRA-02 — Windows Runtime / esbuild cleanup lock`
  - Status: Known Issue
  - Impacto: não bloqueante
  - Workaround oficial: Docker/WSL

### Conclusão

**SPRINT E2 CERTIFICADA**

Escopo da certificação:

- ambiente local
- operação contínua local
- tolerância a falhas externas de registry com fallback operacional

### Próxima fase recomendada

1. Operação contínua por 30 dias
2. Coleta de evidências de uso real
3. Só depois decidir E3 de integração GitHub/publicação
