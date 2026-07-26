import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Activity, AlertTriangle, ArrowLeft, Cpu, Play, RefreshCw, ServerCog, ShieldAlert, Waves } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast as sonnerToast } from "sonner";
import { useLocation } from "wouter";

function formatRelativeTime(value?: string | null) {
  if (!value) return "sem registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sem registro";
  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return "agora";
  if (diffMinutes < 60) return `${diffMinutes} min atrás`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h atrás`;
  return `${Math.floor(diffHours / 24)}d atrás`;
}

function formatPercent(value?: number | null) {
  if (value == null) return "N/D";
  return `${Math.round(value)}%`;
}

export default function RuntimeConsole() {
  const { isAuthenticated, loading } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "/login",
  });
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: overview, isLoading, refetch, isFetching } = trpc.runtime.getOverview.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 15000,
  });

  const [selectedChipId, setSelectedChipId] = useState<number | null>(null);
  const { data: selectedChip, isFetching: isFetchingChip } = trpc.runtime.getChipConsole.useQuery(
    { chipId: selectedChipId ?? 0 },
    {
      enabled: isAuthenticated && selectedChipId != null,
    }
  );

  const updateFeatureFlagsMutation = trpc.runtime.updateFeatureFlags.useMutation();
  const updateSupervisorMutation = trpc.runtime.updateSupervisorConfig.useMutation();
  const triggerShadowCycleMutation = trpc.runtime.triggerShadowCycle.useMutation();
  const restartServicesMutation = trpc.runtime.restartServices.useMutation();

  const [flagsForm, setFlagsForm] = useState<any>(null);
  const [supervisorForm, setSupervisorForm] = useState<any>(null);

  useEffect(() => {
    if (!overview) return;
    setFlagsForm(overview.control.featureFlags);
    setSupervisorForm(overview.control.supervisor);
    if (selectedChipId == null && overview.chips.length > 0) {
      setSelectedChipId(overview.chips[0].chipId);
    }
  }, [overview, selectedChipId]);

  const runtimeSummary = useMemo(() => {
    if (!overview) return null;
    return [
      { label: "Chips conectados", value: overview.summary.connectedChips, icon: Activity },
      { label: "Snapshots ativos", value: overview.summary.chipsWithSnapshots, icon: Waves },
      { label: "Fleet ativo", value: overview.summary.chipsWithFleetLearning, icon: Cpu },
      { label: "Alertas críticos", value: overview.summary.criticalAlerts, icon: ShieldAlert },
    ];
  }, [overview]);

  const handleSaveFlags = async () => {
    if (!flagsForm) return;
    try {
      await updateFeatureFlagsMutation.mutateAsync(flagsForm);
      await utils.runtime.getOverview.invalidate();
      sonnerToast.success("Feature flags atualizadas.");
    } catch (error: any) {
      sonnerToast.error(error?.message || "Falha ao atualizar flags.");
    }
  };

  const handleSaveSupervisor = async () => {
    if (!supervisorForm) return;
    try {
      await updateSupervisorMutation.mutateAsync({
        ...supervisorForm,
        shadowWindowHours: Number(supervisorForm.shadowWindowHours),
        schedulerLookaheadHours: Number(supervisorForm.schedulerLookaheadHours),
        maxRetryAttempts: Number(supervisorForm.maxRetryAttempts),
        retryBackoffSeconds: Number(supervisorForm.retryBackoffSeconds),
        alertHealthThreshold: Number(supervisorForm.alertHealthThreshold),
        alertCoverageThreshold: Number(supervisorForm.alertCoverageThreshold),
        alertIdentityDriftThreshold: Number(supervisorForm.alertIdentityDriftThreshold),
        alertSnapshotMaxAgeMinutes: Number(supervisorForm.alertSnapshotMaxAgeMinutes),
      });
      await utils.runtime.getOverview.invalidate();
      sonnerToast.success("Configuração do runtime atualizada.");
    } catch (error: any) {
      sonnerToast.error(error?.message || "Falha ao atualizar configuração.");
    }
  };

  const handleTriggerShadow = async () => {
    try {
      await triggerShadowCycleMutation.mutateAsync({
        windowHours: Number(supervisorForm?.shadowWindowHours ?? 48),
      });
      await utils.runtime.getOverview.invalidate();
      if (selectedChipId != null) {
        await utils.runtime.getChipConsole.invalidate({ chipId: selectedChipId });
      }
      sonnerToast.success("Ciclo manual de Shadow Mode executado.");
    } catch (error: any) {
      sonnerToast.error(error?.message || "Falha ao rodar Shadow Mode.");
    }
  };

  const handleRestartServices = async () => {
    try {
      await restartServicesMutation.mutateAsync();
      await utils.runtime.getOverview.invalidate();
      sonnerToast.success("Serviços de runtime reinicializados.");
    } catch (error: any) {
      sonnerToast.error(error?.message || "Falha ao reiniciar runtime.");
    }
  };

  if (loading || isLoading) {
    return (
      <div className="app-shell bg-app-grid flex items-center justify-center">
        <Card className="card-premium-enhanced p-8 text-center">
          <p className="text-cyan-400 font-semibold">Carregando runtime...</p>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated || !overview) return null;

  return (
    <div className="app-shell bg-app-grid">
      <div className="page-container">
        <div className="page-hero md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="page-title mb-2">RUNTIME SUPERVISOR</h1>
            <p className="page-subtitle">
              Produção em Shadow Mode: sessões reais, memória, identidade, experiência, fleet learning e alertas operacionais.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="subtle-action" onClick={() => setLocation("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao painel
            </Button>
            <Button variant="outline" className="subtle-action" onClick={() => refetch()}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button className="btn-primary-modern action-operations" onClick={handleTriggerShadow}>
              <Play className="w-4 h-4 mr-2" />
              Rodar Shadow
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {runtimeSummary?.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="card-premium-enhanced p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-400">{item.label}</p>
                  <Icon className="w-4 h-4 text-cyan-300" />
                </div>
                <p className="text-3xl font-semibold text-white">{item.value}</p>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6 mb-6">
          <Card className="card-premium-enhanced p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="section-title mb-1">Estado operacional</h2>
                <p className="section-subtitle">Visão única de chips, filas, snapshots, fleet e saúde geral.</p>
              </div>
              <Badge variant="outline">{overview.generatedAt ? `gerado ${formatRelativeTime(overview.generatedAt)}` : "agora"}</Badge>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="surface-item-compact">
                <p className="text-xs text-gray-400 uppercase mb-1">Jobs pendentes</p>
                <p className="text-white text-xl font-semibold">{overview.summary.pendingJobs}</p>
              </div>
              <div className="surface-item-compact">
                <p className="text-xs text-gray-400 uppercase mb-1">Falhas recentes</p>
                <p className="text-white text-xl font-semibold">{overview.summary.failedAttemptsLastWindow}</p>
              </div>
              <div className="surface-item-compact">
                <p className="text-xs text-gray-400 uppercase mb-1">Agendamentos</p>
                <p className="text-white text-xl font-semibold">{overview.summary.scheduledTasksActive}</p>
              </div>
              <div className="surface-item-compact">
                <p className="text-xs text-gray-400 uppercase mb-1">Warnings</p>
                <p className="text-white text-xl font-semibold">{overview.summary.warningAlerts}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-5">
              <div className="surface-item-compact">
                <p className="text-xs text-gray-400 uppercase mb-1">Uptime</p>
                <p className="text-white font-semibold">{overview.infra.uptimeSeconds}s</p>
              </div>
              <div className="surface-item-compact">
                <p className="text-xs text-gray-400 uppercase mb-1">RSS</p>
                <p className="text-white font-semibold">{overview.infra.rssMb} MB</p>
              </div>
              <div className="surface-item-compact">
                <p className="text-xs text-gray-400 uppercase mb-1">Heap usado</p>
                <p className="text-white font-semibold">{overview.infra.heapUsedMb} MB</p>
              </div>
              <div className="surface-item-compact">
                <p className="text-xs text-gray-400 uppercase mb-1">Heap total</p>
                <p className="text-white font-semibold">{overview.infra.heapTotalMb} MB</p>
              </div>
              <div className="surface-item-compact">
                <p className="text-xs text-gray-400 uppercase mb-1">CPU</p>
                <p className="text-white font-semibold">{overview.infra.cpuLoad ?? 0} ms</p>
              </div>
            </div>
          </Card>

          <Card className="card-premium-enhanced p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="section-title mb-1">Alertas</h2>
                <p className="section-subtitle">Prioridade imediata para operação real.</p>
              </div>
              <AlertTriangle className="w-5 h-5 text-amber-300" />
            </div>

            <div className="space-y-3 max-h-[380px] overflow-auto pr-1">
              {overview.alerts.length === 0 ? (
                <div className="surface-item-compact">
                  <p className="text-sm text-emerald-300 font-medium">Nenhum alerta crítico no momento.</p>
                </div>
              ) : (
                overview.alerts.slice(0, 10).map((alert) => (
                  <div key={`${alert.chipId}-${alert.type}-${alert.observedAt}`} className="surface-item-compact">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-white font-medium">{alert.chipName}</p>
                      <Badge variant={alert.severity === "critical" ? "destructive" : "outline"}>{alert.severity}</Badge>
                    </div>
                    <p className="text-sm text-gray-200 mt-2">{alert.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{alert.detail}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          <Card className="card-premium-enhanced p-6">
            <h2 className="section-title mb-4">Scheduler</h2>
            <div className="space-y-3 max-h-[340px] overflow-auto pr-1">
              {overview.schedules.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum agendamento ativo cadastrado.</p>
              ) : (
                overview.schedules.slice(0, 12).map((task) => (
                  <div key={task.id} className="surface-item-compact">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-white font-medium">{task.taskName}</p>
                        <p className="text-xs text-gray-400 mt-1">{task.chipName}</p>
                      </div>
                      <Badge variant={task.isActive ? "secondary" : "outline"}>
                        {task.isActive ? "ativo" : "inativo"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase">Agenda</p>
                        <p className="text-sm text-gray-200">{task.scheduleLabel}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase">Target</p>
                        <p className="text-sm text-gray-200">{task.targetType}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase">Intervalo</p>
                        <p className="text-sm text-gray-200">{task.intervalSeconds}s</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="card-premium-enhanced p-6">
            <h2 className="section-title mb-4">Fila recente</h2>
            <div className="space-y-3 max-h-[340px] overflow-auto pr-1">
              {overview.recentJobs.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum job recente encontrado.</p>
              ) : (
                overview.recentJobs.map((job) => (
                  <div key={job.id} className="surface-item-compact">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-white font-medium">{job.chipName}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {job.executionType} • {formatRelativeTime(job.createdAt)}
                        </p>
                      </div>
                      <Badge variant={job.status === "failed" ? "destructive" : job.status === "running" ? "secondary" : "outline"}>
                        {job.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase">Planejadas</p>
                        <p className="text-sm text-gray-200">{job.plannedMessages}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase">Enviadas</p>
                        <p className="text-sm text-gray-200">{job.totalMessagesSent}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase">Falhas</p>
                        <p className="text-sm text-gray-200">{job.failureCount}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[0.85fr_1.15fr] gap-6 mb-6">
          <Card className="card-premium-enhanced p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="section-title mb-1">Feature flags</h2>
                <p className="section-subtitle">Liga e desliga capacidades operacionais sem deploy.</p>
              </div>
              <ServerCog className="w-5 h-5 text-cyan-300" />
            </div>

            <div className="space-y-4">
              {flagsForm &&
                Object.entries(flagsForm).map(([key, value]) => (
                  <div key={key} className="surface-item-compact flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-white font-medium">{key}</p>
                    </div>
                    <Switch
                      checked={Boolean(value)}
                      onCheckedChange={(checked) => setFlagsForm((current: any) => ({ ...current, [key]: checked }))}
                    />
                  </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-3 mt-5">
              <Button className="btn-primary-modern action-save" onClick={handleSaveFlags}>
                Salvar flags
              </Button>
              <Button variant="outline" className="subtle-action" onClick={handleRestartServices}>
                Reiniciar runtime
              </Button>
            </div>
          </Card>

          <Card className="card-premium-enhanced p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="section-title mb-1">Supervisor</h2>
                <p className="section-subtitle">Thresholds e parâmetros operacionais centrais.</p>
              </div>
              <Cpu className="w-5 h-5 text-cyan-300" />
            </div>

            {supervisorForm && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  ["shadowWindowHours", "Janela shadow (h)"],
                  ["schedulerLookaheadHours", "Lookahead scheduler (h)"],
                  ["maxRetryAttempts", "Máx. retries"],
                  ["retryBackoffSeconds", "Backoff retry (s)"],
                  ["alertHealthThreshold", "Threshold health"],
                  ["alertCoverageThreshold", "Threshold coverage"],
                  ["alertIdentityDriftThreshold", "Threshold drift"],
                  ["alertSnapshotMaxAgeMinutes", "Snapshot máximo (min)"],
                ].map(([key, label]) => (
                  <div key={key}>
                    <Label>{label}</Label>
                    <Input
                      type="number"
                      value={supervisorForm[key]}
                      onChange={(e) => setSupervisorForm((current: any) => ({ ...current, [key]: e.target.value }))}
                      className="field-control"
                    />
                  </div>
                ))}

                {[
                  ["autoRestoreSessions", "Auto restore sessões"],
                  ["autoStartPassiveEngine", "Auto start passive engine"],
                  ["autoEnsureHeartbeats", "Auto ensure heartbeats"],
                ].map(([key, label]) => (
                  <div key={key} className="surface-item-compact flex items-center justify-between md:col-span-2">
                    <p className="text-sm text-white font-medium">{label}</p>
                    <Switch
                      checked={Boolean(supervisorForm[key])}
                      onCheckedChange={(checked) => setSupervisorForm((current: any) => ({ ...current, [key]: checked }))}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-3 mt-5">
              <Button className="btn-primary-modern action-save" onClick={handleSaveSupervisor}>
                Salvar supervisor
              </Button>
              <a
                href="/api/runtime/metrics"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-200 hover:bg-white/5"
              >
                Abrir Metrics API
              </a>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
          <Card className="card-premium-enhanced p-6">
            <h2 className="section-title mb-4">Console dos chips</h2>
            <div className="space-y-3 max-h-[720px] overflow-auto pr-1">
              {overview.chips.map((chip) => (
                <button
                  key={chip.chipId}
                  onClick={() => setSelectedChipId(chip.chipId)}
                  className={`w-full text-left surface-item transition ${
                    selectedChipId === chip.chipId ? "ring-1 ring-cyan-400/30 bg-cyan-500/5" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-white font-semibold">{chip.chipName}</p>
                      <p className="text-xs text-gray-400 mt-1">{chip.phoneNumber || "sem número sincronizado"}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      <Badge variant={chip.health.connected ? "secondary" : "destructive"}>
                        {chip.health.connected ? "online" : "offline"}
                      </Badge>
                      {chip.isPaused ? <Badge variant="outline">pausado</Badge> : null}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div>
                      <p className="text-xs text-gray-400 uppercase">Health</p>
                      <p className="text-white font-medium">{chip.health.healthScore}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase">Coverage</p>
                      <p className="text-white font-medium">{formatPercent(chip.memory.evidenceCoverage)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase">Snapshot</p>
                      <p className="text-white font-medium">
                        {chip.memory.snapshotAgeMinutes == null ? "ausente" : `${chip.memory.snapshotAgeMinutes} min`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase">Alertas</p>
                      <p className="text-white font-medium">{chip.alerts.length}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="card-premium-enhanced p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="section-title mb-1">Chip selecionado</h2>
                <p className="section-subtitle">Chip → Memory → Identity → Experience → Fleet → Health → Alerts</p>
              </div>
              {isFetchingChip ? <RefreshCw className="w-4 h-4 animate-spin text-cyan-300" /> : null}
            </div>

            {!selectedChip ? (
              <p className="text-sm text-gray-400">Selecione um chip para abrir o console operacional.</p>
            ) : (
              <div className="space-y-5">
                <div className="surface-item">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-white font-semibold">{selectedChip.chipName}</p>
                      <p className="text-xs text-gray-400 mt-1">{selectedChip.phoneNumber || "sem número"}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={selectedChip.health.connected ? "secondary" : "destructive"}>
                        {selectedChip.health.connected ? "conectado" : "desconectado"}
                      </Badge>
                      <Badge variant="outline">{selectedChip.status}</Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="surface-item-compact">
                    <p className="text-xs text-gray-400 uppercase mb-2">Memory</p>
                    <p className="text-sm text-gray-200">Fonte: {selectedChip.memory.source}</p>
                    <p className="text-sm text-gray-200">Pipeline health: {formatPercent(selectedChip.memory.pipelineHealthScore)}</p>
                    <p className="text-sm text-gray-200">Coverage: {formatPercent(selectedChip.memory.evidenceCoverage)}</p>
                    <p className="text-sm text-gray-200">Confidence: {formatPercent(selectedChip.memory.averageConfidence)}</p>
                  </div>
                  <div className="surface-item-compact">
                    <p className="text-xs text-gray-400 uppercase mb-2">Identity</p>
                    <p className="text-sm text-gray-200">Confidence: {formatPercent(selectedChip.identity.confidence)}</p>
                    <p className="text-sm text-gray-200">Maturity: {formatPercent(selectedChip.identity.maturityScore)}</p>
                    <p className="text-sm text-gray-200">Stability: {formatPercent(selectedChip.identity.stability)}</p>
                    <p className="text-sm text-gray-200">Drift: {selectedChip.identity.drift ?? "N/D"}</p>
                  </div>
                  <div className="surface-item-compact">
                    <p className="text-xs text-gray-400 uppercase mb-2">Experience</p>
                    <p className="text-sm text-gray-200">Stage: {selectedChip.experience.journalStage || "N/D"}</p>
                    <p className="text-sm text-gray-200">Trust: {selectedChip.experience.trustLevel ?? "N/D"}</p>
                    <p className="text-sm text-gray-200">Relações: {selectedChip.experience.relationshipCount}</p>
                    <p className="text-sm text-gray-200">Experiências similares: {selectedChip.experience.experienceCount}</p>
                  </div>
                  <div className="surface-item-compact">
                    <p className="text-xs text-gray-400 uppercase mb-2">Fleet</p>
                    <p className="text-sm text-gray-200">Percentil: {selectedChip.fleet.percentile ?? "N/D"}</p>
                    <p className="text-sm text-gray-200">Rank: {selectedChip.fleet.rank ?? "N/D"}</p>
                    <p className="text-sm text-gray-200">Melhor coorte: {selectedChip.fleet.bestCohortKey || "N/D"}</p>
                    <div className="mt-2 space-y-1">
                      {selectedChip.fleet.recommendations.length === 0 ? (
                        <p className="text-xs text-gray-500">Sem recomendação de frota ainda.</p>
                      ) : (
                        selectedChip.fleet.recommendations.map((item) => (
                          <p key={item.label} className="text-xs text-cyan-200">
                            {item.label} • {Math.round(item.confidence)}%
                          </p>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="surface-item-compact">
                    <p className="text-xs text-gray-400 uppercase mb-2">Health</p>
                    <p className="text-sm text-gray-200">Score: {selectedChip.health.healthScore}</p>
                    <p className="text-sm text-gray-200">Socket: {selectedChip.health.socketState}</p>
                    <p className="text-sm text-gray-200">Pendências: {selectedChip.runtime.pendingJobs}</p>
                    <p className="text-sm text-gray-200">Última atividade: {formatRelativeTime(selectedChip.runtime.lastActivityAt)}</p>
                  </div>
                  <div className="surface-item-compact">
                    <p className="text-xs text-gray-400 uppercase mb-2">Socket</p>
                    <p className="text-sm text-gray-200">State: {selectedChip.socket.connectionState}</p>
                    <p className="text-sm text-gray-200">WS: {selectedChip.socket.wsReadyStateLabel}</p>
                    <p className="text-sm text-gray-200">Último receive: {formatRelativeTime(selectedChip.socket.lastReceiveAt)}</p>
                    <p className="text-sm text-gray-200">Último reconnect: {formatRelativeTime(selectedChip.socket.lastReconnectAt)}</p>
                  </div>
                </div>

                <div className="surface-item">
                  <p className="text-xs text-gray-400 uppercase mb-3">Alertas deste chip</p>
                  {selectedChip.alerts.length === 0 ? (
                    <p className="text-sm text-emerald-300">Nenhum alerta ativo para este chip.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedChip.alerts.map((alert) => (
                        <div key={`${alert.type}-${alert.observedAt}`} className="surface-item-compact">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm text-white font-medium">{alert.title}</p>
                            <Badge variant={alert.severity === "critical" ? "destructive" : "outline"}>{alert.severity}</Badge>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{alert.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
