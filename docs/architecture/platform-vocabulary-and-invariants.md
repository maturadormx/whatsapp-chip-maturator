# Vocabulário e invariantes da plataforma

## Objetivo

Este documento fecha a cirurgia arquitetural final de nomenclatura, fronteiras e invariantes. Ele existe para reduzir ambiguidade de nomes e impedir que o crescimento do projeto degrade contratos entre camadas.

## Convenção de nomes

Os sufixos da plataforma passam a significar responsabilidades explícitas:

| Sufixo | Papel |
| --- | --- |
| `Engine` | interpreta, aprende ou decide |
| `Service` | orquestra, integra ou coordena fluxos |
| `Generator` | transforma `A -> B` de forma determinística |
| `Planner` | produz planos, nunca executa |
| `Executor` | executa planos ou simulações |
| `Repository` | persiste e consulta |

## Invariantes

As regras abaixo não são recomendação. Elas definem o que nunca pode acontecer.

- `Behavior Engine` nunca lê `behavior_timeline` diretamente.
- `Strategy Engine` nunca escreve no banco.
- `Knowledge Base` nunca recebe escrita externa ao `Learning Engine`.
- `Dashboard` nunca dispara materialização diretamente.
- `OperationalMaterializationService` é o único dono público da materialização.
- snapshots antigos permanecem legíveis e nunca são reescritos.

## Estado observado vs inferido

Os dois tipos de estado devem continuar explicitamente separados:

### Estado observado

- `sessions`
- `activity_logs`
- `behavior_timeline`

### Estado inferido

- `episodes`
- `identity`
- `knowledge`
- `strategy`
- `risk`

Nenhuma API pública deve misturar os dois conjuntos dentro do mesmo namespace sem marcar a fronteira de derivação.

## Versionamento

A regra de versionamento fica assim:

- toda mudança incompatível incrementa versão
- versões antigas continuam legíveis
- snapshots nunca são reescritos
- envelopes públicos sempre expõem `version` e `generatedAt`

## Múltiplas fontes de evidência

O `Evidence Normalizer` deve aceitar mais de uma origem sem quebrar contratos futuros. A fonte atual continua sendo `whatsapp`, mas os contratos já precisam prever:

- `contacts`
- `calendar`
- `agenda`
- `crm`
- `social`

O ponto importante não é a integração agora. É impedir que o normalizador nasça acoplado para sempre a uma única origem.

## Contratos públicos

Os contratos públicos por camada ficam centralizados em `server/contracts/`. Essa pasta define:

- envelope padrão
- `DecisionContext`
- API pública mínima por camada
- contratos futuros de `Learning`, `Strategy` e `Executor`

## Consequências

Com esse documento, o nome de um componente volta a carregar significado arquitetural e os desvios mais perigosos deixam de ser apenas um problema de revisão humana.
