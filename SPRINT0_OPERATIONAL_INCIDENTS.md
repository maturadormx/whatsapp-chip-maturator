# Sprint 0 Operational Incidents

Registro objetivo dos desvios observados durante a execução da Sprint Operacional 0.

## 2026-07-16 00:40

### Incidente 1: instância duplicada disputando sessão

- Sintoma: `Chip 4` entrou em ciclo de `connected -> disconnect -> reconnect`.
- Evidência: `disconnectReason = "Stream Errored (conflict)"` e `disconnectStatusLabel = "connectionReplaced"`.
- Causa operacional: havia duas instâncias do `whatsapp-chip-maturator` ativas ao mesmo tempo, uma ouvindo em `3000` e outra em `3002`.
- Ação tomada: a pilha antiga em `3000` foi encerrada para manter uma única instância ativa.
- Impacto: a Timeline do `Chip 4` acumulou pares repetidos de `session_connected` e `contacts_synced` no arranque.
- Status: mitigado operacionalmente.

### Incidente 2: chip 8 preso em reconnect com `403 forbidden`

- Sintoma: `Chip 8` não estabiliza conexão e entra em loop de reconexão.
- Evidência: repetição de `Connection Failure` com `disconnectStatusCode = 403` e `disconnectStatusLabel = "forbidden"`.
- Impacto:
  - `Chip 8` permanece `desconectado`
  - `healthScore = 0`
  - `REPROVADO` no snapshot persistido
  - não há evolução passiva suficiente para a Sprint 0
- Status: aberto.

### Incidente 3: janela de 48h ainda não pode começar

- Motivo: os critérios mínimos da Sprint 0 ainda não foram atendidos.
- Estado atual:
  - `Chip 4`: conectado, mas com ruído recente de conflito de sessão
  - `Chip 8`: desconectado e em loop de `403 forbidden`
- Decisão operacional: a janela oficial de 48h não foi iniciada.
- Próximo gate:
  - 2 chips conectados de forma estável
  - Timeline passiva fluindo sem resets
  - ausência total de `sendMessage` em `NOVO` e `EM_MATURACAO`

## Observações

- Até este ponto, não foi feita refatoração arquitetural durante a observação.
- Os desvios foram apenas registrados e a intervenção ficou restrita à remoção da instância duplicada que estava causando conflito operacional.
