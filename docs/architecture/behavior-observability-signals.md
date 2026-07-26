# Sinais de observabilidade comportamental

Esta camada adiciona leitura de risco e qualidade sobre o comportamento já observado, sem executar ações novas.

## Objetivo

Detectar padrões perigosos antes que eles virem estratégia ou execução.

## Componentes

### `Anti-Pattern Detector`

Detecta sinais como:

- sequência repetida
- tempo de resposta fixo
- horário exato recorrente
- fala imediata após entrada em grupo
- expansão excessiva para contatos novos
- excesso de mídias
- excesso de links
- excesso de contatos únicos

Cada achado expõe:

- `pattern`
- `severity`
- `confidence`
- `riskImpact`
- `recommendation`

### `Behavior Variance Score`

Mede quão previsível ou variado está o repertório comportamental.

Componentes:

- variância de horário
- variância de resposta
- variância de mídia
- variância de contatos
- variância de grupos
- variância de pausas

### `Persona Diversity Index`

Mede se o chip aparenta ter uma vida digital distribuída entre canais, e não um roteiro estreito.

Canais observados:

- `Status`
- `Grupos`
- `DM`
- `Fotos`
- `Áudios`
- `Reações`
- `Chamadas`
- `Listas`
- `Comunidades`

### `Social Graph Health`

Lê a saúde da rede social do chip:

- contatos ativos
- contatos recorrentes
- novos contatos
- grupos ativos
- reciprocidade
- equilíbrio de distribuição

### `Credibility Trend`

Constrói tendência em janelas de:

- `7d`
- `15d`
- `30d`
- `90d`

Evolução observada em:

- credibilidade
- risco
- diversidade
- naturalidade

### `Identity Drift Timeline`

Mantém histórico de deriva da identidade ao longo do tempo para expor mudança gradual de perfil.

## Fronteiras

- não executa comportamento
- não decide estratégia
- não chama `whatsappService`
- apenas lê eventos, episódios e snapshots
