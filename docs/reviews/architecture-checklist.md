## Checklist de Arquitetura para Todo PR

### Inversão de Dependência
- [ ] Serviço depende apenas de interfaces (`import type`)
- [ ] Nenhuma implementação concreta é importada no domínio
- [ ] Contrato de produção não contém métodos de teste

### Acoplamento

- [ ] Nenhum componente instancia implementações de infraestrutura ou adapters concretos
- [ ] Nenhum componente acessa singleton global

### Responsabilidade Única
- [ ] Adapter fornece capacidade, não comportamento
- [ ] Policy toma decisão pura, não executa efeito
- [ ] Application Service coordena Capabilities para executar Decision
- [ ] State Machine calcula, não orquestra
- [ ] Decision descreve intenção, nunca produz efeito

### Determinismo
- [ ] Testes usam script de resultados, não taxas probabilísticas
- [ ] Nenhum estado compartilhado entre testes (`reset` completo)
- [ ] Histórico exposto como `readonly`, nunca array mutável

### Simetria
- [ ] Nova dependência externa segue padrão: Contrato → Produção → Teste
- [ ] Gateway, Clock e Repository tratados com mesma disciplina

### Contratos

- [ ] O contrato não expõe detalhes de implementação

### Evolução

- [ ] Mudança preserva compatibilidade com contratos existentes
- [ ] Caso tenha alterado contrato, existe ADR justificando
- [ ] Existe plano de migração

### Consistência Arquitetural

- [ ] A mudança segue algum padrão já existente
- [ ] Caso não siga, existe ADR justificando a exceção

### Vocabulário

- [ ] Nenhum componente novo viola a nomenclatura oficial
- [ ] O novo componente se enquadra em `Adapter`, `Policy`, `Application Service`, `State Machine`, `Use Case` ou `Domain Service`

### ADR

- [ ] Existe ADR novo, se aplicável
- [ ] ADRs existentes continuam válidos

### Prevenção de Conceitos Novos

- [ ] Não existe duplicação de padrão
- [ ] Não existe solução equivalente já implementada
- [ ] Não estou criando um novo conceito desnecessário

### Simplicidade

- [ ] A solução reduz ou mantém a complexidade arquitetural
