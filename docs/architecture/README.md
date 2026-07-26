# Arquitetura 2.0

Esta pasta agora contém a baseline arquitetural 2.0 do projeto. Ela separa filosofia, invariantes, princípios, contexto, fluxos, padrões, implementações, vocabulário e roadmap em documentos com papéis claramente distintos.

## Baseline oficial

- `manifesto.md`: filosofia arquitetural
- `invariants.md`: identidade da arquitetura
- `principles.md`: regras permanentes com justificativa
- `architecture-style.md`: contexto arquitetural adotado
- `contracts.md`: contratos/ports reconhecidos pelo núcleo
- `flows.md`: dinâmica dos casos de uso
- `patterns.md`: padrões reutilizáveis independentes do projeto
- `implementations.md`: decisões específicas do projeto
- `glossary.md`: vocabulário normativo
- `roadmap.md`: visão evolutiva

## Política de evolução

Os documentos fundamentais:

- `manifesto.md`
- `invariants.md`
- `principles.md`

evoluem apenas mediante ADR aprovado.

Os demais documentos podem evoluir para esclarecer, detalhar ou documentar novos padrões, desde que preservem os princípios arquiteturais.

Nenhum princípio pode ser alterado sem ADR.

## Documentos complementares

Os demais arquivos desta pasta continuam existindo como documentação técnica complementar, histórica ou de fases específicas do roadmap. Eles não substituem a baseline 2.0; eles a detalham em contextos específicos.

## Operações

Documentos de execução do time (não normativos) ficam em `docs/operations/`.
