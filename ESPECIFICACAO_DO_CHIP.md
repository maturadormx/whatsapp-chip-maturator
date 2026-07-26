# Especificação do Chip

## Objetivo

Este documento congela a entidade `Chip` como unidade permanente do `whatsapp-chip-maturator`.

Ele existe para impedir que perda de sessão, reconexão ou incidente operacional sejam tratados como nascimento de um novo chip.

## Regra central

O nascimento acontece uma única vez.

Depois disso, o chip apenas muda de estado ao longo da mesma vida operacional.

## Identidade permanente

Cada `Chip` deve ser tratado como uma entidade estável, com identidade preservada ao longo do tempo.

Campos mínimos de identidade:

- `chipId`
- `uuid`
- `nascimento`
- telefone associado, quando existir
- credenciais e material de sessão vinculados ao mesmo chip
- timeline histórica
- histórico de incidentes
- fase operacional atual

Campos imutáveis:

- `chipId`
- `uuid`
- `nascimento`

## Estados possíveis

- `CRIADO`
- `NOVO`
- `PAREADO`
- `EM_MATURACAO`
- `MADURO`
- `INCIDENTE`
- `DIAGNOSTICO`
- `RECUPERACAO`
- `ISOLADO`
- `ENCERRADO`

## Semântica dos estados

### NOVO

O chip nasceu, mas ainda não concluiu o primeiro pareamento operacional válido.

### PAREADO

O chip concluiu pareamento e já possui identidade operacional reconhecida.

### EM_MATURACAO

O chip está dentro da Sprint 0 ou de outra janela controlada de observação comportamental.

### MADURO

O chip concluiu a fase de maturação e pode seguir para fases posteriores do ciclo operacional.

### INCIDENTE

O chip sofreu um desvio operacional relevante que exige classificação, diagnóstico e eventual recuperação.

### DIAGNOSTICO

O incidente está sendo investigado e classificado antes de qualquer ação corretiva.

### RECUPERACAO

O sistema está tentando devolver o mesmo chip ao ponto coerente da sua vida anterior.

### ISOLADO

O chip continua existindo, mas saiu da operação ativa e aguarda operador.

### ENCERRADO

O chip saiu definitivamente de operação e sua vida operacional foi finalizada.

## Nascimento

Nascimento é evento único.

Ele marca o início da identidade permanente do chip.

Consequências:

- o chip recebe seu `chipId`
- sua timeline passa a existir
- sua trilha de auditoria começa
- sua vida operacional nunca mais deve ser reiniciada do zero por perda de sessão

## Pareamento

Pareamento não cria a identidade.

Pareamento confirma que a identidade do chip entrou em condição operacional utilizável.

## Reconexão

Reconexão nunca cria outro chip.

Ela apenas restabelece a continuidade de um chip já existente.

Exemplo correto:

`Chip 8 -> nasceu -> pareou -> entrou em maturação -> perdeu sessão -> reconectou -> continuou a mesma vida`

Exemplo incorreto:

`Chip 8 caiu -> criou outro chip -> renasceu`

## Perda de sessão

Perda de sessão é incidente operacional.

Ela não apaga:

- identidade
- timeline
- fase anterior
- auditoria

## Timeline

A timeline nunca é apagada.

Ela é o histórico contínuo da vida do chip.

Ela é append-only.

## Fonte da verdade

O estado atual do chip nunca é a fonte da verdade.

A fonte da verdade é a sequência cronológica dos eventos da sua timeline.

Leitura oficial:

`historico -> motor de estados -> estado_atual`

Consequência:

se houver divergência entre `historico` e `estado_atual`, o histórico vence.

Toda transição relevante deve produzir evento.

Exemplos:

- `chip_born`
- `chip_paired`
- `session_connected`
- `session_disconnected`
- `incident_opened`
- `incident_classified`
- `diagnosis_started`
- `recovery_started`
- `recovery_finished`
- `recovery_failed`
- `chip_isolated`
- `maturation_started`
- `maturation_finished`

## Auditoria

Toda mudança de estado gera evento auditável.

Mudanças mínimas que obrigatoriamente entram em auditoria:

- nascimento
- pareamento
- entrada em maturação
- perda de sessão
- abertura de incidente
- classificação do incidente
- início de recuperação
- reconexão
- encerramento de sprint
- encerramento definitivo do chip

## Camada operacional obrigatória

O fluxo correto do chip diante de falhas não é:

`401 -> reconectar`

O fluxo correto é:

`Chip -> Incidente -> Diagnóstico -> Recuperação`

## Classificação antes da ação

Antes de qualquer tentativa de recuperação, o incidente precisa ser classificado.

Isso é obrigatório porque um mesmo `401` pode representar causas diferentes.

## Incidentes mínimos

Incidentes que precisam existir como categorias explícitas:

- `QR_EXPIRED`
- `SESSION_REMOVED`
- `TOKEN_INVALID`
- `DEVICE_UNLINKED`
- `SESSION_CORRUPTED`
- `LOCAL_STATE_CLEANED`
- `CONNECTION_TIMEOUT`
- `CONNECTION_REPLACED`
- `FORBIDDEN`
- `UNKNOWN_AUTH_FAILURE`

## Classes congeladas de incidente

As classes oficiais do domínio são:

- `AUTENTICACAO`
- `SESSAO`
- `REDE`
- `ARMAZENAMENTO`
- `PROCESSO`
- `CONFIGURACAO`
- `DESCONHECIDO`

## Origens oficiais de incidente

Toda abertura de incidente deve registrar também sua origem:

- `WHATSAPP`
- `SISTEMA`
- `BANCO`
- `OPERADOR`
- `INFRAESTRUTURA`
- `INTERNA`

## Fluxo de recuperação

A recuperação sempre segue esta ordem:

1. detectar o incidente
2. registrar o incidente
3. classificar o incidente
4. diagnosticar a causa provável
5. executar recuperação compatível com a classe do incidente
6. registrar o resultado
7. devolver o chip ao estado coerente com sua vida anterior ou isolá-lo

## Regra de continuidade

Se o chip estava em `EM_MATURACAO` antes da falha, a recuperação deve tentar devolvê-lo à mesma vida operacional, e não criar uma nova.

Se isso não for possível, o sistema deve registrar a quebra de continuidade explicitamente em auditoria.

Nesse caso, o chip deve ir para `ISOLADO`.

## Relação com a Sprint 0

A Sprint 0 não valida apenas conectividade.

Ela valida:

- nascimento correto do chip
- preservação de identidade
- rastreabilidade da timeline
- capacidade de classificar incidentes
- capacidade de recuperar sem renascer o chip
- manutenção da mesma vida operacional durante 48h

## Gate antes da Sprint 0

Antes de reiniciar oficialmente a Sprint 0, o projeto deve ter congelado:

- a entidade `Chip`
- o ciclo de vida do `Chip`
- a classificação de incidentes
- o fluxo `Incidente -> Diagnóstico -> Recuperação`

## Ordem operacional

Sequência oficial para retomada:

1. verificar por que ocorreu o `401`
2. classificar o incidente de cada chip
3. reconectar `Chip 4` e `Chip 8`
4. confirmar que mantiveram a mesma identidade
5. reiniciar oficialmente a Sprint 0
6. contar `48 horas reais`
7. auditar o resultado
8. encerrar a Sprint

## Regra de congelamento

Enquanto a Sprint 0 não for concluída com sucesso, nenhuma feature nova deve entrar no sistema.

O foco da fase é validar comportamento, continuidade e recuperação operacional.
