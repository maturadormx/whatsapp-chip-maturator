# Glossário Arquitetural

> Este documento é a fonte única de verdade para a terminologia utilizada na arquitetura.

## Adapter

Componente que oferece capacidade ao domínio. Não possui policy.

## Application Service

Coordena a execução de um caso de uso utilizando Policies e Capabilities.

## Architecture Style

Conjunto de práticas arquiteturais adotadas, como DDD, Hexagonal e Functional Core. Fornece contexto, não define regras.

## Capability

Capacidade abstrata percebida pelo domínio. Um `Adapter` é uma implementação concreta dessa `Capability`.

## Command

Intenção do usuário ou sistema que inicia um fluxo de escrita.

## Contract

Define a semântica pública de uma `Capability`. Inclui operações, tipos e invariantes observáveis. Não define implementação, tecnologia ou estratégia.

## Decision

Descrição de intenção. Nunca produz efeito. Pode ser simples ou composta.

## Domain Service

Componente que encapsula lógica de domínio que não pertence a uma entidade específica.

## Effect

Qualquer interação com uma `Capability` cujo resultado possa modificar o mundo externo. Pode ter sucesso, falha ou timeout.

## Fact

Observação imutável, validada, tipada e semanticamente significativa. Estável durante toda a execução da `Policy`.

## Invariant

Propriedade que define a identidade da arquitetura. Se deixar de ser verdadeira, o sistema deixa de ser esta arquitetura.

## Observation

Informação percebida pelo sistema antes de qualquer interpretação pelo domínio.

## Policy

Função pura que transforma `1..N Facts` em `1 Decision`, sem efeitos colaterais.

## Principle

Regra permanente da arquitetura, com justificativa e consequências.

## Result

Valor retornado pelo `Application Service`. Pode conter dados, indicadores de sucesso, falha ou ambos. Não é uma etapa arquitetural.

## Script

Sequência determinística utilizada por adapters de teste.

## ScriptExhaustedError

Erro lançado quando um mock esgota seu script. Indica teste mal configurado.

## State Machine

Componente que calcula transições de estado. Não orquestra.

## Use Case

Descrição de um cenário de negócio. Pode orquestrar múltiplos `Application Services`.
