# Operation Checklist

Protocolo de aceite da Sprint Operacional 0. Nenhuma sprint seguinte deve começar sem este checklist fechado com evidência real.

## Fases do chip

- `NOVO`: pode conectar, sincronizar contatos, montar identidade, ver status, abrir conversas, entrar em grupos e permanecer ocioso. Não pode enviar mensagens.
- `EM_MATURACAO`: continua em observação passiva. Ainda não pode executar campanhas nem conversas controladas.
- `EM_OBSERVACAO`: pode iniciar interações controladas do Behavior Engine.
- `APROVADO`: pode ser usado pelo Marketing.

## Critério 1: nenhum envio prematuro

- [ ] Nenhum `sendMessage` enquanto o chip estiver em `NOVO`
- [ ] Nenhum `sendMessage` enquanto o chip estiver em `EM_MATURACAO`
- [ ] Nenhuma campanha liberada antes de `APROVADO`
- [ ] Toda tentativa bloqueada registrada com `BLOCKED_MATURITY`

## Critério 2: Timeline passiva consistente

Durante 48h, a Timeline deve registrar de forma cronológica:

- [ ] `session_connected`
- [ ] `contacts_synced`
- [ ] `wake_up`
- [ ] `idle`
- [ ] `status_viewed`
- [ ] `chat_list_opened`
- [ ] `group_opened`
- [ ] `participants_loaded`
- [ ] `messages_read`
- [ ] `sleep`
- [ ] Sem lacunas operacionais ou resets de histórico

## Critério 3: evolução por evidência

- [ ] O chip evolui apenas de `NOVO` para `EM_MATURACAO`
- [ ] O chip só entra em `EM_OBSERVACAO` com evidência mínima real
- [ ] Nunca ocorre salto direto de `NOVO` para `APROVADO`
- [ ] A justificativa da fase fica visível no Mission Control

## Critério 4: variabilidade comportamental

- [ ] Horários de `wake_up` variam por chip
- [ ] Duração de `idle` varia por chip
- [ ] A agenda passiva usa janelas, não sequência fixa
- [ ] O Mission Control expõe a próxima ação agendada
- [ ] Qualquer padrão rígido repetido em dias consecutivos vira incidente operacional

## Critério 5: sobrevivência à desconexão

- [ ] Desconexão forçada não devolve o chip para `NOVO`
- [ ] Reconexão preserva Timeline e fase de maturação
- [ ] O histórico não é zerado após reconnect
- [ ] O chip continua em `EM_MATURACAO` ou `EM_OBSERVACAO`, conforme a evidência já coletada

## Critério 6: missão do Behavior Engine

- [ ] O Behavior Engine agenda intenções
- [ ] O Scheduler executa a intenção em horário variável posterior
- [ ] A última ação e a próxima ação ficam visíveis no Mission Control
- [ ] Cancelamentos e adiamentos futuros podem ser encaixados sem mudar a arquitetura central

## Janela operacional

- [ ] 2 chips reais conectados
- [ ] 48h contínuas de observação
- [ ] Sem bloqueio de chip durante o período
- [ ] Health Score atualizado continuamente

## Regra central

- Chip novo não entra em campanha.
- Chip novo não troca mensagens imediatamente após conectar.
- O Behavior Engine consulta a fase do chip antes de qualquer envio.
- Qualquer desvio durante a Sprint 0 é registrado como incidente operacional, sem refatoração arquitetural durante a janela de observação.
