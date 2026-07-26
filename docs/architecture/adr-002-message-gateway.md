# ADR 002: Abstração MessageGateway

## Status

Aceito (`Fase 2` do `Marco 2`)

## Contexto

O `ExecutionService` dependia diretamente de um executor concreto (`sendMessage`), acoplando orquestração de domínio à infraestrutura de transporte.

Isso gerava três problemas principais:

- acoplamento entre domínio e transporte
- dificuldade de testar o envio de forma isolada
- barreira para múltiplas implementações futuras

## Decisão

Criar a interface `MessageGateway` como abstração pura:

```typescript
interface MessageGateway {
  send(message: OutboundMessage): Promise<GatewayResult>;
}
```

O contrato do gateway foi separado em:

- `OutboundMessage`
- `GatewayResult`
- `MessageGateway`

Além disso:

- `ExecutionService` passou a depender do gateway por injeção
- a implementação legada foi preservada atrás de um adapter padrão
- a Fase 2 ganhou um `FakeMessageGateway` para testes

## Consequências

### Positivas

- desacoplamento entre domínio e infraestrutura
- facilita testes com `FakeMessageGateway`
- permite múltiplas implementações futuras:
  - `WhatsAppGateway`
  - `MockGateway`
  - outros transports

### Negativas

- camada adicional de indireção
- necessidade de adapter para a implementação legada

## Alternativas consideradas

### Função direta

Rejeitada. Não permite injeção nem testes isolados adequados.

### Herança

Rejeitada. A decisão foi favorecer composição sobre herança.

## Regras do contrato

- nenhuma lógica de retry no gateway
- nenhuma lógica de budget no gateway
- nenhuma lógica de orquestração no gateway
- nenhuma decisão de negócio no gateway

O gateway apenas:

1. recebe uma `OutboundMessage`
2. executa o envio
3. retorna um `GatewayResult`

## Implementação

- `Commit 1`: contratos (`MessageGateway`, `OutboundMessage`, `GatewayResult`)
- `Commit 2`: injeção no `ExecutionService`
- `Commit 3`: fake e testes dedicados
- `Commit 4`: documentação e rastreabilidade
