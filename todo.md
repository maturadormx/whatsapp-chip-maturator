# WhatsApp Chip Maturator - TODO

## Backend - Banco de Dados e Schema

- [x] Criar tabelas: chips, maturation_profiles, scheduled_tasks, activity_logs
- [x] Adicionar colunas para QR code, status, perfil de maturação
- [x] Configurar índices para performance

## Backend - API de Gerenciamento de Chips

- [x] Endpoint para conectar novo chip via QR code
- [x] Endpoint para desconectar/remover chip
- [x] Endpoint para pausar/retomar maturação
- [x] Endpoint para configurar perfil de maturação (suave, normal, ultra)
- [x] Endpoint para listar todos os chips com status

## Backend - Engine de Maturação 24/7

- [x] Integrar Baileys para conexão WhatsApp
- [x] Criar serviço de gerenciamento de sessões
- [x] Implementar envio de mensagens com delay
- [x] Implementar simulação de digitação
- [x] Criar routers tRPC para WhatsApp
- [x] Implementar Heartbeat job para disparar maturação automática
- [x] Engine de simulação de comportamento humano
- [x] Perfis de maturação (suave, normal, ultra) com delays aleatórios
- [x] Geração de mensagens variadas e naturais
- [ ] Simulação de gravação de áudio
- [ ] Envio de imagens com legendas aleatórias
- [x] Reações com emojis às mensagens recebidas

## Backend - Agendamento de Disparos

- [ ] Endpoint para criar agendamento por horário
- [ ] Endpoint para disparos em massa para grupos
- [ ] Endpoint para disparos em massa para listas de números
- [ ] Controle de intervalo entre envios

## Backend - Logs e Histórico

- [ ] Endpoint para obter logs de atividade por chip
- [ ] Armazenar histórico completo de ações
- [ ] Filtros por tipo de ação, data, status

## Frontend - Layout e Estética Cyberpunk

- [x] Configurar tema cyberpunk (neon rosa, ciano, fundo preto)
- [x] Implementar fontes geométricas bold com efeito neon
- [x] Criar componentes HUD com linhas técnicas e colchetes
- [x] Efeitos de brilho e glow em elementos principais

## Frontend - Dashboard Principal

- [x] Exibir lista de chips com status (conectado, maturando, desconectado)
- [x] Dashboard moderno com cards premium e grid 3D
- [x] Indicador visual de atividade por chip
- [x] Stats em tempo real (conectados, maturando, mensagens, uptime)
- [ ] Status em tempo real com atualização via WebSocket/polling
- [x] Controles para pausar/retomar/configurar cada chip

## Frontend - Conexão QR Code

- [ ] Componente para exibir QR code
- [ ] Fluxo de escaneamento e conexão
- [ ] Feedback visual durante conexão

## Frontend - Configuração de Perfis

- [ ] Interface para selecionar perfil: suave, normal, ultra
- [ ] Exibição de parâmetros de cada perfil
- [ ] Ajuste fino de parâmetros (delays, frequência, etc)

## Frontend - Agendamento

- [ ] Formulário para criar agendamento por horário
- [ ] Seleção de grupos/números para disparo
- [ ] Configuração de intervalo entre envios
- [ ] Listagem de agendamentos ativos

## Frontend - Logs e Atividade

- [ ] Página de logs com filtros
- [ ] Histórico de ações por chip
- [ ] Exportação de relatórios

## Integração e Testes

- [x] Testes de API de chips
- [x] Integrar Baileys para conexão WhatsApp
- [x] Heartbeat endpoint registrado e pronto
- [x] Engine de maturação com 3 perfis funcionando
- [ ] Testes de maturação automática em produção
- [ ] Testes de disparos em massa
- [ ] Testes de agendamento 24/7
- [ ] Verificar performance com 50+ chips simultâneos

## Deployment

- [ ] Criar checkpoint final
- [ ] Publicar projeto


## Sistema de Controle de Usuários

- [ ] Atualizar schema: adicionar userId em whatsappChips, activityLogs, scheduledTasks
- [ ] Criar tabela de planos (plans) com limites de chips, mensagens, etc
- [ ] Criar tabela de subscrições de usuários (user_subscriptions)
- [ ] Implementar adminProcedure para endpoints administrativos
- [ ] Implementar userProcedure para endpoints de usuários comuns
- [ ] Isolamento de dados: chips retornam apenas do usuário logado
- [ ] Isolamento de dados: logs retornam apenas do usuário logado
- [ ] Isolamento de dados: agendamentos retornam apenas do usuário logado
- [ ] Validação de limites: verificar máximo de chips por plano
- [ ] Validação de limites: verificar limite de mensagens/mês
- [ ] Dashboard de Admin: listar todos os usuários
- [ ] Dashboard de Admin: ver estatísticas por usuário
- [ ] Dashboard de Admin: gerenciar planos e limites
- [ ] Dashboard de Admin: promover/rebaixar usuários
- [ ] Página de Planos: mostrar opções de subscrição
- [ ] Testes: verificar isolamento de dados entre usuários
- [ ] Testes: verificar limites de plano funcionando
