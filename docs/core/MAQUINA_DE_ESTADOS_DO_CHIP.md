# Máquina de Estados do Chip

## Governança

Status: `CONGELADO`

Categoria:

`Core do Produto`

Dependências:

nenhuma

Documentos que dependem deste:

- `Sprint 0`
- `Auditoria`
- `API dos Chips`
- `Persistência`
- `Interface`

Regra de governança:

nenhuma mudança neste documento por necessidade de implementação.

Ele só muda quando houver decisão explícita de produto.

## Objetivo

Este documento congela a máquina de estados do `Chip` como entidade do domínio.

Ele existe para impedir leituras ambíguas sobre nascimento, perda de sessão, incidente, recuperação e continuidade da vida operacional.

## Regra principal

O chip tem uma única linha de vida.

Recuperação não cria um novo chip. Recuperação apenas devolve o mesmo chip ao ponto coerente da sua vida anterior.

## Invariantes do domínio

Estas são as leis físicas do domínio do chip.

- um chip possui exatamente uma identidade durante toda a sua vida
- todo evento pertence exatamente a um chip
- todo estado deriva exclusivamente da sequência válida de eventos
- nenhuma transição pode violar essas invariantes

## Separação entre estado e evento

Estado e evento não são a mesma coisa.

Estado responde:

`em que condição de vida o chip está agora`

Evento responde:

`que fato aconteceu com o chip`

Exemplo correto:

- estado atual: `EM_MATURACAO`
- evento recebido: `CONEXAO_PERDIDA`
- novo estado calculado: `INCIDENTE`

Exemplo incorreto:

- tratar `perdeu sessão` como se fosse estado
- tratar `recuperação concluída` como se fosse estado permanente

## Fonte da verdade

A fonte da verdade do chip nunca é o campo `estado_atual`.

A fonte da verdade é a sequência cronológica de eventos da sua vida.

Leitura oficial:

`historico -> motor de estados -> estado_atual`

Regra:

`estado_atual` é apenas uma projeção para leitura rápida.

Se houver divergência entre `historico` e `estado_atual`, o histórico vence.

Frase congelada do domínio:

eventos representam fatos. Estados representam interpretação desses fatos.

## Cegueira da máquina

A máquina de estados não conhece:

- WhatsApp
- API
- token
- QR Code
- HTTP
- banco
- worker

Ela conhece apenas:

`estado -> evento -> novo estado`

Nada além disso.

## Quem decide o estado

A Máquina de Estados não altera estados diretamente.

Ela:

1. recebe o estado atual e o evento
2. calcula o novo estado coerente
3. devolve o resultado

O executor apenas aplica esse resultado.

## Linha principal

```text
CRIADO
  ↓
PAREADO
  ↓
NOVO
  ↓
EM_MATURACAO
  ↓
MADURO
```

## Linha de incidente

```text
qualquer estado operacional
  ↓
INCIDENTE
  ↓
DIAGNOSTICO
  ↓
RECUPERACAO
  ↓
├── retorna ao estado anterior
└── ISOLADO
```

## Estados permanentes

### CRIADO

O chip passou a existir como entidade identificável no sistema.

### PAREADO

O pareamento foi concluído e a identidade operacional do chip foi confirmada.

### NOVO

O chip entrou em sua vida inicial, mas ainda não conquistou evidência suficiente para sair da fase de nascimento.

### EM_MATURACAO

O chip está dentro de uma janela controlada de maturação, sob regras restritivas de comportamento.

### MADURO

O chip concluiu a fase de maturação e atingiu o nível mínimo exigido para fases posteriores.

### INCIDENTE

O chip sofreu um desvio operacional que exige registro formal e bloqueia a continuidade cega da execução.

### DIAGNOSTICO

O sistema está classificando a natureza do incidente antes de tentar qualquer recuperação.

### ISOLADO

O chip continua existindo, mas não participa da Sprint nem da operação ativa.

Ele aguarda operador e não deve ser confundido com encerramento definitivo.

### ENCERRADO

A vida operacional do chip foi finalizada de forma definitiva.

`ENCERRADO` é um estado terminal.

Regra:

nenhum evento pode retirar um chip de `ENCERRADO`.

## Estado transitório

### RECUPERACAO

`RECUPERACAO` não é um estado final de vida.

Ele é apenas uma transição operacional entre o diagnóstico e o retorno ao estado anterior compatível.

Regra:

depois da recuperação, o chip não permanece em `RECUPERACAO`.

Ele volta para:

- `NOVO`, se estava em nascimento
- `EM_MATURACAO`, se estava em maturação
- `MADURO`, se já havia concluído a fase anterior

Se a recuperação falhar, o chip não vai para `CRIADO`, não renasce e não é encerrado automaticamente.

Ele segue para `ISOLADO`.

Se a recuperação for concluída com sucesso, o destino correto nunca é presumido como `ATIVO`.

O destino correto é sempre:

`restaurar_estado_anterior`

Exemplo:

- se o chip estava em `EM_MATURACAO`, ele volta para `EM_MATURACAO`
- se o chip estava em `MADURO`, ele volta para `MADURO`
- se o chip estava em `NOVO`, ele volta para `NOVO`

## Transições válidas

### Fluxo principal

- `CRIADO -> PAREADO`
- `PAREADO -> NOVO`
- `NOVO -> EM_MATURACAO`
- `EM_MATURACAO -> MADURO`

### Fluxo de incidente

- `CRIADO -> INCIDENTE`
- `PAREADO -> INCIDENTE`
- `NOVO -> INCIDENTE`
- `EM_MATURACAO -> INCIDENTE`
- `MADURO -> INCIDENTE`

### Fluxo de recuperação

- `INCIDENTE -> DIAGNOSTICO`
- `DIAGNOSTICO -> RECUPERACAO`
- `RECUPERACAO -> estado_anterior`
- `RECUPERACAO -> ISOLADO`

### Fluxo de isolamento

- `ISOLADO -> RECUPERACAO`, quando houver intervenção compatível
- `ISOLADO -> ENCERRADO`, quando houver decisão formal de fim de vida

### Encerramento

- `qualquer estado -> ENCERRADO`, quando houver decisão formal de retirada definitiva do chip

Regra:

`ENCERRADO` não possui transições de saída.

## Transições inválidas

As seguintes leituras são proibidas:

- `INCIDENTE -> CRIADO`
- `RECUPERACAO -> CRIADO`
- `ISOLADO -> CRIADO`
- `DESCONECTOU -> renasceu`
- `PERDEU_SESSAO -> novo chip`
- `NOVO -> MADURO`, sem janela real de maturação

## Eventos mínimos por transição

Toda transição relevante deve gerar evento de auditoria.

Eventos mínimos:

- `chip_created`
- `chip_paired`
- `chip_state_changed`
- `incident_opened`
- `incident_classified`
- `diagnosis_started`
- `recovery_started`
- `recovery_finished`
- `recovery_failed`
- `chip_isolated`
- `chip_state_restored`
- `chip_closed`

## Classes congeladas de incidente

As classes oficiais de incidente são:

- `AUTENTICACAO`
- `SESSAO`
- `REDE`
- `ARMAZENAMENTO`
- `PROCESSO`
- `CONFIGURACAO`
- `DESCONHECIDO`

## Origens oficiais de incidente

As origens oficiais de incidente são:

- `WHATSAPP`
- `SISTEMA`
- `BANCO`
- `OPERADOR`
- `INFRAESTRUTURA`
- `INTERNA`

## Recuperação com memória de estado

O sistema deve sempre registrar:

- estado anterior ao incidente
- origem do incidente
- classe do incidente
- diagnóstico produzido
- ação de recuperação executada
- estado restaurado

Regra:

todo incidente obrigatoriamente registra `estado_anterior`.

Sem `estado_anterior`, a recuperação não restaura. Ela adivinha. E adivinhar é proibido no domínio.

Se não for possível restaurar o estado anterior, isso deve ser marcado explicitamente em auditoria como quebra de continuidade.

Nesse caso, o destino coerente é `ISOLADO`.

## Motor determinístico

O futuro motor de estados nunca altera histórico.

Ele apenas:

1. recebe o histórico
2. interpreta os eventos válidos
3. calcula o estado derivado
4. retorna o estado atual

Ele nunca:

- apaga evento
- reescreve evento
- corrige evento no lugar
- inventa fato ausente

Princípio de determinismo:

dado exatamente o mesmo histórico de eventos, a máquina deve produzir exatamente o mesmo estado.

Esse princípio protege:

- auditoria
- replay
- testes
- sincronização entre workers

## Relação com a Sprint 0

A Sprint 0 só começa oficialmente quando o fluxo abaixo estiver claro:

```text
Chip existente
  ↓
perde sessão
  ↓
incidente é aberto
  ↓
incidente é classificado
  ↓
diagnóstico é registrado
  ↓
recuperação é executada
  ↓
ou retorna ao estado anterior
ou vai para ISOLADO
```

## Critério de qualidade

A máquina de estados estará correta quando ninguém no projeto puder interpretar um `401`, um `timeout` ou uma perda de sessão como nascimento de um novo chip.
