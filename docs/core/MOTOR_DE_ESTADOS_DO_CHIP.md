# Motor de Estados do Chip

## Governança

Status: `CONGELADO`

Versão: `1.0`

Data:

`2026-07-18`

Categoria:

`Core do Produto`

Dependências:

- `Contrato de Domínio do Chip`
- `Máquina de Estados do Chip`
- `Contrato dos Eventos do Chip`

Documentos que dependem deste:

- `Persistência`
- `API`
- `Workers`
- `Interface`
- `Auditoria`

Regra de governança:

este documento define o algoritmo determinístico que interpreta o histórico do chip.

Ele não define política de produto nem altera o domínio já congelado.

Nenhuma implementação deve alterar este documento.

Mudanças requerem decisão explícita de produto.

## Modelo conceitual

Este documento define o `Motor de Estados` como o interpretador determinístico do histórico do chip.

A relação entre os artefatos do domínio é:

`Fato (Evento) -> Histórico Append-Only -> Motor de Estados -> Máquina de Estados -> Estado Derivado`

Leitura funcional:

| Camada | Responsabilidade |
|---|---|
| `Evento` | fato imutável que ocorreu na vida do chip |
| `Histórico` | fonte persistente e append-only dos fatos |
| `Motor de Estados` | interpreta o histórico de forma determinística |
| `Máquina de Estados` | define transições válidas |
| `Estado Derivado` | projeção atual calculada a partir do histórico |

## Objetivo

Este documento define como o sistema interpreta um histórico de eventos e deriva o estado atual de um `Chip`.

Ele não define o domínio.

Ele define o executor lógico que aplica:

- o `Contrato de Domínio do Chip`
- a `Máquina de Estados do Chip`
- o `Contrato dos Eventos do Chip`

## Papel do motor

O motor responde apenas:

- como aplicar um evento a um estado atual
- como reconstruir o estado a partir do histórico
- como validar se um evento pode ser interpretado
- como detectar quebra de continuidade

O motor não responde:

- como persistir
- como transmitir eventos
- como renderizar interface
- como abrir ticket ou notificação

## Princípios

| Princípio | Descrição |
|---|---|
| `Determinismo` | dado o mesmo histórico, produz o mesmo estado |
| `Pureza` | o motor é puro do ponto de vista do domínio |
| `Transparência referencial` | para qualquer histórico `H`, o resultado depende exclusivamente de `H` |
| `Imutabilidade` | o motor não altera histórico |
| `Não criação` | o motor não inventa eventos ausentes |
| `Transparência` | o motor não corrige inconsistências silenciosamente |

## Limites do motor

O Motor de Estados não possui efeitos colaterais.

Ele não:

- grava banco
- publica mensagens
- envia notificações
- abre tickets
- chama APIs
- altera projeções

Seu único efeito é produzir uma interpretação determinística do histórico.

## Contrato de entrada

| Propriedade | Garantia |
|---|---|
| `Mesmo chip_id` | obrigatório para todos os eventos do histórico |
| `sequence única` | obrigatória por `chip_id` |
| `sequence crescente` | obrigatória |
| `Eventos estruturalmente válidos` | obrigatórios |
| `Histórico completo ou parcial` | permitido, desde que declarado |

Regra:

o motor exige que o histórico seja entregue em ordem lógica oficial (`sequence`).

O motor não reordena eventos.

Histórico parcial produz projeção parcial e não garante reconstrução completa do estado.

## Contrato de saída

O motor retorna um `MotorResult` com:

| Campo | Tipo | Descrição |
|---|---|---|
| `current_state` | string | estado derivado atual do chip |
| `previous_state` | string | último estado de vida preservado |
| `last_sequence` | integer | última `sequence` processada com sucesso |
| `inconsistencies` | array | inconsistências encontradas |
| `processed_events` | integer | total de eventos processados |
| `transitions_applied` | integer | total de transições aplicadas com sucesso |

## Contrato formal de entrada e saída

### Entrada formal

`History<Event>`

O histórico de entrada deve obedecer a:

- mesmo `chip_id`
- `sequence` crescente
- `sequence` única por chip
- eventos estruturalmente válidos

### Saída formal

`MotorResult = StateProjection + TransitionLog + ValidationReport`

Onde:

- `StateProjection`: estado derivado atual do chip
- `TransitionLog`: transições efetivamente aplicadas
- `ValidationReport`: inconsistências encontradas no processamento

Regra:

o motor deve poder ser lido como uma função matemática sobre o histórico.

## Fluxo conceitual

`Histórico -> validação estrutural -> validação de continuidade lógica -> inicialização do estado derivado -> aplicação evento a evento -> registro de transições -> registro de inconsistências -> estado final derivado`

## Algoritmo geral

1. receber o histórico ordenado por `sequence`
2. validar integridade estrutural dos eventos
3. validar continuidade lógica da sequência
4. inicializar o estado derivado como vazio
5. aplicar cada evento em ordem
6. registrar cada transição aceita
7. registrar cada inconsistência encontrada
8. devolver o estado final derivado

## Regras de aplicação

| Regra | Descrição |
|---|---|
| `1` | o motor só interpreta eventos pertencentes ao mesmo `chip_id` |
| `2` | o motor só aplica eventos conhecidos no `Contrato dos Eventos do Chip` |
| `3` | o motor só aplica transições permitidas pela `Máquina de Estados do Chip` |
| `4` | se um evento exigir `previous_state`, esse valor deve existir |
| `5` | `recovery_finished` nunca implica `ATIVO` por conveniência; implica apenas `restaurar_estado_anterior` |
| `6` | `recovery_failed` não encerra o chip; implica encaminhamento para `ISOLADO` |

## Estados intermediários do motor

Durante o processamento, o motor pode manter internamente:

| Elemento | Descrição |
|---|---|
| `estado_atual_derivado` | estado calculado até o momento |
| `estado_anterior_preservado` | último estado de vida preservado para recuperação |
| `ultima_sequence_processada` | última `sequence` processada com sucesso |
| `incidente_em_aberto` | incidente ativo, quando existir |
| `lista_de_violacoes` | inconsistências encontradas |

Esses elementos não são fatos de domínio persistidos por si só.

Eles são memória de cálculo do motor.

## Eventos inválidos vs desconhecidos

### Evento desconhecido

| Propriedade | Descrição |
|---|---|
| Definição | o `event_type` não existe no `Contrato dos Eventos` |
| Efeito no motor | não aplica transição e registra `UNKNOWN_EVENT` |

### Evento inválido

| Propriedade | Descrição |
|---|---|
| Definição | o `event_type` existe, mas estado, histórico ou payload violam o contrato |
| Efeito no motor | não aplica transição e registra inconsistência de domínio |

Regra:

decidir rejeição, quarentena ou persistência pertence à camada de ingestão e persistência, não ao motor.

O motor apenas identifica e registra a inconsistência.

## Inconsistências oficiais

| Tipo | Descrição |
|---|---|
| `UNKNOWN_EVENT` | `event_type` não existe no contrato |
| `INVALID_TRANSITION` | transição não permitida pela máquina |
| `INVALID_PAYLOAD` | payload não respeita o schema |
| `SEQUENCE_GAP` | falta um ou mais valores de `sequence` |
| `DUPLICATED_SEQUENCE` | mesma `sequence` repetida para o mesmo `chip_id` |
| `RESTORE_WITHOUT_PREVIOUS_STATE` | tentativa de restauração sem `previous_state` |
| `HISTORY_CORRUPTED` | histórico estruturalmente inválido |
| `MISSING_PREVIOUS_STATE` | incidente aberto sem `previous_state` obrigatório |

## Quebra de continuidade

Definição formal:

quebra de continuidade ocorre quando o motor não consegue determinar unicamente o próximo estado a partir do histórico disponível.

Causas possíveis:

- `previous_state` não registrado no incidente
- histórico corrompido ou incompleto
- eventos fora de ordem lógica
- transição não definida para o par `estado + evento`
- `RESTORE_WITHOUT_PREVIOUS_STATE`

Regra:

quando a continuidade for quebrada, o motor não inventa solução.

Ele sinaliza a quebra e o destino coerente no domínio é `ISOLADO`, conforme a máquina de estados.

## Replay

Definição:

replay é a reaplicação integral do histórico em ordem lógica.

Regra:

dado o mesmo histórico ordenado, o motor deve sempre devolver o mesmo estado.

Cenários de uso:

- auditoria
- testes
- sincronização entre workers
- reconexão de workers
- reconstrução de estado

## Determinismo

Princípio formal:

para um mesmo conjunto de eventos, na mesma ordem lógica, o motor produz sempre o mesmo resultado.

Consequências:

- auditoria confiável
- testes reproduzíveis
- sincronização entre múltiplos workers
- reconstrução após falha

## Transparência referencial

Formulação normativa:

para qualquer histórico `H`, o resultado do motor depende exclusivamente de `H`.

Isso implica:

- nenhuma leitura de banco
- nenhuma leitura de cache
- nenhum relógio
- nenhuma variável global
- nenhum estado interno persistente

Consequência:

o motor é uma função determinística do histórico e não uma peça de infraestrutura.

## Relação com persistência

| Responsabilidade | Camada |
|---|---|
| como guardar os eventos | `Persistência` |
| como materializar a garantia de `sequence` definida pelo contrato | `Persistência` |
| como impedir duplicatas | `Persistência` |
| consumir o histórico já ordenado | `Motor` |

O motor apenas consome o histórico já ordenado pela `sequence`.

## Relação com a máquina de estados

| Responsabilidade | Documento |
|---|---|
| quais estados existem | `Máquina de Estados` |
| quais transições são válidas | `Máquina de Estados` |
| como aplicar um evento conhecido sobre o estado atual | `Motor` |
| como restaurar `previous_state` | `Motor` |
| como detectar inconsistências | `Motor` |

## Histórico parcial

| Caso | Comportamento |
|---|---|
| `Histórico completo` | reconstrução total do estado |
| `Histórico parcial` | projeção parcial; não garante reconstrução completa |

Regra:

o motor aceita históricos parciais, mas deve sinalizar que a projeção é parcial.

## Garantias do motor

| Garantia | Descrição |
|---|---|
| ✓ | nunca altera o histórico |
| ✓ | nunca cria eventos |
| ✓ | nunca altera payload |
| ✓ | nunca modifica `sequence` |
| ✓ | nunca modifica timestamps |
| ✓ | nunca modifica `event_id` |
| ✓ | nunca interpreta eventos fora do contrato |
| ✓ | nunca executa transições proibidas |
| ✓ | nunca depende de projeções persistidas |
| ✓ | sempre produz o mesmo resultado para o mesmo histórico |
| ✓ | nunca tem efeitos colaterais |

## Critério de qualidade

O motor estará correto quando:

- nunca reinterpretar um evento fora do contrato
- nunca produzir transição proibida
- nunca depender de projeção persistida para reconstruir estado
- sempre devolver o mesmo resultado para o mesmo histórico
- identificar e registrar todas as inconsistências
- não inventar fatos ausentes

## Hierarquia arquitetural

`Core do Produto -> Contrato de Domínio -> Máquina de Estados -> Contrato dos Eventos -> Motor de Estados -> Persistência -> API -> Workers -> Interface -> Auditoria`

## Responsabilidades por documento

| Documento | Responsabilidade |
|---|---|
| `Contrato de Domínio` | identidade e invariantes do chip |
| `Máquina de Estados` | estados e transições válidas |
| `Contrato dos Eventos` | fatos, schema e metadados |
| `Motor de Estados` | aplicação determinística dos eventos |
| `Persistência` | armazenamento e ordenação oficial (`sequence`) |
| `API, Workers, Interface` | implementação obedecendo aos contratos |

## Declaração de congelamento

Este documento está congelado como algoritmo normativo do `Core do Produto`.

Próximo documento:

`Persistência`
