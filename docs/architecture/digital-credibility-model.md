# Digital Credibility Model

## Objetivo

O `Digital Credibility Model` organiza hipóteses arquiteturais sobre quais sinais parecem aumentar, reduzir ou não alterar a credibilidade digital de um chip dentro do ecossistema observado do WhatsApp.

Este documento não afirma funcionamento interno da plataforma. Ele serve como mapa de hipóteses a validar por observação futura.

> Nota epistemológica obrigatória: o `Digital Credibility Model` representa uma aproximação baseada em evidências empíricas coletadas pelo sistema. Ele orienta decisões internas, mas não deve ser interpretado como modelo oficial do funcionamento do WhatsApp.

## Princípio central

Credibilidade digital não é o mesmo que volume de atividade.

Um chip pode agir muito e parecer artificial. Outro pode agir menos, mas produzir um padrão de presença mais plausível, socialmente coerente e menos exposto a restrição. O modelo existe para organizar essa diferença como linguagem arquitetural.

## Regra de interpretação

Toda classificação abaixo deve ser lida como:

- hipótese observacional
- sujeita a validação
- sujeita a contradição
- nunca tratada como verdade final sobre o WhatsApp

## Categorias de sinais

O modelo separa três grupos:

- sinais ativos
- sinais passivos
- sinais sociais

## Sinais ativos

Sinais ativos são comportamentos em que o chip explicitamente inicia ou altera o ambiente.

| Sinal ativo | Impacto hipotético | Leitura arquitetural |
| --- | --- | --- |
| Iniciar muitas conversas novas em janela curta | Negativo | Pode elevar exposição sem contexto relacional suficiente |
| Crescimento gradual de iniciativas em janelas espaçadas | Positivo | Sugere expansão menos abrupta |
| Repetir exatamente o mesmo formato de ação | Negativo | Indica padronização excessiva |
| Variar formatos de presença de forma coerente | Positivo | Pode fortalecer naturalidade observada |
| Explodir volume ativo sem histórico compatível | Negativo | Sinaliza crescimento possivelmente artificial |
| Manter atividade ativa baixa e quase nula | Neutro | Pode ser seguro, mas também insuficiente para construir credibilidade |

## Sinais passivos

Sinais passivos são comportamentos em que o chip observa, permanece presente ou reage ao ambiente sem protagonismo excessivo.

| Sinal passivo | Impacto hipotético | Leitura arquitetural |
| --- | --- | --- |
| Presença passiva recorrente e distribuída | Positivo | Pode reforçar a leitura de existência humana contínua |
| Ausência quase total de sinais passivos com alta ação ativa | Negativo | Cria desbalanceamento entre presença e emissão |
| Observação moderada antes de ampliar atividade | Positivo | Sugere amadurecimento mais plausível |
| Longos períodos sem qualquer sinal combinado com explosões ativas | Negativo | Pode indicar comportamento episódico artificial |
| Presença passiva discreta, porém consistente | Neutro | Isoladamente não prova credibilidade, mas ajuda contexto |

## Sinais sociais

Sinais sociais são comportamentos que conectam o chip a uma malha relacional visível.

| Sinal social | Impacto hipotético | Leitura arquitetural |
| --- | --- | --- |
| Receber interações de múltiplas origens | Positivo | Pode indicar inserção relacional mais crível |
| Participação social concentrada em poucas rotas repetidas | Negativo | Sugere malha social pobre ou artificial |
| Diversidade gradual de contatos e grupos | Positivo | Pode fortalecer contexto social do chip |
| Expansão social abrupta sem histórico | Negativo | Aumenta exposição e estranheza do padrão |
| Interação social pequena, mas estável | Neutro | Pode ser compatível com perfis mais reservados |

## Hipóteses estruturantes

O modelo parte de algumas hipóteses arquiteturais principais:

### Credibilidade emerge de composição

Nenhum sinal isolado define credibilidade. O que parece importar é a composição entre:

- atividade
- passividade
- diversidade
- ritmo
- inserção social

### Coerência pesa mais que intensidade

Um padrão coerente ao longo do tempo pode ser mais valioso do que grande volume de ação.

### Crescimento precisa parecer orgânico

Mudança de comportamento pode ser positiva, desde que não pareça ruptura abrupta com a trajetória anterior.

### Passividade não é ausência de valor

Sinais passivos podem ter papel importante em credibilidade, principalmente quando equilibram exposição ativa.

## Estrutura sugerida para registrar hipóteses

Cada hipótese de credibilidade deve ser registrada com:

- `signalCategory`
- `signalName`
- `hypothesizedImpact`
- `confidence`
- `sampleSize`
- `riskImpact`
- `successRate`
- `lastValidatedAt`
- `expirationPolicy`

Esses campos mantêm o documento compatível com o futuro `Hypothesis Model`.

## Relação com outros componentes

### `Learning Engine`

Pode usar este modelo como taxonomia inicial para formular hipóteses sobre credibilidade.

### `Knowledge Base`

Pode receber apenas hipóteses promovidas que sobreviverem à validação.

### `Strategy Engine`

No futuro, poderá consumir conhecimento consolidado de credibilidade, nunca este documento bruto como verdade operacional.

### `Risk Model`

Tem relação complementar, mas não idêntica. Um sinal pode aumentar credibilidade sem necessariamente reduzir risco na mesma proporção, e o contrário também pode acontecer.

## Limites

Este documento não define:

- pesos numéricos finais
- eficácia comprovada de qualquer sinal
- fórmula de score
- ação operacional automática

## Consequências

Com esse modelo, a plataforma ganha um vocabulário formal para discutir credibilidade digital sem transformar suposição em fato.

Isso ajuda a orientar evolução arquitetural, desenho do `Learning Engine` e futuras hipóteses da `Knowledge Base` mantendo o compromisso mais importante desta fase: aprender por observação, não por convicção.
