import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import PlanLimitsIndicator from "@/components/PlanLimitsIndicator";
import SystemSidebar from "@/components/SystemSidebar";
import { trpc } from "@/lib/trpc";
import { toast as sonnerToast } from "sonner";
import { useLocation } from "wouter";
import { Plus, Power, Settings, Trash2, Eye, Activity, Clock, Zap, MessageSquare, PauseCircle, PlayCircle, AlertTriangle, BarChart3, RefreshCw, Library } from "lucide-react";

type ChipStatus = "conectado" | "maturando" | "desconectado";

interface ChipCard {
  id: number;
  chipName: string;
  phoneNumber?: string | null;
  status: ChipStatus;
  maturationProfile: "suave" | "normal" | "ultra";
  isPaused: number;
  lastActivity?: string | Date | null;
  lastAction?: string | null;
  messagesCount?: number;
  messagesToday?: number;
  errorCount?: number;
  maturationProgress?: number;
  healthScore?: number;
  humanScore?: number;
  riskScore?: number;
  certificationStatus?: string;
  certificationUsable?: boolean;
  certificationReason?: string | null;
  phaseStartedAt?: string | Date | null;
  connectedMinutes?: number;
  lastEventAt?: string | Date | null;
  lastEventType?: string | null;
  lastPassiveAction?: string | null;
  lastPassiveActionAt?: string | Date | null;
  nextScheduledAction?: string | null;
  nextScheduledAt?: string | Date | null;
  activeMinutes?: number;
  idleMinutes?: number;
  distinctConversations?: number;
  groupsJoined?: number;
  timelineSentCount?: number;
  timelineReceivedCount?: number;
}

interface DashboardActivityItem {
  id: number;
  chipId: number;
  chipName: string;
  actionType: string;
  status: "success" | "failed" | "pending";
  createdAt: string | Date;
  description: string;
}

interface DashboardExecutionJobItem {
  id: number;
  chipId: number;
  chipName: string;
  executionType: "dispatch" | "maturation";
  status: "pending" | "running" | "completed" | "failed" | "partial";
  profileName: "suave" | "normal" | "ultra";
  successCount: number;
  failureCount: number;
  totalMessagesSent: number;
  plannedMessages: number;
  createdAt: string | Date;
  errorMessage?: string | null;
  skippedCount?: number;
}

interface DashboardFailedAttemptItem {
  id: number;
  jobId: number;
  chipId: number;
  chipName: string;
  actionType: "message" | "reaction";
  targetType: string;
  targetValue: string;
  errorMessage?: string | null;
  createdAt: string | Date;
}

interface DashboardSkippedAttemptItem {
  id: number;
  jobId: number;
  chipId: number;
  chipName: string;
  targetType: string;
  targetValue: string;
  reason: string;
  createdAt: string | Date;
}

interface DashboardChipHotspotItem {
  chipId: number;
  chipName: string;
  skippedCount: number;
  failedCount: number;
}

interface DashboardTargetHotspotItem {
  targetType: string;
  targetValue: string;
  skippedCount: number;
  lastReason: string;
}

interface DashboardOperationalRules {
  dispatch: Record<string, Record<string, { cooldownMinutes: number; maxPerHour: number; maxPerDay: number }>>;
  maturation: Record<string, Record<string, { cooldownMinutes: number; maxPerHour: number; maxPerDay: number }>>;
}

interface DashboardReadiness {
  connectedChips: number;
  activeTemplates: number;
  totalTargets: number;
  groupTargets: number;
  numberTargets: number;
  readyForDispatch: boolean;
}

type StatAccent = "green" | "yellow" | "cyan" | "purple";

export default function Dashboard() {
  const { user, isAuthenticated, loading } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "/login",
  });
  const { data: dashboardData, isLoading } = trpc.chips.getDashboardData.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 15000,
  });
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const chipCards = (dashboardData?.chips ?? []) as ChipCard[];
  const recentActivity = (dashboardData?.recentActivity ?? []) as DashboardActivityItem[];
  const recentExecutionJobs = (dashboardData?.recentExecutionJobs ?? []) as DashboardExecutionJobItem[];
  const recentFailedAttempts = (dashboardData?.recentFailedAttempts ?? []) as DashboardFailedAttemptItem[];
  const recentSkippedAttempts = (dashboardData?.recentSkippedAttempts ?? []) as DashboardSkippedAttemptItem[];
  const chipOperationalHotspots = (dashboardData?.chipOperationalHotspots ?? []) as DashboardChipHotspotItem[];
  const targetOperationalHotspots = (dashboardData?.targetOperationalHotspots ?? []) as DashboardTargetHotspotItem[];
  const operationalRules = (dashboardData?.operationalRules ?? null) as DashboardOperationalRules | null;
  const readiness = (dashboardData?.readiness ?? null) as DashboardReadiness | null;
  const summary = dashboardData?.summary;
  const [busyChipId, setBusyChipId] = useState<number | null>(null);
  const setPausedMutation = trpc.chips.setPaused.useMutation();
  const removeChipMutation = trpc.chips.remove.useMutation();
  const pausedChips = chipCards.filter((chip) => Number(chip.isPaused) === 1).length;
  const averageMaturationProgress = chipCards.length
    ? Math.round(chipCards.reduce((acc, chip) => acc + (chip.maturationProgress ?? 0), 0) / chipCards.length)
    : 0;

  const actionLabels = useMemo(
    () =>
      ({
        message_sent: "Mensagem enviada",
        image_sent: "Imagem enviada",
        audio_sent: "Áudio enviado",
        reaction_sent: "Reação enviada",
        message_received: "Mensagem recebida",
        connection: "Conectado",
        disconnection: "Desconectado",
        error: "Erro",
        session_connected: "Sessão conectada",
        contacts_synced: "Contatos sincronizados",
        profile_name_updated: "Nome atualizado",
        profile_photo_updated: "Foto atualizada",
        about_updated: "Recado atualizado",
        wake_up: "Despertou",
        idle: "Ocioso",
        status_viewed: "Status vistos",
        chat_list_opened: "Conversas abertas",
        sleep: "Dormindo",
        group_opened: "Grupo aberto",
        participants_loaded: "Participantes carregados",
        waiting_connection: "Aguardando conexão",
        paused: "Pausado",
      } as Record<string, string>),
    []
  );

  const getStatusColor = (status: ChipStatus) => {
    switch (status) {
      case "conectado":
        return "text-green-400";
      case "maturando":
        return "text-yellow-400";
      case "desconectado":
        return "text-red-400";
    }
  };

  const getStatusLabel = (status: ChipStatus) => {
    const labels: Record<ChipStatus, string> = {
      conectado: "Conectado",
      maturando: "Maturando",
      desconectado: "Desconectado",
    };
    return labels[status];
  };

  const getCertificationColor = (status?: string) => {
    if (status === "APROVADO") return "text-green-300";
    if (status === "RESTRITO") return "text-yellow-300";
    if (status === "REPROVADO") return "text-red-300";
    return "text-cyan-300";
  };

  const formatRelativeTime = (dateValue?: string | Date | null) => {
    if (!dateValue) return "Sem atividade";
    const date = new Date(dateValue);
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return "agora";
    if (diffMinutes < 60) return `${diffMinutes} min atrás`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h atrás`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d atrás`;
  };

  const formatTimeInPhase = (dateValue?: string | Date | null) => {
    if (!dateValue) return "fase recém-criada";
    const date = new Date(dateValue);
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
    if (diffMinutes < 60) return `${diffMinutes} min na fase`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h na fase`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d na fase`;
  };

  const formatFutureTime = (dateValue?: string | Date | null) => {
    if (!dateValue) return "sem agenda";
    const date = new Date(dateValue);
    const diffMs = date.getTime() - Date.now();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
    if (diffMinutes < 1) return "agora";
    if (diffMinutes < 60) return `em ${diffMinutes} min`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `em ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `em ${diffDays}d`;
  };

  const stats = [
    { label: "Conectados", value: summary?.connectedCount ?? 0, icon: Power, accent: "green" as StatAccent },
    { label: "Maturando", value: summary?.maturingCount ?? 0, icon: Activity, accent: "yellow" as StatAccent },
    { label: "Mensagens hoje", value: summary?.messagesToday ?? 0, icon: MessageSquare, accent: "cyan" as StatAccent },
    { label: "Taxa de sucesso", value: `${summary?.successRate ?? 100}%`, icon: BarChart3, accent: "purple" as StatAccent },
  ];

  const getJobStatusLabel = (status: DashboardExecutionJobItem["status"]) => {
    const labels = {
      pending: "Pendente",
      running: "Rodando",
      completed: "Concluído",
      failed: "Falhou",
      partial: "Parcial",
    } as const;
    return labels[status];
  };

  const getJobStatusColor = (status: DashboardExecutionJobItem["status"]) => {
    if (status === "completed") return "text-green-400";
    if (status === "failed") return "text-red-400";
    if (status === "partial") return "text-yellow-400";
    return "text-cyan-400";
  };

  const statClasses = {
    green: {
      bg: "bg-green-500/20",
      text: "text-green-400",
      value: "text-green-400",
    },
    yellow: {
      bg: "bg-yellow-500/20",
      text: "text-yellow-400",
      value: "text-yellow-400",
    },
    cyan: {
      bg: "bg-cyan-500/20",
      text: "text-cyan-400",
      value: "text-cyan-400",
    },
    purple: {
      bg: "bg-purple-500/20",
      text: "text-purple-400",
      value: "text-purple-400",
    },
  } as const;

  const handleTogglePaused = async (chip: ChipCard) => {
    try {
      setBusyChipId(chip.id);
      await setPausedMutation.mutateAsync({
        chipId: chip.id,
        isPaused: !Boolean(chip.isPaused),
      });
      await utils.chips.getDashboardData.invalidate();
      await utils.chips.list.invalidate();
      sonnerToast.success(chip.isPaused ? "Chip retomado com sucesso." : "Chip pausado com sucesso.");
    } catch (error: any) {
      sonnerToast.error(error?.message || "Falha ao atualizar o chip.");
    } finally {
      setBusyChipId(null);
    }
  };

  const handleRemoveChip = async (chip: ChipCard) => {
    const confirmed = window.confirm(`Remover o chip "${chip.chipName}"? Essa ação apaga o chip e seus registros relacionados.`);
    if (!confirmed) return;

    try {
      setBusyChipId(chip.id);
      await removeChipMutation.mutateAsync({ chipId: chip.id });
      await utils.chips.getDashboardData.invalidate();
      await utils.chips.list.invalidate();
      await utils.chips.listLogs.invalidate();
      sonnerToast.success("Chip removido com sucesso.");
    } catch (error: any) {
      sonnerToast.error(error?.message || "Falha ao remover o chip.");
    } finally {
      setBusyChipId(null);
    }
  };

  if (loading) {
    return (
      <div className="app-shell bg-app-grid flex items-center justify-center">
        <Card className="card-premium-enhanced p-8 text-center">
          <p className="text-cyan-400 font-semibold">Carregando dashboard...</p>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="app-shell bg-app-grid">
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-custom py-8 px-4">
          <div className="container mx-auto">
            <div className="system-switcher">
              <button
                onClick={() => setLocation("/admin-systems")}
                className="system-switcher-button system-switcher-button-active-cyan"
              >
                Central admin
              </button>
              <button
                onClick={() => setLocation("/dashboard")}
                className="system-switcher-button system-switcher-button-active-emerald"
              >
                Sistema 1 • Maturação
              </button>
              <button
                onClick={() => setLocation("/bulk-dispatch")}
                className="system-switcher-button"
              >
                Sistema 2 • Marketing
              </button>
            </div>
            <p className="page-breadcrumb page-breadcrumb-emerald">Central admin / sistema 1 / maturação</p>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="page-title mb-2">CENTRAL DE MATURAÇÃO</h1>
                <p className="page-subtitle flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  M13 Group • sistema 1 independente para saúde e aquecimento dos chips
                </p>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-sm">USUÁRIO: {user?.name || "ANÔNIMO"}</p>
                <div className="flex items-center gap-3 justify-end mt-1">
                  <p className="text-emerald-400 text-lg font-bold">{summary?.totalChips ?? chipCards.length} / 50 CHIPS</p>
                  <button
                    className="text-cyan-400 hover:text-cyan-300 transition"
                    onClick={() => void utils.chips.getDashboardData.invalidate()}
                    title="Atualizar dashboard"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Stats Row - Grid 3D */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {stats.map((stat, i) => {
                const Icon = stat.icon;
                const palette = statClasses[stat.accent];
                return (
                  <div
                    key={i}
                    className="card-premium-enhanced card-3d p-5 flex items-center gap-4 hover:scale-105 transition-all duration-300"
                  >
                    <div className={`p-3 rounded-lg ${palette.bg} transition`}>
                      <Icon className={`w-6 h-6 ${palette.text}`} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium uppercase">{stat.label}</p>
                      <p className={`text-2xl font-bold ${palette.value}`}>{stat.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
              <Card className="card-premium-enhanced p-5 border-emerald-500/20 bg-emerald-500/[0.03]">
                <p className="text-xs uppercase tracking-[0.08em] text-emerald-300 mb-2">Sistema 1</p>
                <h3 className="text-lg font-semibold text-white mb-2">Maturação</h3>
                <p className="text-sm text-slate-400">Monitora saúde, aquecimento, cadência e estabilidade dos chips.</p>
              </Card>

              <button className="card-premium-enhanced p-5 text-left border-white/10 hover:border-fuchsia-500/20" onClick={() => setLocation("/bulk-dispatch")}>
                <p className="text-xs uppercase tracking-[0.08em] text-fuchsia-300 mb-2">Acesso rápido</p>
                <h3 className="text-lg font-semibold text-white mb-2">Abrir marketing</h3>
                <p className="text-sm text-slate-400">O sistema 2 continua separado. Use esse atalho só para trocar de ambiente.</p>
              </button>

              <button className="card-premium-enhanced p-5 text-left border-white/10 hover:border-cyan-500/20" onClick={() => setLocation("/admin-systems")}>
                <p className="text-xs uppercase tracking-[0.08em] text-cyan-300 mb-2">Central</p>
                <h3 className="text-lg font-semibold text-white mb-2">Ver os dois sistemas</h3>
                <p className="text-sm text-slate-400">Abra a central do admin para escolher entre Maturação e Marketing sem misturar contexto.</p>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-12">
          <div className="system-layout">
            <SystemSidebar system="maturation" />
            <div>
          {/* Plan Limits */}
          <div className="mb-12">
            <h2 className="section-title">Limites do Plano</h2>
            <PlanLimitsIndicator />
          </div>

          {/* Action Buttons */}
          <div className="page-toolbar mb-12">
            <button
              className="btn-primary-modern px-6 py-3 flex items-center gap-2"
              onClick={() => setLocation("/connect-chip")}
            >
              <Plus className="w-4 h-4" />
              NOVO CHIP
            </button>
            <button
              className="btn-secondary-modern action-operations px-6 py-3 flex items-center gap-2"
              onClick={() => setLocation("/profiles")}
            >
              <Settings className="w-4 h-4" />
              PERFIS
            </button>
            <button
              className="btn-secondary-modern action-dispatch px-6 py-3 flex items-center gap-2"
              onClick={() => setLocation("/bulk-dispatch")}
            >
              <Power className="w-4 h-4" />
              MARKETING
            </button>
            <button
              className="btn-secondary-modern action-operations px-6 py-3 flex items-center gap-2"
              onClick={() => setLocation("/operations")}
            >
              <Library className="w-4 h-4" />
              OPERAÇÃO
            </button>
            <button
              className="btn-secondary-modern action-reports px-6 py-3 flex items-center gap-2"
              onClick={() => setLocation("/reports")}
            >
              <MessageSquare className="w-4 h-4" />
              RELATÓRIOS
            </button>
          </div>

          {chipCards.length > 0 && (
            <Card className="card-premium-enhanced p-6 mb-12">
              <h2 className="section-title">Prontidão operacional</h2>
              <div className="ops-glance-grid">
                <div className="ops-glance-card">
                  <p className="ops-glance-title">Chips conectados</p>
                  <p className="ops-glance-copy">{readiness?.connectedChips ?? 0} disponíveis para rodar agora.</p>
                </div>
                <div className="ops-glance-card">
                  <p className="ops-glance-title">Chips pausados</p>
                  <p className="ops-glance-copy">{pausedChips} chip(s) aguardando retomada manual.</p>
                </div>
                <div className="ops-glance-card">
                  <p className="ops-glance-title">Progresso médio</p>
                  <p className="ops-glance-copy">{averageMaturationProgress}% de avanço médio dos chips.</p>
                </div>
                <div className="ops-glance-card">
                  <p className="ops-glance-title">Status geral</p>
                  <p className={`ops-glance-copy ${readiness?.readyForDispatch ? "text-green-300" : "text-yellow-300"}`}>
                    {readiness?.readyForDispatch
                      ? "Sistema pronto para maturação com setup mínimo atendido."
                      : "Ainda falta setup mínimo para maturar com segurança."}
                  </p>
                </div>
              </div>

              <div className="ops-glance-grid mt-4">
                <button className="ops-glance-card text-left" onClick={() => setLocation("/operations")}>
                  <p className="ops-glance-title">Preparar base</p>
                  <p className="ops-glance-copy">
                    Ajuste perfis, regras e comportamento dos chips antes de acelerar a rotina.
                  </p>
                </button>
                <button className="ops-glance-card text-left" onClick={() => setLocation("/admin-systems")}>
                  <p className="ops-glance-title">Voltar à central</p>
                  <p className="ops-glance-copy">
                    Use a central admin para trocar de sistema sem misturar o contexto desta tela.
                  </p>
                </button>
              </div>
            </Card>
          )}

          {chipCards.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
              <Card className="card-premium-enhanced p-4">
                <p className="text-[11px] text-gray-400 uppercase mb-1.5">Chips pausados</p>
                <p className="text-lg font-semibold text-yellow-400">{summary?.pausedCount ?? 0}</p>
              </Card>
              <Card className="card-premium-enhanced p-4">
                <p className="text-[11px] text-gray-400 uppercase mb-1.5">Chips ativos hoje</p>
                <p className="text-lg font-semibold text-cyan-400">{summary?.activeTodayCount ?? 0}</p>
              </Card>
              <Card className="card-premium-enhanced p-4">
                <p className="text-[11px] text-gray-400 uppercase mb-1.5">Falhas recentes</p>
                <p className="text-lg font-semibold text-red-400">{summary?.errorCount ?? 0}</p>
              </Card>
            </div>
          )}

          {chipCards.length > 0 && (
            <Card className="card-premium-enhanced p-4 mb-10">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-yellow-300 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">Proteção operacional ativa</p>
                  <p className="text-xs text-gray-400 mt-1 leading-5">
                    O sistema já aplica intervalo mínimo por destinatário e limites por hora/dia. Destinatários sensíveis podem ser pulados automaticamente para reduzir cadência ruim.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {chipCards.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-10">
              <Card className="card-premium-enhanced p-4">
                <p className="text-[11px] text-gray-400 uppercase mb-1.5">Execuções recentes</p>
                <p className="text-lg font-semibold text-cyan-400">{summary?.recentJobsCount ?? 0}</p>
              </Card>
              <Card className="card-premium-enhanced p-4">
                <p className="text-[11px] text-gray-400 uppercase mb-1.5">Execuções com falha</p>
                <p className="text-lg font-semibold text-yellow-400">{summary?.failedJobsCount ?? 0}</p>
              </Card>
              <Card className="card-premium-enhanced p-4">
                <p className="text-[11px] text-gray-400 uppercase mb-1.5">Tentativas falhadas</p>
                <p className="text-lg font-semibold text-red-400">{recentFailedAttempts.length}</p>
              </Card>
              <Card className="card-premium-enhanced p-4">
                <p className="text-[11px] text-gray-400 uppercase mb-1.5">Pulados por proteção</p>
                <p className="text-lg font-semibold text-yellow-300">{summary?.skippedAttemptsCount ?? 0}</p>
              </Card>
            </div>
          )}

          {chipCards.length > 0 && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-10">
              <Card className="card-premium-enhanced p-5 xl:col-span-1">
                <h2 className="section-title-soft">Painel operacional</h2>
                <div className="ops-glance-grid">
                  <div className="ops-glance-card-soft">
                    <p className="ops-glance-title">Maturação normal número</p>
                    <p className="ops-glance-copy">
                      Intervalo mínimo {operationalRules?.maturation?.normal?.number?.cooldownMinutes ?? 0} min •{" "}
                      {operationalRules?.maturation?.normal?.number?.maxPerHour ?? 0}/h •{" "}
                      {operationalRules?.maturation?.normal?.number?.maxPerDay ?? 0}/dia
                    </p>
                  </div>
                  <div className="ops-glance-card-soft">
                    <p className="ops-glance-title">Maturação normal grupo</p>
                    <p className="ops-glance-copy">
                      Intervalo mínimo {operationalRules?.maturation?.normal?.group?.cooldownMinutes ?? 0} min •{" "}
                      {operationalRules?.maturation?.normal?.group?.maxPerHour ?? 0}/h •{" "}
                      {operationalRules?.maturation?.normal?.group?.maxPerDay ?? 0}/dia
                    </p>
                  </div>
                  <div className="ops-glance-card-soft">
                    <p className="ops-glance-title">Leitura rápida</p>
                    <p className="ops-glance-copy">
                      Use `Operação` para ajustar a cadência de maturação e `Logs` para inspecionar comportamento por chip.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="card-premium-enhanced p-5 xl:col-span-1">
                <h2 className="section-title-soft">Hotspots de chip</h2>
                <div className="space-y-3">
                  {chipOperationalHotspots.length === 0 && (
                    <p className="text-sm text-gray-400">Nenhum chip com pressão operacional relevante.</p>
                  )}
                  {chipOperationalHotspots.map((item) => (
                    <div key={item.chipId} className="surface-item-compact">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{item.chipName}</p>
                        <Badge variant="outline">{item.skippedCount + item.failedCount} eventos</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                        <div>
                          <p className="text-gray-400">Pulados</p>
                          <p className="text-yellow-300 font-semibold">{item.skippedCount}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Falhas</p>
                          <p className="text-red-400 font-semibold">{item.failedCount}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="card-premium-enhanced p-5 xl:col-span-1">
                <h2 className="section-title-soft">Targets quentes</h2>
                <div className="space-y-3">
                  {targetOperationalHotspots.length === 0 && (
                    <p className="text-sm text-gray-400">Nenhum target em destaque por bloqueio recente.</p>
                  )}
                  {targetOperationalHotspots.map((item, index) => (
                    <div key={`${item.targetType}:${item.targetValue}:${index}`} className="surface-item-compact">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white break-all">{item.targetValue}</p>
                        <Badge variant="outline">{item.skippedCount} pulos</Badge>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{item.targetType}</p>
                      <p className="text-xs text-yellow-300 mt-3 break-all">{item.lastReason}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* Chips Grid - 3D Layout */}
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-400 animate-pulse">INICIALIZANDO SISTEMA...</p>
            </div>
          ) : chipCards.length === 0 ? (
            <div className="card-premium-enhanced text-center py-16">
              <Zap className="w-16 h-16 mx-auto mb-4 text-gray-500" />
              <p className="text-gray-300 text-lg mb-4 font-semibold">NENHUM CHIP CONECTADO</p>
              <p className="text-cyan-400 text-sm mb-6">ESCANEIE O QR CODE PARA INICIAR A SEQUÊNCIA DE MATURAÇÃO</p>
              <Button
                className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-black font-bold"
                onClick={() => setLocation("/connect-chip")}
              >
                <Plus className="w-4 h-4 mr-2" />
                Conectar Chip
              </Button>
            </div>
          ) : (
            <div className="grid-3d mb-12">
              {chipCards.map((chip: ChipCard) => (
                <Card
                  key={chip.id}
                  className="card-premium-enhanced card-3d p-6 hover:animate-glow-pulse cursor-pointer transition-all duration-300 group"
                >
                  <div className="chip-card">
                    <div className="chip-card-header">
                      <div className="chip-card-title-wrap">
                        <h3 className="chip-card-title">{chip.chipName}</h3>
                        {chip.phoneNumber ? <p className="chip-card-phone">{chip.phoneNumber}</p> : null}
                        <div className="chip-card-pills">
                          <span className="chip-card-pill chip-card-pill-neutral capitalize">{chip.maturationProfile}</span>
                          <span className={`chip-card-pill ${chip.isPaused ? "chip-card-pill-warning" : "chip-card-pill-success"}`}>
                            {chip.isPaused ? "Pausado" : "Ativo"}
                          </span>
                          <span className={`chip-card-pill ${chip.certificationUsable ? "chip-card-pill-success" : "chip-card-pill-neutral"}`}>
                            {chip.certificationStatus || "NOVO"}
                          </span>
                        </div>
                      </div>

                      <div className="chip-card-status">
                        <div
                          className={`chip-card-status-dot ${
                            chip.status === "conectado"
                              ? "bg-green-400 animate-pulse"
                              : chip.status === "maturando"
                                ? "bg-yellow-400 animate-pulse"
                                : "bg-red-400"
                          }`}
                        />
                        <span className={`text-sm font-semibold ${getStatusColor(chip.status)}`}>{getStatusLabel(chip.status)}</span>
                      </div>
                    </div>

                    <div className="chip-card-meta-grid">
                      <div className="chip-card-metric">
                        <p className="chip-card-metric-label">Health</p>
                        <p className="chip-card-metric-value text-cyan-300">{chip.healthScore || 0}</p>
                      </div>
                      <div className="chip-card-metric">
                        <p className="chip-card-metric-label">Human</p>
                        <p className="chip-card-metric-value text-green-300">{chip.humanScore || 0}</p>
                      </div>
                      <div className="chip-card-metric">
                        <p className="chip-card-metric-label">Risk</p>
                        <p className={`chip-card-metric-value ${(chip.riskScore || 0) >= 50 ? "text-rose-300" : "text-slate-200"}`}>{chip.riskScore || 0}</p>
                      </div>
                      <div className="chip-card-metric">
                        <p className="chip-card-metric-label">Conectado</p>
                        <p className="chip-card-metric-value">{chip.connectedMinutes || 0} min</p>
                      </div>
                    </div>

                    <div className="chip-card-insights">
                      <div className="surface-item-compact chip-card-activity">
                        <div className="flex justify-between items-center gap-4">
                          <span className="text-sm text-gray-400">Última atividade</span>
                          <span className="text-gray-200 font-semibold text-xs">{formatRelativeTime(chip.lastActivity)}</span>
                        </div>
                        {chip.lastAction ? <p className="chip-card-activity-copy">{chip.lastAction}</p> : null}
                      </div>

                      <div className="surface-item-compact chip-card-activity">
                        <div className="flex justify-between items-center gap-4">
                          <span className="text-sm text-gray-400">Fase atual</span>
                          <span className={`font-semibold text-xs ${getCertificationColor(chip.certificationStatus)}`}>
                            {chip.certificationStatus || "NOVO"}
                          </span>
                        </div>
                        <p className="chip-card-activity-copy">
                          {formatTimeInPhase(chip.phaseStartedAt)} • {chip.lastEventType ? actionLabels[chip.lastEventType] || chip.lastEventType : "sem evento suficiente"}
                        </p>
                        {chip.certificationReason ? (
                          <p className="text-[11px] text-gray-500 mt-2 leading-5">{chip.certificationReason}</p>
                        ) : null}
                      </div>

                      <div className="surface-item-compact chip-card-activity">
                        <div className="flex justify-between items-center gap-4">
                          <span className="text-sm text-gray-400">Rotina passiva</span>
                          <span className="text-xs font-semibold text-emerald-300">
                            {chip.nextScheduledAt ? formatFutureTime(chip.nextScheduledAt) : "sem agenda"}
                          </span>
                        </div>
                        <p className="chip-card-activity-copy">
                          Última: {chip.lastPassiveAction ? actionLabels[chip.lastPassiveAction] || chip.lastPassiveAction : "sem execução"}{" "}
                          {chip.lastPassiveActionAt ? `• ${formatRelativeTime(chip.lastPassiveActionAt)}` : ""}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-2 leading-5">
                          Próxima: {chip.nextScheduledAction ? actionLabels[chip.nextScheduledAction] || chip.nextScheduledAction : "sem próxima ação"}
                        </p>
                      </div>

                      <div className="chip-card-progress">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-gray-400 uppercase tracking-[0.08em]">Maturação</span>
                          <span className="text-xs font-bold text-cyan-300">{chip.maturationProgress || 0}%</span>
                        </div>
                        <div className="chip-card-progress-track">
                          <div
                            className="chip-card-progress-fill"
                            style={{ width: `${chip.maturationProgress || 0}%` }}
                          />
                        </div>
                      </div>

                      <div className="chip-card-meta-grid">
                        <div className="chip-card-metric">
                          <p className="chip-card-metric-label">Envio/recebe</p>
                          <p className="chip-card-metric-value text-cyan-200">
                            {chip.timelineSentCount || 0}/{chip.timelineReceivedCount || 0}
                          </p>
                        </div>
                        <div className="chip-card-metric">
                          <p className="chip-card-metric-label">Conversas</p>
                          <p className="chip-card-metric-value">{chip.distinctConversations || 0}</p>
                        </div>
                        <div className="chip-card-metric">
                          <p className="chip-card-metric-label">Grupos</p>
                          <p className="chip-card-metric-value">{chip.groupsJoined || 0}</p>
                        </div>
                        <div className="chip-card-metric">
                          <p className="chip-card-metric-label">Ativo/parado</p>
                          <p className="chip-card-metric-value">
                            {chip.activeMinutes || 0}/{chip.idleMinutes || 0}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="chip-card-actionbar">
                      <button
                        className="chip-action-button chip-action-logs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/logs?chipId=${chip.id}`);
                        }}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Logs
                      </button>
                      <button
                        className="chip-action-button chip-action-dispatch"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/bulk-dispatch?chipId=${chip.id}`);
                        }}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Disparar
                      </button>
                      <button
                        className="chip-action-button chip-action-pause"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleTogglePaused(chip);
                        }}
                        disabled={busyChipId === chip.id}
                      >
                        {chip.isPaused ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                        {chip.isPaused ? "Retomar" : "Pausar"}
                      </button>
                      <button
                        className="chip-action-button chip-action-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRemoveChip(chip);
                        }}
                        disabled={busyChipId === chip.id}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover
                      </button>
                    </div>
                  </div>
                </Card>
              ))}

              {/* Add New Chip Card */}
              <Card
                className="card-premium-enhanced p-6 flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-white/10 hover:border-cyan-400/30 cursor-pointer transition-all group"
                onClick={() => setLocation("/connect-chip")}
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-slate-950/60 border border-white/10 text-cyan-300 text-4xl group-hover:scale-105 transition-transform">+</div>
                <h3 className="text-lg font-bold text-white mb-2">Adicionar Novo Chip</h3>
                <p className="text-sm text-gray-400 text-center max-w-xs">
                  Clique para conectar um novo chip via QR Code
                </p>
              </Card>
            </div>
          )}

          {/* Activity Log */}
          {chipCards.length > 0 && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-10">
              <Card className="card-premium-enhanced p-5">
                <h2 className="section-title-muted">Execuções recentes</h2>
                <div className="space-y-4">
                  {recentExecutionJobs.length === 0 && (
                    <p className="text-sm text-gray-400">Ainda não há execuções suficientes para exibir aqui.</p>
                  )}
                  {recentExecutionJobs.map((job) => (
                    <div key={job.id} className="surface-item">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {job.chipName} • {job.executionType} • Execução #{job.id}
                          </p>
                          <p className="text-xs text-gray-400">
                            Perfil {job.profileName} • {job.totalMessagesSent}/{job.plannedMessages} mensagens •{" "}
                            {formatRelativeTime(job.createdAt)}
                          </p>
                        </div>
                        <span className={`rounded-md px-2 py-1 text-[11px] font-semibold border ${
                          job.status === "completed"
                            ? "text-green-300 border-green-400/20 bg-green-500/10"
                            : job.status === "failed"
                              ? "text-red-300 border-red-400/20 bg-red-500/10"
                              : job.status === "partial"
                                ? "text-yellow-300 border-yellow-400/20 bg-yellow-500/10"
                                : "text-cyan-300 border-cyan-400/20 bg-cyan-500/10"
                        }`}>
                          {getJobStatusLabel(job.status)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                        <div>
                          <p className="text-gray-400">Sucessos</p>
                          <p className="text-green-400 font-bold">{job.successCount}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Falhas</p>
                          <p className="text-red-400 font-bold">{job.failureCount}</p>
                        </div>
                      </div>
                      {job.errorMessage && (
                        <p className="text-xs text-red-400 mt-3 break-all">{job.errorMessage}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="card-premium-enhanced p-5">
                <h2 className="section-title-muted">Falhas reais</h2>
                <div className="space-y-4">
                  {recentFailedAttempts.length === 0 && (
                    <p className="text-sm text-gray-400">Nenhuma tentativa falhada recente.</p>
                  )}
                  {recentFailedAttempts.map((attempt) => (
                    <div key={attempt.id} className="surface-item">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {attempt.chipName} • {attempt.actionType} • Execução #{attempt.jobId}
                          </p>
                          <p className="text-xs text-gray-400">
                            {attempt.targetType} • {attempt.targetValue} • {formatRelativeTime(attempt.createdAt)}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-red-400">falhou</span>
                      </div>
                      {attempt.errorMessage && (
                        <p className="text-xs text-red-400 mt-3 break-all">{attempt.errorMessage}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {chipCards.length > 0 && (
            <Card className="card-premium-enhanced p-5 mb-10">
              <h2 className="section-title-soft">Pulados por proteção</h2>
              <div className="space-y-4">
                {recentSkippedAttempts.length === 0 && (
                  <p className="text-sm text-gray-400">Nenhum target foi pulado recentemente por regra operacional.</p>
                )}
                {recentSkippedAttempts.map((attempt) => (
                  <div key={attempt.id} className="surface-item">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {attempt.chipName} • {attempt.targetType} • Execução #{attempt.jobId}
                        </p>
                        <p className="text-xs text-gray-400 break-all">
                          {attempt.targetValue} • {formatRelativeTime(attempt.createdAt)}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-yellow-300">pulado</span>
                    </div>
                    <p className="text-xs text-yellow-300 mt-3 break-all">{attempt.reason}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {chipCards.length > 0 && (
            <Card className="card-premium-enhanced p-5">
              <h2 className="section-title-muted">Atividade recente</h2>
              <div className="space-y-4">
                {recentActivity.length === 0 && (
                  <p className="text-sm text-gray-400">Ainda não há atividade suficiente para exibir aqui.</p>
                )}
                {recentActivity.map((log) => (
                  <div key={log.id} className="surface-item flex items-center gap-4">
                    <div className={`w-1.5 h-1.5 rounded-full ${log.status === "failed" ? "bg-red-400" : log.status === "pending" ? "bg-yellow-400" : "bg-cyan-400"}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">
                        {log.chipName} • {actionLabels[log.actionType] || log.actionType}
                      </p>
                      <p className="text-xs text-gray-400">
                        {log.description} • {formatRelativeTime(log.createdAt)}
                      </p>
                    </div>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold border ${
                      log.status === "success"
                        ? "text-green-300 border-green-400/20 bg-green-500/10"
                        : log.status === "failed"
                          ? "text-red-300 border-red-400/20 bg-red-500/10"
                          : "text-yellow-300 border-yellow-400/20 bg-yellow-500/10"
                    }`}>
                      {log.status === "success" ? "ok" : log.status === "failed" ? "falha" : "pend"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/5 mt-16 py-4 backdrop-blur-custom">
          <div className="container mx-auto text-center text-gray-400 text-xs">
            <p>SYSTEM STATUS: OPERATIONAL | UPTIME: 24/7 | VERSION: 1.0.0</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
