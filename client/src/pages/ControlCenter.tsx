import { useAuth } from "@/_core/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Cpu,
  History,
  Lock,
  PauseCircle,
  Play,
  RefreshCw,
  Settings,
  Shield,
  TriangleAlert,
  Upload,
  Waves,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast as sonnerToast } from "sonner";
import { useLocation } from "wouter";

const controlCenterTabs = [
  { value: "dashboard", label: "Dashboard", icon: <BarChart3 className="w-4 h-4" /> },
  { value: "fleet", label: "Frota", icon: <History className="w-4 h-4" /> },
  { value: "workers", label: "Workers", icon: <Cpu className="w-4 h-4" /> },
  { value: "reconciliation", label: "Reconciliação", icon: <Waves className="w-4 h-4" /> },
  { value: "admin", label: "Administração", icon: <Settings className="w-4 h-4" /> },
  { value: "security", label: "Segurança", icon: <Lock className="w-4 h-4" /> },
] as const;

const chipDetailTabs = [
  { value: "summary", label: "Resumo" },
  { value: "timeline", label: "Linha do tempo" },
  { value: "replay", label: "Replay" },
  { value: "audit", label: "Auditoria" },
] as const;

type ControlCenterSection = "dashboard" | "fleet" | "chip" | "workers" | "reconciliation" | "admin" | "security";

type ConfirmAction = {
  title: string;
  description: string;
  confirmLabel: string;
  action: () => Promise<void>;
};

function parseControlCenterPath(pathname: string): { section: ControlCenterSection; legacyChipId: number | null } {
  if (pathname.startsWith("/control-center/chip/")) {
    const rawId = pathname.split("/control-center/chip/")[1]?.split("/")[0] ?? "";
    const parsed = Number(rawId);
    return { section: "chip", legacyChipId: Number.isInteger(parsed) && parsed > 0 ? parsed : null };
  }

  if (pathname.startsWith("/control-center/fleet")) return { section: "fleet", legacyChipId: null };
  if (pathname.startsWith("/control-center/workers")) return { section: "workers", legacyChipId: null };
  if (pathname.startsWith("/control-center/reconciliation")) return { section: "reconciliation", legacyChipId: null };
  if (pathname.startsWith("/control-center/admin")) return { section: "admin", legacyChipId: null };
  if (pathname.startsWith("/control-center/security")) return { section: "security", legacyChipId: null };

  return { section: "dashboard", legacyChipId: null };
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return "N/D";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/D";
  return date.toLocaleString("pt-BR");
}

function formatRelativeTime(value?: string | Date | null) {
  if (!value) return "N/D";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/D";
  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return "agora";
  if (diffMinutes < 60) return `${diffMinutes} min atrás`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h atrás`;
  return `${Math.floor(diffHours / 24)}d atrás`;
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="overflow-auto rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-gray-200">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function StatMini({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-300"
      : tone === "warning"
        ? "text-amber-300"
        : tone === "danger"
          ? "text-rose-300"
          : "text-white";

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function StatusPanel({
  title,
  status,
  description,
}: {
  title: string;
  status: "ok" | "warning" | "critical";
  description: string;
}) {
  const config =
    status === "ok"
      ? {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-300" />,
          badge: "bg-emerald-500/10 text-emerald-200 border-emerald-400/20",
          label: "Saudável",
        }
      : status === "warning"
        ? {
            icon: <TriangleAlert className="w-5 h-5 text-amber-300" />,
            badge: "bg-amber-500/10 text-amber-200 border-amber-400/20",
            label: "Atenção",
          }
        : {
            icon: <XCircle className="w-5 h-5 text-rose-300" />,
            badge: "bg-rose-500/10 text-rose-200 border-rose-400/20",
            label: "Crítico",
          };

  return (
    <Card className="card-premium-enhanced p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {config.icon}
          <p className="text-sm font-semibold text-white">{title}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs ${config.badge}`}>{config.label}</span>
      </div>
      <p className="text-sm text-gray-300">{description}</p>
    </Card>
  );
}

function getFleetStatusVariant(status: string) {
  if (status === "reconciled") return "secondary";
  if (status === "divergent") return "destructive";
  return "outline";
}

function getHealthStatus(overview: any) {
  if (overview.runtime.summary.criticalAlerts > 0 || overview.reconciliation.divergences_found > 0) {
    return {
      status: "critical" as const,
      description: "Existem alertas críticos ou divergências que exigem investigação imediata.",
    };
  }
  if (overview.runtime.summary.warningAlerts > 0 || overview.runtime.summary.pendingJobs > 0) {
    return {
      status: "warning" as const,
      description: "O sistema está operando, mas há atenção pendente em workers ou alertas operacionais.",
    };
  }
  return {
    status: "ok" as const,
    description: "Sem sinais de criticidade. Replay, projeção e reconciliação permanecem coerentes.",
  };
}

function getWorkersStatus(overview: any) {
  if (overview.runtime.summary.failedAttemptsLastWindow > 0) {
    return {
      status: "warning" as const,
      description: `${overview.runtime.summary.failedAttemptsLastWindow} falhas recentes detectadas em tentativas de execução.`,
    };
  }
  if (overview.runtime.summary.pendingJobs > 0) {
    return {
      status: "warning" as const,
      description: `${overview.runtime.summary.pendingJobs} jobs pendentes aguardando processamento.`,
    };
  }
  return {
    status: "ok" as const,
    description: "Workers sem pendências críticas e sem sinais recentes de fila travada.",
  };
}

function getReconciliationStatus(overview: any) {
  if (overview.reconciliation.divergences_found > 0) {
    return {
      status: "warning" as const,
      description: `${overview.reconciliation.divergences_found} divergências ainda exigem atenção na reconciliação.`,
    };
  }
  return {
    status: "ok" as const,
    description: "Frota reconciliada sem divergências abertas entre legado, stream oficial, projeção e replay.",
  };
}

export default function ControlCenter() {
  const { isAuthenticated, loading } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "/login",
  });
  const [location, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const route = useMemo(() => parseControlCenterPath(location), [location]);

  const [selectedLegacyChipId, setSelectedLegacyChipId] = useState<number | null>(null);
  const [chipDetailTab, setChipDetailTab] = useState("summary");
  const [userIdInput, setUserIdInput] = useState("");
  const [batchChipIds, setBatchChipIds] = useState("");
  const [fleetSearch, setFleetSearch] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const overviewQuery = trpc.controlCenter.getOverview.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 20000,
  });
  const fleetQuery = trpc.controlCenter.getFleetCatalog.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 20000,
  });
  const securityQuery = trpc.controlCenter.getSecurityOverview.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });
  const runtimeControlQuery = trpc.runtime.getControl.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const chipDetailQuery = trpc.controlCenter.getChipDetail.useQuery(
    { legacyChipId: selectedLegacyChipId ?? 0 },
    {
      enabled: isAuthenticated && selectedLegacyChipId != null,
    }
  );

  const userReconciliationQuery = trpc.runtime.reconcileLegacyUserAgainstOfficialProjection.useQuery(
    { userId: Number(userIdInput || 0) },
    {
      enabled: isAuthenticated && Number(userIdInput) > 0 && route.section === "reconciliation",
    }
  );

  const triggerProjectionMutation = trpc.runtime.triggerChipProjectionCycle.useMutation();
  const runAuditMutation = trpc.runtime.runChipAudit.useMutation();
  const migrateChipMutation = trpc.runtime.migrateLegacyChipToOfficialStream.useMutation();
  const migrateUserMutation = trpc.runtime.migrateLegacyUserFleetToOfficialStream.useMutation();
  const migrateFleetMutation = trpc.runtime.migrateLegacyFleetToOfficialStream.useMutation();

  useEffect(() => {
    if (route.legacyChipId && route.legacyChipId !== selectedLegacyChipId) {
      setSelectedLegacyChipId(route.legacyChipId);
      return;
    }

    if (!selectedLegacyChipId && fleetQuery.data?.length) {
      setSelectedLegacyChipId(fleetQuery.data[0].legacyChipId);
    }
  }, [fleetQuery.data, route.legacyChipId, selectedLegacyChipId]);

  const filteredFleet = useMemo(() => {
    const query = fleetSearch.trim().toLowerCase();
    if (!query) return fleetQuery.data ?? [];

    return (fleetQuery.data ?? []).filter((row) =>
      [row.chipName, row.phoneNumber ?? "", row.officialChipId, String(row.legacyChipId), String(row.userId)].some((value) =>
        value.toLowerCase().includes(query)
      )
    );
  }, [fleetQuery.data, fleetSearch]);

  const selectedFleetRow = useMemo(
    () => fleetQuery.data?.find((item) => item.legacyChipId === selectedLegacyChipId) ?? null,
    [fleetQuery.data, selectedLegacyChipId]
  );

  const navigateSection = (section: Exclude<ControlCenterSection, "chip">) => {
    const nextPath = section === "dashboard" ? "/control-center" : `/control-center/${section}`;
    setLocation(nextPath);
  };

  const handleRefresh = async () => {
    await Promise.all([
      overviewQuery.refetch(),
      fleetQuery.refetch(),
      securityQuery.refetch(),
      chipDetailQuery.refetch(),
    ]);
    sonnerToast.success("Painel atualizado.");
  };

  const refreshOperationalData = async () => {
    await Promise.all([
      utils.controlCenter.getOverview.invalidate(),
      utils.controlCenter.getFleetCatalog.invalidate(),
      utils.controlCenter.getSecurityOverview.invalidate(),
      selectedLegacyChipId != null
        ? utils.controlCenter.getChipDetail.invalidate({ legacyChipId: selectedLegacyChipId })
        : Promise.resolve(),
    ]);
  };

  const confirmAndRun = (action: ConfirmAction) => {
    setConfirmAction(action);
  };

  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    setConfirmLoading(true);
    try {
      await confirmAction.action();
      setConfirmAction(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleTriggerProjection = () =>
    confirmAndRun({
      title: "Executar worker de projeção",
      description: "Essa operação recalcula projeções a partir dos fatos persistidos do stream oficial.",
      confirmLabel: "Executar",
      action: async () => {
        try {
          await triggerProjectionMutation.mutateAsync({ limit: 1000 });
          await refreshOperationalData();
          sonnerToast.success("Worker de projeção executado.");
        } catch (error: any) {
          sonnerToast.error(error?.message || "Falha ao executar projeção.");
        }
      },
    });

  const handleRunAudit = () => {
    if (!chipDetailQuery.data) return;
    confirmAndRun({
      title: "Executar auditoria do chip",
      description: `Será registrada uma nova evidência append-only para ${chipDetailQuery.data.officialChipId}.`,
      confirmLabel: "Auditar",
      action: async () => {
        try {
          await runAuditMutation.mutateAsync({ chipId: chipDetailQuery.data!.officialChipId });
          await refreshOperationalData();
          sonnerToast.success("Auditoria executada.");
        } catch (error: any) {
          sonnerToast.error(error?.message || "Falha ao executar auditoria.");
        }
      },
    });
  };

  const handleMigrateChip = () => {
    if (!selectedLegacyChipId || !selectedFleetRow) return;
    confirmAndRun({
      title: "Migrar chip",
      description: `Chip: ${selectedFleetRow.chipName}. Essa operação cria o stream oficial quando ele ainda não existe e não pode ser desfeita.`,
      confirmLabel: "Migrar chip",
      action: async () => {
        try {
          await migrateChipMutation.mutateAsync({ legacyChipId: selectedLegacyChipId });
          await refreshOperationalData();
          sonnerToast.success("Chip migrado com sucesso.");
        } catch (error: any) {
          sonnerToast.error(error?.message || "Falha ao migrar chip.");
        }
      },
    });
  };

  const handleMigrateUser = () => {
    const userId = Number(userIdInput);
    if (!userId) {
      sonnerToast.error("Informe um usuário válido.");
      return;
    }

    confirmAndRun({
      title: "Migrar usuário",
      description: `Todos os chips do usuário #${userId} serão materializados no stream oficial quando necessário.`,
      confirmLabel: "Migrar usuário",
      action: async () => {
        try {
          await migrateUserMutation.mutateAsync({ userId });
          await refreshOperationalData();
          sonnerToast.success("Migração do usuário concluída.");
        } catch (error: any) {
          sonnerToast.error(error?.message || "Falha ao migrar usuário.");
        }
      },
    });
  };

  const handleMigrateFleet = () =>
    confirmAndRun({
      title: "Migrar frota inteira",
      description: "Essa operação percorre toda a frota legada e cria streams oficiais inexistentes. Streams já existentes não são reescritos.",
      confirmLabel: "Migrar frota",
      action: async () => {
        try {
          await migrateFleetMutation.mutateAsync();
          await refreshOperationalData();
          sonnerToast.success("Migração da frota concluída.");
        } catch (error: any) {
          sonnerToast.error(error?.message || "Falha ao migrar frota.");
        }
      },
    });

  const handleBatchMigrate = () => {
    const ids = batchChipIds
      .split(/[\s,;]+/)
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);

    if (!ids.length) {
      sonnerToast.error("Informe ao menos um chip legado válido.");
      return;
    }

    confirmAndRun({
      title: "Migrar lote manual",
      description: `Serão migrados ${ids.length} chips legados: ${ids.join(", ")}.`,
      confirmLabel: "Migrar lote",
      action: async () => {
        try {
          for (const id of ids) {
            await migrateChipMutation.mutateAsync({ legacyChipId: id });
          }
          await refreshOperationalData();
          sonnerToast.success(`Lote migrado com ${ids.length} chips.`);
        } catch (error: any) {
          sonnerToast.error(error?.message || "Falha ao migrar lote.");
        }
      },
    });
  };

  const handleExportHistory = async () => {
    if (!chipDetailQuery.data) return;
    const blob = new Blob([JSON.stringify(chipDetailQuery.data.history, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `chip-history-${chipDetailQuery.data.officialChipId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    sonnerToast.success("Histórico exportado.");
  };

  if (loading || overviewQuery.isLoading || fleetQuery.isLoading || securityQuery.isLoading) {
    return (
      <div className="app-shell bg-app-grid flex items-center justify-center">
        <Card className="card-premium-enhanced p-8 text-center">
          <p className="text-cyan-400 font-semibold">Carregando control center...</p>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated || !overviewQuery.data || !fleetQuery.data || !securityQuery.data) return null;

  const overview = overviewQuery.data;
  const fleetCatalog = fleetQuery.data;
  const chipDetail = chipDetailQuery.data;
  const security = securityQuery.data;
  const runtimeOverview = overview.runtime;
  const userReconciliation = userReconciliationQuery.data as any;

  const activeTab = route.section === "chip" ? "fleet" : route.section;
  const healthStatus = getHealthStatus(overview);
  const workersStatus = getWorkersStatus(overview);
  const reconciliationStatus = getReconciliationStatus(overview);

  return (
    <div className="app-shell bg-app-grid">
      <div className="page-container">
        <div className="page-hero md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="page-title mb-2">CONTROL CENTER</h1>
            <p className="page-subtitle">
              Dashboard decisório para estado do sistema e prontuário operacional dedicado por chip.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="subtle-action" onClick={() => setLocation("/runtime")}>
              <Cpu className="w-4 h-4 mr-2" />
              Runtime
            </Button>
            <Button variant="outline" className="subtle-action" onClick={() => setLocation("/admin")}>
              <Shield className="w-4 h-4 mr-2" />
              Backoffice
            </Button>
            <Button variant="outline" className="subtle-action" onClick={handleRefresh}>
              <RefreshCw className={`w-4 h-4 mr-2 ${overviewQuery.isFetching || fleetQuery.isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => navigateSection(value as Exclude<ControlCenterSection, "chip">)} className="space-y-6">
          <TabsList className="flex w-full flex-wrap h-auto gap-2 bg-transparent p-0">
            {controlCenterTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="border border-white/10 bg-white/5 text-gray-200 data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-200"
              >
                <span className="mr-2 inline-flex">{tab.icon}</span>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
              <StatusPanel title="Está saudável?" status={healthStatus.status} description={healthStatus.description} />
              <StatusPanel
                title="Existe problema crítico?"
                status={runtimeOverview.summary.criticalAlerts > 0 ? "critical" : "ok"}
                description={
                  runtimeOverview.summary.criticalAlerts > 0
                    ? `${runtimeOverview.summary.criticalAlerts} alertas críticos ativos no momento.`
                    : "Nenhum alerta crítico ativo."
                }
              />
              <StatusPanel
                title="Existe algo parado?"
                status={overview.runtime.summary.pendingJobs > 0 ? "warning" : "ok"}
                description={
                  overview.runtime.summary.pendingJobs > 0
                    ? `${overview.runtime.summary.pendingJobs} jobs pendentes aguardando processamento.`
                    : "Nenhum job pendente no momento."
                }
              />
              <StatusPanel
                title="Existe algo que exige atenção?"
                status={workersStatus.status}
                description={workersStatus.description}
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1.1fr_1fr] gap-6">
              <Card className="card-premium-enhanced p-6">
                <div className="flex items-center gap-3 mb-5">
                  <Activity className="w-5 h-5 text-cyan-300" />
                  <div>
                    <h2 className="section-title">Saúde do Sistema</h2>
                    <p className="section-subtitle">Somente os indicadores necessários para decisão rápida.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <StatMini label="Total de chips" value={overview.company.totalChips} />
                  <StatMini label="Conectados" value={overview.company.connected} tone="success" />
                  <StatMini label="Desconectados" value={overview.company.disconnected} tone={overview.company.disconnected > 0 ? "warning" : "success"} />
                  <StatMini label="Maturando" value={overview.company.maturing} />
                  <StatMini label="Alertas críticos" value={runtimeOverview.summary.criticalAlerts} tone={runtimeOverview.summary.criticalAlerts > 0 ? "danger" : "success"} />
                  <StatMini label="Última atualização" value={formatRelativeTime(overview.generatedAt)} />
                </div>
              </Card>

              <Card className="card-premium-enhanced p-6">
                <div className="flex items-center gap-3 mb-5">
                  <Waves className="w-5 h-5 text-cyan-300" />
                  <div>
                    <h2 className="section-title">Reconciliação</h2>
                    <p className="section-subtitle">Visão agregada do estado da transição e integridade da frota.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <StatMini label="Reconciliados" value={overview.reconciliation.reconciled_chips} tone="success" />
                  <StatMini label="Divergências" value={overview.reconciliation.divergences_found} tone={overview.reconciliation.divergences_found > 0 ? "warning" : "success"} />
                  <StatMini label="Sem stream" value={overview.reconciliation.chips_without_official_stream.length} tone={overview.reconciliation.chips_without_official_stream.length > 0 ? "warning" : "success"} />
                  <StatMini label="Sem projeção" value={overview.reconciliation.streams_without_projection.length} tone={overview.reconciliation.streams_without_projection.length > 0 ? "warning" : "success"} />
                </div>
                <div className="mt-5">
                  <StatusPanel title="Status da reconciliação" status={reconciliationStatus.status} description={reconciliationStatus.description} />
                </div>
              </Card>

              <Card className="card-premium-enhanced p-6">
                <div className="flex items-center gap-3 mb-5">
                  <AlertTriangle className="w-5 h-5 text-cyan-300" />
                  <div>
                    <h2 className="section-title">Alertas ativos</h2>
                    <p className="section-subtitle">Somente o que merece atenção imediata.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {runtimeOverview.alerts.length === 0 ? (
                    <p className="text-sm text-emerald-300">Nenhum alerta ativo.</p>
                  ) : (
                    runtimeOverview.alerts.slice(0, 5).map((alert) => (
                      <div key={`${alert.chipId}-${alert.type}-${alert.observedAt}`} className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white">{alert.chipName}</p>
                          <Badge variant={alert.severity === "critical" ? "destructive" : "outline"}>{alert.severity}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-gray-400">{alert.detail}</p>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_1fr] gap-6">
              <Card className="card-premium-enhanced p-6">
                <div className="flex items-center gap-3 mb-5">
                  <BarChart3 className="w-5 h-5 text-cyan-300" />
                  <div>
                    <h2 className="section-title">Behavior Health</h2>
                    <p className="section-subtitle">Leitura analítica dos logs de decisão e snapshots comportamentais.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <StatMini
                    label="Top bloqueio"
                    value={overview.behavior.topBlockReasons[0]?.reason || "N/D"}
                    tone={overview.behavior.topBlockReasons.length > 0 ? "warning" : "success"}
                  />
                  <StatMini
                    label="Chips presos 24h+"
                    value={overview.behavior.stuckChips.length}
                    tone={overview.behavior.stuckChips.length > 0 ? "warning" : "success"}
                  />
                  <StatMini
                    label="Fase dominante"
                    value={overview.behavior.phaseDistribution[0]?.phase || "N/D"}
                  />
                  <StatMini
                    label="Policy ativa"
                    value={overview.behavior.recentPolicyVersions[0]?.policyVersion || "N/D"}
                  />
                </div>
                <div className="mt-5 space-y-2 text-sm">
                  {overview.behavior.alerts.length === 0 ? (
                    <p className="text-emerald-300">Nenhum alerta comportamental relevante.</p>
                  ) : (
                    overview.behavior.alerts.map((alert) => (
                      <div key={alert} className="rounded-xl border border-white/10 bg-white/5 p-3 text-gray-200">
                        {alert}
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card className="card-premium-enhanced p-6">
                <div className="flex items-center gap-3 mb-5">
                  <TriangleAlert className="w-5 h-5 text-cyan-300" />
                  <div>
                    <h2 className="section-title">Top bloqueios</h2>
                    <p className="section-subtitle">Motivos mais frequentes nos últimos 7 dias.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {overview.behavior.topBlockReasons.length === 0 ? (
                    <p className="text-sm text-gray-400">Sem bloqueios registrados no período.</p>
                  ) : (
                    overview.behavior.topBlockReasons.slice(0, 5).map((item) => (
                      <div key={item.reason} className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white">{item.reason}</p>
                          <Badge variant="outline">{item.percentage}%</Badge>
                        </div>
                        <p className="mt-2 text-xs text-gray-400">{item.count} ocorrência(s)</p>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card className="card-premium-enhanced p-6">
                <div className="flex items-center gap-3 mb-5">
                  <History className="w-5 h-5 text-cyan-300" />
                  <div>
                    <h2 className="section-title">Chips presos</h2>
                    <p className="section-subtitle">Snapshots com mesma fase por 24h ou mais.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {overview.behavior.stuckChips.length === 0 ? (
                    <p className="text-sm text-emerald-300">Nenhum chip preso acima do limiar.</p>
                  ) : (
                    overview.behavior.stuckChips.slice(0, 5).map((chip) => (
                      <div key={`${chip.chipId}-${chip.phase}`} className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white">Chip #{chip.chipId}</p>
                          <Badge variant="outline">{chip.phase}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-gray-400">
                          {chip.hoursInPhase}h na fase • razão: {chip.lastReason || "N/D"}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
              <Card className="card-premium-enhanced p-6">
                <div className="flex items-center gap-3 mb-5">
                  <Cpu className="w-5 h-5 text-cyan-300" />
                  <div>
                    <h2 className="section-title">Workers</h2>
                    <p className="section-subtitle">Operação resumida dos componentes assíncronos.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <StatMini label="Jobs pendentes" value={runtimeOverview.summary.pendingJobs} tone={runtimeOverview.summary.pendingJobs > 0 ? "warning" : "success"} />
                  <StatMini label="Warnings" value={runtimeOverview.summary.warningAlerts} tone={runtimeOverview.summary.warningAlerts > 0 ? "warning" : "success"} />
                  <StatMini label="Failures" value={runtimeOverview.summary.failedAttemptsLastWindow} tone={runtimeOverview.summary.failedAttemptsLastWindow > 0 ? "warning" : "success"} />
                  <StatMini label="Snapshots" value={runtimeOverview.summary.chipsWithSnapshots} />
                </div>
                <Button className="w-full mt-5 btn-primary-modern action-save" onClick={handleTriggerProjection} disabled={triggerProjectionMutation.isPending}>
                  Rodar worker de projeção
                </Button>
              </Card>

              <Card className="card-premium-enhanced p-6">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div>
                    <h2 className="section-title">Frota</h2>
                    <p className="section-subtitle">Lista resumida com foco em ação. O detalhe abre em contexto próprio.</p>
                  </div>
                  <Button variant="outline" className="subtle-action" onClick={() => navigateSection("fleet")}>
                    Ver frota completa
                  </Button>
                </div>
                <div className="space-y-3">
                  {fleetCatalog.slice(0, 6).map((row) => (
                    <button
                      key={row.legacyChipId}
                      onClick={() => {
                        setSelectedLegacyChipId(row.legacyChipId);
                        setLocation(`/control-center/chip/${row.legacyChipId}`);
                      }}
                      className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{row.chipName}</p>
                          <p className="mt-1 text-xs text-gray-400">Legado #{row.legacyChipId} • {row.phoneNumber || "sem telefone"}</p>
                        </div>
                        <Badge variant={getFleetStatusVariant(row.reconciliationStatus) as any}>{row.currentState || row.legacyStatus}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-gray-400">
                        <div>
                          <p>Eventos</p>
                          <p className="mt-1 text-gray-200">{row.officialEventCount}</p>
                        </div>
                        <div>
                          <p>Última atividade</p>
                          <p className="mt-1 text-gray-200">{formatRelativeTime(row.projectionUpdatedAt)}</p>
                        </div>
                        <div>
                          <p>Reconciliação</p>
                          <p className="mt-1 text-gray-200">{row.reconciliationStatus}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="fleet" className="space-y-6">
            {route.section === "chip" ? (
              <Card className="card-premium-enhanced p-6">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <Button variant="ghost" className="mb-3 px-0 text-cyan-300 hover:text-cyan-200" onClick={() => navigateSection("fleet")}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Voltar para a frota
                    </Button>
                    <h2 className="section-title mb-1">{selectedFleetRow?.chipName || "Chip"}</h2>
                    <p className="section-subtitle">{chipDetail?.officialChipId || "Carregando stream oficial..."}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="subtle-action" onClick={handleExportHistory} disabled={!chipDetail}>
                      <Upload className="w-4 h-4 mr-2" />
                      Exportar
                    </Button>
                    <Button className="btn-primary-modern action-save" onClick={handleRunAudit} disabled={!chipDetail || runAuditMutation.isPending}>
                      <Shield className="w-4 h-4 mr-2" />
                      Auditar
                    </Button>
                  </div>
                </div>

                {!chipDetail || !selectedFleetRow ? (
                  <p className="text-sm text-gray-400">Chip não encontrado.</p>
                ) : (
                  <Tabs value={chipDetailTab} onValueChange={setChipDetailTab} className="space-y-6">
                    <TabsList className="flex w-full flex-wrap h-auto gap-2 bg-transparent p-0">
                      {chipDetailTabs.map((tab) => (
                        <TabsTrigger
                          key={tab.value}
                          value={tab.value}
                          className="border border-white/10 bg-white/5 text-gray-200 data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-200"
                        >
                          {tab.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    <TabsContent value="summary" className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <StatMini label="Estado oficial" value={selectedFleetRow.currentState || "N/D"} tone="success" />
                        <StatMini label="Estado legado" value={selectedFleetRow.legacyStatus} />
                        <StatMini label="Eventos" value={selectedFleetRow.officialEventCount} />
                        <StatMini label="Auditorias" value={selectedFleetRow.auditEvidenceCount} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <StatMini label="Fase atual" value={chipDetail.behaviorSnapshot?.phase || chipDetail.latestBehaviorDecision?.phase || "N/D"} />
                        <StatMini
                          label="Última decisão"
                          value={chipDetail.behaviorSnapshot?.lastDecision || chipDetail.latestBehaviorDecision?.decision || "N/D"}
                          tone={
                            (chipDetail.behaviorSnapshot?.lastDecision || chipDetail.latestBehaviorDecision?.decision) === "BLOCK"
                              ? "danger"
                              : (chipDetail.behaviorSnapshot?.lastDecision || chipDetail.latestBehaviorDecision?.decision) === "ALLOW"
                                ? "success"
                                : "warning"
                          }
                        />
                        <StatMini label="Próximo check" value={formatRelativeTime(chipDetail.behaviorSnapshot?.nextCheckAt || chipDetail.latestBehaviorDecision?.nextCheckAt)} />
                        <StatMini label="Engine" value={chipDetail.behaviorSnapshot?.engineVersion || chipDetail.latestBehaviorDecision?.engineVersion || "N/D"} />
                        <StatMini
                          label="Policy"
                          value={chipDetail.behaviorSnapshot?.policyFingerprint || chipDetail.latestBehaviorDecision?.policyFingerprint || "N/D"}
                        />
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <Card className="border border-white/10 bg-white/5 p-5">
                          <h3 className="text-sm font-semibold text-white mb-4">Resumo operacional</h3>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500">Telefone</p>
                              <p className="mt-1 text-white">{selectedFleetRow.phoneNumber || "N/D"}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Última sequência</p>
                              <p className="mt-1 text-white">{selectedFleetRow.lastSequence ?? "N/D"}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Projeção</p>
                              <p className="mt-1 text-white">{selectedFleetRow.projectionState || "N/D"}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Última atividade</p>
                              <p className="mt-1 text-white">{formatRelativeTime(selectedFleetRow.projectionUpdatedAt)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Trust</p>
                              <p className="mt-1 text-white">{chipDetail.behaviorSnapshot?.trustScore ?? chipDetail.latestBehaviorDecision?.trustScore ?? "N/D"}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Risk</p>
                              <p className="mt-1 text-white">{chipDetail.behaviorSnapshot?.riskScore ?? chipDetail.latestBehaviorDecision?.riskScore ?? "N/D"}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Budget</p>
                              <p className="mt-1 text-white">
                                {chipDetail.behaviorSnapshot
                                  ? `${chipDetail.behaviorSnapshot.dailyBudgetUsed}/${chipDetail.behaviorSnapshot.dailyBudgetTotal}`
                                  : chipDetail.latestBehaviorDecision
                                    ? `${chipDetail.latestBehaviorDecision.dailyBudgetUsed}/${chipDetail.latestBehaviorDecision.dailyBudgetTotal}`
                                    : "N/D"}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Reciprocidade</p>
                              <p className="mt-1 text-white">
                                {chipDetail.behaviorSnapshot
                                  ? `${chipDetail.behaviorSnapshot.inboundCount}/${chipDetail.behaviorSnapshot.outboundCount}`
                                  : "N/D"}
                              </p>
                            </div>
                          </div>
                        </Card>

                        <Card className="border border-white/10 bg-white/5 p-5">
                          <h3 className="text-sm font-semibold text-white mb-4">Última decisão da política</h3>
                          {!chipDetail.latestBehaviorDecision ? (
                            <p className="text-sm text-gray-400">Nenhuma decisão registrada ainda para este chip.</p>
                          ) : (
                            <div className="space-y-3 text-sm">
                              <div>
                                <p className="text-gray-500">Decisão</p>
                                <p className="mt-1 text-white">{chipDetail.latestBehaviorDecision.decision}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Razão</p>
                                <p className="mt-1 text-white">{chipDetail.latestBehaviorDecision.reason}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Atualizado</p>
                                <p className="mt-1 text-white">{formatDateTime(chipDetail.latestBehaviorDecision.createdAt)}</p>
                              </div>
                              <details>
                                <summary className="cursor-pointer text-xs text-cyan-300">Mostrar checks do explain mode</summary>
                                <div className="mt-4">
                                  <JsonBlock
                                    value={
                                      chipDetail.latestBehaviorDecision.checksJson
                                        ? JSON.parse(chipDetail.latestBehaviorDecision.checksJson)
                                        : {}
                                    }
                                  />
                                </div>
                              </details>
                            </div>
                          )}
                        </Card>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <Card className="border border-white/10 bg-white/5 p-5">
                          <h3 className="text-sm font-semibold text-white mb-4">Reconciliação</h3>
                          {selectedFleetRow.reconciliationIssues.length === 0 ? (
                            <p className="text-sm text-emerald-300">Sem divergências para este chip.</p>
                          ) : (
                            <div className="space-y-2">
                              {selectedFleetRow.reconciliationIssues.map((issue) => (
                                <div key={issue} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-gray-200">
                                  {issue}
                                </div>
                              ))}
                            </div>
                          )}
                        </Card>

                        <Card className="border border-white/10 bg-white/5 p-5">
                          <h3 className="text-sm font-semibold text-white mb-4">Timeline de decisões recentes</h3>
                          {chipDetail.recentBehaviorDecisions.length === 0 ? (
                            <p className="text-sm text-gray-400">Nenhuma decisão recente registrada.</p>
                          ) : (
                            <div className="space-y-2">
                              {chipDetail.recentBehaviorDecisions.slice(0, 8).map((entry: any) => (
                                <div key={entry.id} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="font-medium text-white">
                                      {entry.decision} • {entry.phase}
                                    </span>
                                    <span className="text-xs text-gray-400">{formatRelativeTime(entry.createdAt)}</span>
                                  </div>
                                  <p className="mt-2 text-gray-300">{entry.reason}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </Card>
                      </div>

                      <Card className="border border-white/10 bg-white/5 p-5">
                        <h3 className="text-sm font-semibold text-white mb-4">Execution Ledger recente</h3>
                        {chipDetail.recentActionExecutions.length === 0 ? (
                          <p className="text-sm text-gray-400">Nenhuma execução persistida ainda para este chip.</p>
                        ) : (
                          <div className="space-y-2">
                            {chipDetail.recentActionExecutions.slice(0, 8).map((entry: any) => (
                              <div key={entry.id} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="font-medium text-white">
                                    {entry.status} • {entry.requestedAction}
                                  </span>
                                  <span className="text-xs text-gray-400">{formatRelativeTime(entry.updatedAt || entry.createdAt)}</span>
                                </div>
                                <div className="mt-2 grid grid-cols-2 xl:grid-cols-4 gap-3 text-xs text-gray-300">
                                  <span>Budget: {entry.budgetState}</span>
                                  <span>Tentativa: {entry.attempt}</span>
                                  <span>Target: {entry.targetValue}</span>
                                  <span>MsgId: {entry.messageId || "N/D"}</span>
                                </div>
                                {entry.error ? <p className="mt-2 text-xs text-rose-300">{entry.error}</p> : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    </TabsContent>

                    <TabsContent value="timeline" className="space-y-4">
                      <ScrollArea className="h-[560px] pr-4">
                        <div className="space-y-3">
                          {chipDetail.history.events.map((event: any) => (
                            <div key={event.event_id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-white">
                                    seq {event.sequence} • {event.event_type}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1">{formatDateTime(event.occurred_at)}</p>
                                </div>
                                <Badge variant="outline">v{event.event_version}</Badge>
                              </div>

                              <details className="mt-4">
                                <summary className="cursor-pointer text-xs text-cyan-300">Mostrar payload e metadata</summary>
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
                                  <JsonBlock value={event.payload} />
                                  <JsonBlock value={event.metadata ?? {}} />
                                </div>
                              </details>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="replay" className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <StatMini label="Estado replay" value={chipDetail.replay.replay.current_state || "N/D"} tone="success" />
                        <StatMini label="Estado projeção" value={chipDetail.projection?.current_state || "N/D"} />
                        <StatMini label="Eventos processados" value={chipDetail.replay.replay.processed_events} />
                        <StatMini label="Inconsistências" value={chipDetail.replay.replay.inconsistencies.length} tone={chipDetail.replay.replay.inconsistencies.length > 0 ? "danger" : "success"} />
                      </div>

                      <Card className="border border-white/10 bg-white/5 p-5">
                        <h3 className="text-sm font-semibold text-white mb-4">Resultado do replay</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                          <div>
                            <p className="text-gray-500">Estado atual</p>
                            <p className="mt-1 text-white">{chipDetail.replay.replay.current_state || "N/D"}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Estado anterior</p>
                            <p className="mt-1 text-white">{chipDetail.replay.replay.previous_state || "N/D"}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Última sequence</p>
                            <p className="mt-1 text-white">{chipDetail.replay.replay.last_sequence ?? "N/D"}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Transições aplicadas</p>
                            <p className="mt-1 text-white">{chipDetail.replay.replay.transitions_applied}</p>
                          </div>
                        </div>

                        <details>
                          <summary className="cursor-pointer text-xs text-cyan-300">Mostrar replay detalhado</summary>
                          <div className="mt-4">
                            <JsonBlock
                              value={{
                                transition_log: chipDetail.replay.replay.transition_log,
                                inconsistencies: chipDetail.replay.replay.inconsistencies,
                              }}
                            />
                          </div>
                        </details>
                      </Card>
                    </TabsContent>

                    <TabsContent value="audit" className="space-y-4">
                      {chipDetail.auditEvidences.length === 0 ? (
                        <p className="text-sm text-gray-400">Nenhuma evidência registrada.</p>
                      ) : (
                        <ScrollArea className="h-[560px] pr-4">
                          <div className="space-y-3">
                            {chipDetail.auditEvidences.map((evidence: any) => (
                              <div key={evidence.evidence_id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-white">{evidence.evidence_type}</p>
                                    <p className="text-xs text-gray-400 mt-1">{formatDateTime(evidence.recorded_at)}</p>
                                  </div>
                                  <Badge variant="outline">{evidence.evidence_id.slice(0, 8)}</Badge>
                                </div>
                                <details className="mt-4">
                                  <summary className="cursor-pointer text-xs text-cyan-300">Mostrar payload da evidência</summary>
                                  <div className="mt-4">
                                    <JsonBlock value={evidence.payload} />
                                  </div>
                                </details>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
                <Card className="card-premium-enhanced p-4">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="section-title mb-1">Frota</h2>
                      <p className="section-subtitle">Lista operacional resumida com acesso ao prontuário do chip.</p>
                    </div>
                    <Badge variant="outline">{filteredFleet.length}</Badge>
                  </div>

                  <Input
                    value={fleetSearch}
                    onChange={(e) => setFleetSearch(e.target.value)}
                    className="field-control mb-4"
                    placeholder="Buscar por chip, usuário, telefone ou stream"
                  />

                  <ScrollArea className="h-[720px] pr-3">
                    <div className="space-y-3">
                      {filteredFleet.map((row) => (
                        <button
                          key={row.legacyChipId}
                          onClick={() => {
                            setSelectedLegacyChipId(row.legacyChipId);
                            setLocation(`/control-center/chip/${row.legacyChipId}`);
                          }}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{row.chipName}</p>
                              <p className="text-xs text-gray-400 mt-1">Legado #{row.legacyChipId} • user #{row.userId}</p>
                            </div>
                            <Badge variant={getFleetStatusVariant(row.reconciliationStatus) as any}>{row.reconciliationStatus}</Badge>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="text-gray-500 uppercase">Estado</p>
                              <p className="text-gray-200">{row.currentState || row.legacyStatus}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 uppercase">Última atividade</p>
                              <p className="text-gray-200">{formatRelativeTime(row.projectionUpdatedAt)}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </Card>

                <Card className="card-premium-enhanced p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <PauseCircle className="w-5 h-5 text-cyan-300" />
                    <div>
                      <h2 className="section-title mb-1">Prontuário do chip</h2>
                      <p className="section-subtitle">Escolha um chip na lista para abrir resumo, timeline, replay e auditoria em contexto próprio.</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400">
                    A lista da frota agora foca em triagem. O detalhe técnico e operacional completo abre em uma rota dedicada por chip.
                  </p>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="workers" className="space-y-6">
            <Card className="card-premium-enhanced p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="section-title mb-1">Workers</h2>
                  <p className="section-subtitle">Heartbeat, filas, snapshots, health e alertas da execução assíncrona.</p>
                </div>
                <Button className="btn-primary-modern action-save" onClick={handleTriggerProjection} disabled={triggerProjectionMutation.isPending}>
                  <Cpu className="w-4 h-4 mr-2" />
                  Rodar projeção
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                <StatMini label="Snapshots" value={runtimeOverview.summary.chipsWithSnapshots} />
                <StatMini label="Fleet learning" value={runtimeOverview.summary.chipsWithFleetLearning} />
                <StatMini label="Jobs pendentes" value={runtimeOverview.summary.pendingJobs} tone={runtimeOverview.summary.pendingJobs > 0 ? "warning" : "success"} />
                <StatMini label="Failures recentes" value={runtimeOverview.summary.failedAttemptsLastWindow} tone={runtimeOverview.summary.failedAttemptsLastWindow > 0 ? "warning" : "success"} />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chip</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead>Coverage</TableHead>
                    <TableHead>Snapshot</TableHead>
                    <TableHead>Alertas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runtimeOverview.chips.map((chip) => (
                    <TableRow key={chip.chipId}>
                      <TableCell>{chip.chipName}</TableCell>
                      <TableCell>{chip.health.healthScore}</TableCell>
                      <TableCell>{chip.memory.evidenceCoverage ?? "N/D"}</TableCell>
                      <TableCell>{chip.memory.snapshotAgeMinutes == null ? "ausente" : `${chip.memory.snapshotAgeMinutes} min`}</TableCell>
                      <TableCell>{chip.alerts.length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="reconciliation" className="space-y-6">
            <Card className="card-premium-enhanced p-6">
              <div className="flex flex-wrap items-end gap-4 mb-5">
                <div className="flex-1 min-w-[180px]">
                  <Label htmlFor="user-reconciliation">Reconciliar usuário</Label>
                  <Input id="user-reconciliation" value={userIdInput} onChange={(e) => setUserIdInput(e.target.value)} className="field-control mt-2" placeholder="ID do usuário" />
                </div>
                <Button variant="outline" className="subtle-action" onClick={() => userReconciliationQuery.refetch()} disabled={!userIdInput}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reconciliar usuário
                </Button>
                <Button className="btn-primary-modern action-save" onClick={() => overviewQuery.refetch()}>
                  <Waves className="w-4 h-4 mr-2" />
                  Reconciliar frota
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <StatMini label="Reconciliados" value={overview.reconciliation.reconciled_chips} tone="success" />
                <StatMini label="Sem stream" value={overview.reconciliation.chips_without_official_stream.length} tone={overview.reconciliation.chips_without_official_stream.length > 0 ? "warning" : "success"} />
                <StatMini label="Sem projeção" value={overview.reconciliation.streams_without_projection.length} tone={overview.reconciliation.streams_without_projection.length > 0 ? "warning" : "success"} />
                <StatMini label="Divergências" value={overview.reconciliation.divergences_found} tone={overview.reconciliation.divergences_found > 0 ? "warning" : "success"} />
              </div>

              {userReconciliation ? (
                <Card className="border border-white/10 bg-white/5 p-4 mb-6">
                  <p className="text-sm font-semibold text-white mb-2">Resultado do usuário #{userReconciliation.user_id}</p>
                  <JsonBlock value={userReconciliation} />
                </Card>
              ) : null}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card className="border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Sem stream oficial</h3>
                  <JsonBlock value={overview.reconciliation.chips_without_official_stream} />
                </Card>
                <Card className="border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Divergências legado × oficial</h3>
                  <JsonBlock value={overview.reconciliation.legacy_official_divergences} />
                </Card>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="admin" className="space-y-6">
            <Card className="card-premium-enhanced p-6">
              <h2 className="section-title mb-4">Operações administrativas</h2>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <Card className="border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white mb-3">Migração controlada</p>
                  <div className="space-y-3">
                    <Button className="w-full btn-primary-modern action-save" onClick={handleMigrateChip} disabled={!selectedLegacyChipId}>
                      Migrar chip selecionado
                    </Button>
                    <Button className="w-full" variant="outline" onClick={handleMigrateUser}>
                      Migrar usuário
                    </Button>
                    <Button className="w-full" variant="outline" onClick={handleMigrateFleet}>
                      Migrar frota
                    </Button>
                  </div>
                </Card>

                <Card className="border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white mb-3">Lote manual</p>
                  <Textarea
                    value={batchChipIds}
                    onChange={(e) => setBatchChipIds(e.target.value)}
                    className="field-control min-h-[120px]"
                    placeholder="Ex: 1, 4, 8, 10"
                  />
                  <Button className="w-full mt-3 btn-primary-modern action-save" onClick={handleBatchMigrate}>
                    Migrar lote
                  </Button>
                </Card>

                <Card className="border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white mb-3">Controles do runtime</p>
                  <details>
                    <summary className="cursor-pointer text-xs text-cyan-300">Mostrar JSON do runtime</summary>
                    <div className="mt-4">
                      <JsonBlock value={runtimeControlQuery.data ?? {}} />
                    </div>
                  </details>
                </Card>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card className="card-premium-enhanced p-6">
              <h2 className="section-title mb-4">Segurança</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <StatMini label="Usuários totais" value={security.users.total} />
                <StatMini label="Usuários ativos" value={security.users.active} tone="success" />
                <StatMini label="Admins" value={security.users.admins} />
                <StatMini label="Login local" value={security.auth.localEnabled ? "ligado" : "desligado"} tone={security.auth.localEnabled ? "success" : "warning"} />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-[0.8fr_1.2fr] gap-6">
                <Card className="border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Configuração</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-gray-500">Auth local</p>
                      <p className="mt-1 text-white">{security.auth.localEnabled ? "Ativo" : "Inativo"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Identidade local</p>
                      <p className="mt-1 text-white">{security.auth.localName || "N/D"}</p>
                    </div>
                  </div>
                </Card>

                <Card className="border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Logs administrativos recentes</h3>
                  <ScrollArea className="h-[360px] pr-4">
                    <div className="space-y-3">
                      {security.recentAdminAuditLogs.length === 0 ? (
                        <p className="text-sm text-gray-400">Nenhum log administrativo recente.</p>
                      ) : (
                        security.recentAdminAuditLogs.map((log: any) => (
                          <div key={log.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                            <p className="text-sm font-semibold text-white">{log.action}</p>
                            <p className="mt-1 text-xs text-gray-400">{formatDateTime(log.createdAt)}</p>
                            <details className="mt-3">
                              <summary className="cursor-pointer text-xs text-cyan-300">Mostrar detalhes</summary>
                              <div className="mt-4">
                                <JsonBlock value={log.details ?? {}} />
                              </div>
                            </details>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </Card>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <AlertDialog open={Boolean(confirmAction)} onOpenChange={(open) => (!open ? setConfirmAction(null) : null)}>
          <AlertDialogContent className="bg-slate-950 border-white/10 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-300">{confirmAction?.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={confirmLoading} className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction disabled={confirmLoading} onClick={executeConfirmedAction} className="bg-cyan-600 hover:bg-cyan-500">
                {confirmLoading ? "Executando..." : confirmAction?.confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
