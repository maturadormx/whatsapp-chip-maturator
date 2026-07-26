# MATURADOR_AGENTES

## Objetivo

Mapear a camada de IA, aprendizado, agentes, hipóteses e inteligência do `Maturador`.

## Ponto de partida

O `Maturador` não possui um diretório `agent/` separado como o `VenonX`.

Isso significa:

- não há um “agente” isolado como processo próprio
- a inteligência do projeto está embutida no backend e na interface

## Elementos de inteligência encontrados

### Backend

- `server/services/adaptiveLearningEngineService.ts`
- `server/services/fleetLearningService.ts`
- `server/services/behaviorMemoryService.ts`
- `server/services/behaviorMemoryShadowService.ts`
- `server/services/behaviorCognitiveObservabilityService.ts`
- `server/services/behaviorLongitudinalService.ts`
- `server/services/behaviorPlannerService.ts`
- `server/services/behaviorSandboxService.ts`
- `server/services/behaviorValidationService.ts`
- `server/services/identitySnapshotGeneratorService.ts`
- `server/services/episodeBuilderService.ts`

### Frontend

- `client/src/components/AIChatBox.tsx`

### Documentação

- `docs/adr/ADR-005-learning-engine-como-camada-de-hipoteses-e-conhecimento.md`
- `docs/adr/ADR-006-knowledge-base-e-hypothesis-model.md`
- `docs/architecture/adaptive-intelligence-phase.md`
- `docs/architecture/fleet-learning-phase.md`
- `docs/architecture/longitudinal-learning-foundation.md`
- `docs/architecture/social-trajectories-and-silence-intelligence.md`

## O que existe

| Capacidade | Estado | Evidência |
|---|---|---|
| Learning Engine | Existe | `adaptiveLearningEngineService.ts` |
| Fleet Learning | Existe | `fleetLearningService.ts` |
| Memory / Behavior Memory | Existe | `behaviorMemoryService.ts`, `behaviorMemoryShadowService.ts` |
| Observabilidade cognitiva | Existe | `behaviorCognitiveObservabilityService.ts` |
| Longitudinal learning | Existe | `behaviorLongitudinalService.ts` |
| Planner | Existe | `behaviorPlannerService.ts` |
| Validation | Existe | `behaviorValidationService.ts` |
| Sandbox | Existe | `behaviorSandboxService.ts` |
| Identity Snapshot | Existe | `identitySnapshotGeneratorService.ts` |
| Episódios / reconstrução de eventos | Existe | `episodeBuilderService.ts` |
| UI de IA | Existe | `AIChatBox.tsx` |

## O que não foi encontrado como módulo separado

| Capacidade | Estado | Observação |
|---|---|---|
| Prompt Engine | Não encontrado | não há pasta ou serviço com esse nome explícito |
| Agente dedicado | Não encontrado | não existe diretório `agent/` |
| Tool layer separada | Não encontrado | a instrumentação aparece espalhada pelo backend |
| KB isolada como pasta | Não encontrado | a camada de conhecimento aparece por ADR e serviços |

## Interpretação

O `Maturador` possui inteligência real, mas não no formato “agente clássico” com pasta dedicada. A inteligência está distribuída em:

- serviços de aprendizado
- memória e comportamento
- observabilidade cognitiva
- sandbox e validação
- documentação arquitetural de hipóteses e conhecimento

## Conclusão

Se alguém perguntar “o projeto tem agentes?”, a resposta mais correta é:

- não há `agent` separado
- mas há uma camada relevante de IA e aprendizado embutida no backend

Em outras palavras, o `Maturador` é um sistema com inteligência distribuída, não um app com um único agente isolado.
