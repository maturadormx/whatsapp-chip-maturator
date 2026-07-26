# Sprint E3 — preparação de promoção local

> Arquivos preparados, porém ainda não validados em ambiente GitHub Actions com secrets reais.

## Baseline congelada

- Tag de referência: `v1.0.0-operational`
- A baseline operacional não deve receber novos commits.
- A evolução da E2 deve seguir em branch dedicada, por exemplo:
  - `release/e2-local-certification`

## Escopo da E2

- certificação local reprodutível
- smoke tests E2E locais
- compose de promoção local
- migrações opcionais no startup do container
- backup e restore locais de MySQL
- rollback documentado para stack local

## Fora de escopo

- deploy remoto validado
- execução real de GitHub Actions
- publicação real de imagem em registry
- reabertura do INFRA-02 do Windows
