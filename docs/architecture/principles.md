# Princípios Arquiteturais

## Dependency Inversion

O domínio depende apenas de abstrações estáveis.

### Consequências

- adapters nunca são importados pelo domínio
- dependências entram por injeção
- implementações podem ser trocadas sem alterar o núcleo

## Single Responsibility

Adapters fornecem capacidades. Policies tomam decisões. Application Services coordenam.

### Consequências

- nenhum componente Deus
- testabilidade isolada
- clareza de propósito em cada arquivo

## Determinismo

Testes não dependem de aleatoriedade, tempo real ou estado compartilhado.

### Consequências

- scripts determinísticos em vez de taxas probabilísticas
- `readonly` em vez de arrays mutáveis
- `reset()` completo entre testes

## Simetria

Toda integração externa possui exatamente três elementos: Contrato, Adapter de Produção, Adapter de Teste.

### Consequências

- padrão repetível para qualquer nova dependência
- previsibilidade na estrutura de diretórios
- facilidade de revisão

## Purity

Policies são funções puras.

### Consequências

- testabilidade trivial
- comportamento previsível
- sem efeitos colaterais escondidos

## Evolution by Extension

A arquitetura evolui por extensão antes de evolução por substituição.

### Consequências

- novo pattern → novo ADR → nova capability
- nunca reescrever o núcleo
- compatibilidade preservada
