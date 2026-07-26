# Padrões Arquiteturais

> Padrões independentes do projeto. Implementações específicas ficam em `implementations.md`.

## Padrões comportamentais

| Padrão | Descrição |
|---|---|
| `Policy` | Transforma fatos em decisões. Função pura |
| `State Machine` | Calcula transições de estado. Padrão aplicável quando existe estado de domínio |
| `Factory` | Cria objetos de domínio sem expor lógica de construção |

## Padrões estruturais

| Padrão | Descrição |
|---|---|
| `Repository` | Abstração de persistência. Contrato → Produção → Teste |
| `Gateway` | Abstração de comunicação externa. Contrato → Produção → Teste |
| `Adapter` | Implementação de uma Capability através de um Contract |

## Padrões de teste

| Padrão | Descrição |
|---|---|
| `Script` | Sequência determinística de resultados para adapters de teste |
| `Mutable Clock` | Relógio de teste controlável (avança, seta, reseta) |
| `Replay Clock` | Reproduz timestamps gravados para testes de regressão |
