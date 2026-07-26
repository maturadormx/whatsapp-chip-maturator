# Invariantes Arquiteturais do Chip Maturador

## Governança

Status: `CONGELADO`

Versão: `1.0`

Data:

`2026-07-18`

Categoria:

`Guarda-corpo arquitetural`

Regra de governança:

este documento reúne invariantes que nunca podem ser violados, independentemente da tecnologia, da infraestrutura ou do formato da implementação.

Se uma proposta futura violar qualquer item desta lista, ela contradiz a arquitetura do sistema.

## Invariantes

### Fonte de verdade

- o `Histórico Oficial` é a única fonte de verdade do chip
- projeções, caches, snapshots e tabelas legadas nunca substituem o histórico oficial

### Eventos

- eventos do histórico oficial são append-only
- eventos oficialmente persistidos nunca são alterados
- eventos oficialmente persistidos nunca são removidos
- `event_id` identifica unicamente um fato

### Replay e estado

- estados do chip são derivados exclusivamente por replay do histórico oficial
- o `Motor de Estados` nunca contorna a ordem lógica oficial
- projeções podem ser descartadas e reconstruídas

### Aggregate

- o aggregate do chip é reconstruído a partir do histórico oficial
- o aggregate não possui identidade persistida própria fora do stream oficial

### API

- a API nunca contorna o `Motor de Estados`
- a API nunca grava estado derivado como se fosse verdade oficial

### Persistência

- a `Persistência` não valida regra de domínio
- a `Persistência` garante durabilidade, atomicidade, ordenação e integridade do histórico

### Event Store

- o `Event Store` nunca interpreta domínio
- o `Event Store` nunca deriva estado
- o `Event Store` nunca atribui significado novo aos eventos

### Workers

- workers nunca alteram o domínio por conta própria
- workers reagem apenas a fatos oficialmente persistidos
- falha de worker não compromete a consistência do domínio

### Auditoria

- a `Auditoria` nunca produz fatos de domínio
- a `Auditoria` nunca substitui o histórico oficial
- a `Auditoria` observa, verifica e registra evidências

### Interface

- a interface conhece apenas a API e as superfícies operacionais autorizadas
- a interface nunca acessa diretamente o domínio como fonte primária

### Runtime

- `Runtime` não é domínio
- `Runtime` não é a fonte de verdade do sistema
- `Runtime` existe para operações administrativas, observabilidade e integração controlada

### Migração do legado

- a migração do legado nunca modifica um stream oficial já existente
- a migração só pode criar stream oficial inexistente ou produzir comparação controlada

### Estados terminais

- estados terminais não possuem transições de saída
- `ENCERRADO` é estado terminal

## Uso recomendado

Quando surgir uma proposta de evolução, a primeira pergunta deve ser:

`isto viola alguma invariante arquitetural do chip maturador?`

Se a resposta for `sim`, a proposta exige revisão arquitetural antes de implementação.
