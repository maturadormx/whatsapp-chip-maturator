# E2 — certificação local reprodutível

## Objetivo

Esta fase certifica que o sistema está operacional e reproduzível localmente via Docker.
Ela não certifica produção remota, GitHub Actions ou publicação real de imagem.

## Topologia validada nesta fase

- `app`, `worker` e `scheduler` compartilham o mesmo processo Node nesta stack local.
- O endpoint `POST /api/inbound/events` segue um fluxo direto para a pipeline.
- O fluxo `queue -> worker -> pipeline` é exercitado pelo scheduler interno e pelas métricas operacionais.
- Portanto, os gates distinguem explicitamente:
  - fluxo inbound direto
  - fluxo assíncrono via scheduler/queue/worker

## Escopo

- `E2.1` Reprodutibilidade
- `E2.2` Matriz de fluxos
- `E2.3` Idempotência observável e operação estável
- `E2.4` Chaos controlado
- `E2.5` Ambiente descartável
- `E2.6` Smoke final de promoção local

## Princípio de migração nesta fase

As migrações não devem rodar automaticamente no startup do container durante a certificação local.
Se necessário, a execução deve ser explícita:

`powershell -File .\scripts\certification\migrate-local.ps1`

## Execução

### E2.1
`powershell -File .\scripts\certification\validate-reproducibility.ps1`

### E2.2
`powershell -File .\scripts\certification\validate-fluxos.ps1`

### E2.4
`powershell -File .\scripts\certification\validate-chaos.ps1`

### E2.5
`powershell -File .\scripts\certification\validate-disposable.ps1`

## Critério de saída

- stack sobe com `down -v` seguido de `up -d --build`
- `/health`, `/ready`, `/live` respondem
- evento inbound válido responde e persiste sem erro
- scheduler/queue/worker incrementam métricas assíncronas
- app, Redis e MySQL se recuperam após restart
- alertas continuam observáveis
- ambiente pode ser descartado e reconstruído

## Fora de escopo

- deploy remoto em staging/produção
- validação real de GitHub Actions
- publicação real em registry
- secrets reais de produção
