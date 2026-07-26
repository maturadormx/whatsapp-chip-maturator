# Pacote de auditoria Sprint 0

Este pacote reúne os arquivos necessários para coletar evidências e auditar objetivamente os 10 critérios da Sprint 0.

## Arquivos

- `auditoria.py`
- `scripts/certification/coleta-evidencias.ps1`
- `docs/history/coleta-evidencias.sh`
- `templates/submissao.txt`

## Critérios auditados

1. Redis responde `PONG`
2. Aplicação sobe sem erro fatal
3. Scheduler publica jobs
4. Worker consome jobs
5. Pipeline conclui processamento
6. Endpoint de métricas responde antes e depois
7. As 20 métricas customizadas aparecem
8. Métricas de queue aumentam entre BEFORE e AFTER
9. `npm test` verde
10. `npm run build` verde

## Como coletar evidências

PowerShell:

```powershell
pwsh ./scripts/certification/coleta-evidencias.ps1
```

Bash:

```bash
bash ./docs/history/coleta-evidencias.sh
```

Por padrão, os scripts geram:

- `sprint0-evidencias.log`
- leitura opcional de `sprint0-app.log`

Se você estiver rodando a aplicação em outro host/porta, ajuste:

- `AppUrl` no PowerShell
- `APP_URL` no Bash

## Como auditar

```bash
python auditoria.py --log sprint0-evidencias.log --app-logs sprint0-app.log
```

## Veredito

- `🟢 GO`: 10/10 critérios aprovados
- `🔴 NO-GO`: existe pelo menos um `❌`
- `🟡 WARN`: sem `❌`, mas com algum `⚠️`

## Observação

O auditor foi desenhado para trabalhar com logs textuais. Ele não substitui uma investigação operacional mais profunda, mas serve como gate objetivo de aceite para a Sprint 0.
