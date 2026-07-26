import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import SystemSidebar from "@/components/SystemSidebar";
import { Activity, AlertTriangle, CheckCircle2, Clock3, Filter, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type ActionType =
  | "message_sent"
  | "image_sent"
  | "audio_sent"
  | "reaction_sent"
  | "message_received"
  | "connection"
  | "disconnection"
  | "error";

type StatusType = "success" | "failed" | "pending";
type TimelineEventType =
  | "message_sent"
  | "message_acknowledged"
  | "message_received"
  | "group_joined"
  | "messages_read";

const actionLabels: Record<ActionType, string> = {
  message_sent: "Mensagem enviada",
  image_sent: "Imagem enviada",
  audio_sent: "Áudio enviado",
  reaction_sent: "Reação enviada",
  message_received: "Mensagem recebida",
  connection: "Conexão",
  disconnection: "Desconexão",
  error: "Erro",
};

const statusLabels: Record<StatusType, string> = {
  success: "Sucesso",
  failed: "Falha",
  pending: "Pendente",
};

const timelineEventLabels: Record<TimelineEventType, string> = {
  message_sent: "Mensagem enviada",
  message_acknowledged: "ACK recebido",
  message_received: "Mensagem recebida",
  group_joined: "Entrou em grupo",
  messages_read: "Mensagens lidas",
};

const timelineSourceLabels: Record<string, string> = {
  sendMessage: "sendMessage()",
  "messages.upsert": "messages.upsert",
  groupAcceptInvite: "groupAcceptInvite()",
  readMessages: "readMessages()",
};

function getStatusVariant(status: StatusType): "default" | "destructive" | "secondary" | "outline" {
  if (status === "success") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
}

export default function Logs() {
  const { user, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();

  const initialChipId = useMemo(() => {
    const value = new URLSearchParams(window.location.search).get("chipId");
    return value ? value : "all";
  }, []);

  const [chipId, setChipId] = useState<string>(initialChipId);
  const [timelineEventType, setTimelineEventType] = useState<string>("all");
  const [actionType, setActionType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  const { data: chips = [] } = trpc.chips.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const logsQuery = trpc.chips.listLogs.useQuery(
    {
      chipId: chipId !== "all" ? Number(chipId) : undefined,
      actionType: actionType !== "all" ? (actionType as ActionType) : undefined,
      status: status !== "all" ? (status as StatusType) : undefined,
      search: search.trim() || undefined,
      dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
      dateTo: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
      limit: 150,
    },
    {
      enabled: isAuthenticated,
    }
  );

  const timelineQuery = trpc.chips.listBehaviorTimeline.useQuery(
    {
      chipId: chipId !== "all" ? Number(chipId) : undefined,
      eventType: timelineEventType !== "all" ? (timelineEventType as TimelineEventType) : undefined,
      dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
      dateTo: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
      limit: 200,
    },
    {
      enabled: isAuthenticated,
    }
  );

  const logs = logsQuery.data ?? [];
  const timelineEvents = timelineQuery.data?.events ?? [];
  const timelineSummary = timelineQuery.data?.summary ?? {
    total: 0,
    sent: 0,
    acknowledged: 0,
    received: 0,
    groupsJoined: 0,
    reads: 0,
  };
  const selectedChip = chips.find((chip) => String(chip.id) === chipId);
  const successCount = logs.filter((log) => log.status === "success").length;
  const failedCount = logs.filter((log) => log.status === "failed").length;
  const pendingCount = logs.filter((log) => log.status === "pending").length;

  const clearFilters = () => {
    setChipId("all");
    setTimelineEventType("all");
    setActionType("all");
    setStatus("all");
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setLocation("/logs");
  };

  const openChipLogs = (nextChipId: string) => {
    setChipId(nextChipId);
    setLocation(nextChipId === "all" ? "/logs" : `/logs?chipId=${nextChipId}`);
  };

  if (!isAuthenticated || !user) {
    return null;
  }

  const getTimelineContext = (event: any) =>
    event.groupSubject || event.remoteLabel || event.groupJid || event.remoteJid || "-";

  const getTimelineEvidence = (event: any) => {
    if (event.ackType) return `ACK: ${event.ackType}`;
    if (event.contentPreview) return event.contentPreview;
    if (event.payload?.count) return `${event.payload.count} mensagem(ns)`;
    if (event.messageId) return `msgId: ${event.messageId}`;
    return "Sem evidência textual";
  };

  return (
    <div className="app-shell bg-app-grid text-white font-poppins overflow-hidden">
      <div className="fixed inset-0 opacity-5 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(0deg, transparent 24%, rgba(0, 255, 255, 0.1) 25%, rgba(0, 255, 255, 0.1) 26%, transparent 27%, transparent 74%, rgba(0, 255, 255, 0.1) 75%, rgba(0, 255, 255, 0.1) 76%, transparent 77%, transparent),
                             linear-gradient(90deg, transparent 24%, rgba(0, 255, 255, 0.1) 25%, rgba(0, 255, 255, 0.1) 26%, transparent 27%, transparent 74%, rgba(0, 255, 255, 0.1) 75%, rgba(0, 255, 255, 0.1) 76%, transparent 77%, transparent)`,
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      <div className="page-container">
        <div className="system-layout">
          <SystemSidebar system="maturation" />
          <div className="system-main">
        <p className="page-breadcrumb page-breadcrumb-emerald">Central admin / sistema 1 / logs</p>
        <div className="page-hero md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="page-title mb-2">LOGS OPERACIONAIS</h1>
            <p className="page-subtitle">
              Monitore a operação e a Behavior Timeline MVP com evidências reais do Baileys.
            </p>
            {selectedChip && (
              <p className="text-cyan-400 text-sm mt-2">
                Filtro rápido ativo para o chip `{selectedChip.chipName}`.
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10"
              onClick={() => {
                logsQuery.refetch();
                timelineQuery.refetch();
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
            <Button className="btn-primary-modern" onClick={() => setLocation("/dashboard")}>
              Voltar à maturação
            </Button>
          </div>
        </div>

        <Card className="card-premium-enhanced p-6 mb-8">
          <div className={`status-banner ${logs.length > 0 ? "status-banner-ok" : "status-banner-warn"}`}>
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">
                  {logs.length > 0 ? "Leitura operacional pronta" : "Nenhum evento no filtro atual"}
                </p>
                <p className="text-sm text-gray-300 mt-1">
                  {logs.length > 0
                    ? "Use os filtros para isolar falhas, conexões, mensagens e atividades recentes por chip."
                    : "Ajuste filtros ou aguarde novas atividades dos chips para preencher esta visão."}
                </p>
              </div>
              <Badge variant={logs.length > 0 ? "secondary" : "outline"}>
                {logs.length > 0 ? "logs ativos" : "sem eventos"}
              </Badge>
            </div>

            <div className="summary-grid mt-4">
              <div className="summary-pill">
                <p className="summary-pill-label">Total no filtro</p>
                <p className="summary-pill-value">{logs.length}</p>
              </div>
              <div className="summary-pill">
                <p className="summary-pill-label">Falhas</p>
                <p className="summary-pill-value text-red-400">{failedCount}</p>
              </div>
              <div className="summary-pill">
                <p className="summary-pill-label">Sucessos</p>
                <p className="summary-pill-value text-green-400">{successCount}</p>
              </div>
              <div className="summary-pill">
                <p className="summary-pill-label">Chip filtrado</p>
                <p className="summary-pill-value">{selectedChip ? selectedChip.chipName : "Todos"}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="card-premium-enhanced p-6 mb-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="section-title">Behavior Timeline MVP</h2>
              <p className="text-sm text-gray-400">
                Eventos semânticos auditáveis, separados dos logs de infraestrutura, para provar a base antes de Score e Mission Control.
              </p>
            </div>
            <Badge variant={timelineEvents.length > 0 ? "secondary" : "outline"}>
              {timelineEvents.length > 0 ? "timeline ativa" : "aguardando eventos"}
            </Badge>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-5">
            <div className="summary-pill">
              <p className="summary-pill-label">Total</p>
              <p className="summary-pill-value">{timelineSummary.total}</p>
            </div>
            <div className="summary-pill">
              <p className="summary-pill-label">Enviadas</p>
              <p className="summary-pill-value text-cyan-400">{timelineSummary.sent}</p>
            </div>
            <div className="summary-pill">
              <p className="summary-pill-label">ACKs</p>
              <p className="summary-pill-value text-green-400">{timelineSummary.acknowledged}</p>
            </div>
            <div className="summary-pill">
              <p className="summary-pill-label">Recebidas</p>
              <p className="summary-pill-value text-violet-400">{timelineSummary.received}</p>
            </div>
            <div className="summary-pill">
              <p className="summary-pill-label">Grupo/Leitura</p>
              <p className="summary-pill-value text-amber-400">
                {timelineSummary.groupsJoined + timelineSummary.reads}
              </p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="card-premium-enhanced p-5">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-cyan-400" />
              <div>
                <p className="text-xs uppercase text-gray-400">Total</p>
                <p className="text-2xl font-bold text-cyan-400">{logs.length}</p>
              </div>
            </div>
          </Card>
          <Card className="card-premium-enhanced p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
              <div>
                <p className="text-xs uppercase text-gray-400">Sucesso</p>
                <p className="text-2xl font-bold text-green-400">{successCount}</p>
              </div>
            </div>
          </Card>
          <Card className="card-premium-enhanced p-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <div>
                <p className="text-xs uppercase text-gray-400">Falhas</p>
                <p className="text-2xl font-bold text-red-400">{failedCount}</p>
              </div>
            </div>
          </Card>
          <Card className="card-premium-enhanced p-5">
            <div className="flex items-center gap-3">
              <Clock3 className="w-6 h-6 text-yellow-400" />
              <div>
                <p className="text-xs uppercase text-gray-400">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="card-premium-enhanced p-6 mb-8">
          <div className="flex items-center gap-2 mb-5">
            <Filter className="w-4 h-4 text-cyan-400" />
            <h2 className="section-title">Filtros</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-4">
            <div className="space-y-2">
              <p className="text-xs text-gray-400 uppercase">Chip</p>
              <Select value={chipId} onValueChange={openChipLogs}>
                <SelectTrigger className="w-full field-control">
                  <SelectValue placeholder="Todos os chips" />
                </SelectTrigger>
                <SelectContent className="field-dropdown">
                  <SelectItem value="all">Todos os chips</SelectItem>
                  {chips.map((chip) => (
                    <SelectItem key={chip.id} value={String(chip.id)}>
                      {chip.chipName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-gray-400 uppercase">Evento timeline</p>
              <Select value={timelineEventType} onValueChange={setTimelineEventType}>
                <SelectTrigger className="w-full field-control">
                  <SelectValue placeholder="Todos os eventos" />
                </SelectTrigger>
                <SelectContent className="field-dropdown">
                  <SelectItem value="all">Todos os eventos</SelectItem>
                  {Object.entries(timelineEventLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-gray-400 uppercase">Ação</p>
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger className="w-full field-control">
                  <SelectValue placeholder="Todas as ações" />
                </SelectTrigger>
                <SelectContent className="field-dropdown">
                  <SelectItem value="all">Todas as ações</SelectItem>
                  {Object.entries(actionLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-gray-400 uppercase">Status</p>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full field-control">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent className="field-dropdown">
                  <SelectItem value="all">Todos os status</SelectItem>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-gray-400 uppercase">Busca</p>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Número, erro, mensagem"
                className="field-control"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-gray-400 uppercase">De</p>
              <Input
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                type="date"
                className="field-control"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-gray-400 uppercase">Até</p>
              <div className="flex gap-2">
                <Input
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  type="date"
                  className="field-control"
                />
                <Button
                  variant="outline"
                  className="subtle-action"
                  onClick={clearFilters}
                >
                  Limpar
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="card-premium-enhanced p-0 overflow-hidden mb-8">
          <div className="p-6 border-b border-cyan-500/10 flex items-center justify-between">
            <div>
              <h2 className="section-title">Timeline comportamental</h2>
              <p className="text-sm text-gray-400">Exibindo até 200 eventos semânticos por consulta.</p>
            </div>
          </div>

          {timelineQuery.isLoading ? (
            <div className="p-10 text-center text-gray-400">Carregando timeline...</div>
          ) : timelineEvents.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-white font-semibold mb-2">Nenhum evento de timeline encontrado</p>
              <p className="text-sm text-gray-400">Envie, receba, entre em grupo ou marque mensagens como lidas para validar a base.</p>
            </div>
          ) : (
            <Table className="text-white">
              <TableHeader>
                <TableRow className="border-cyan-500/10 hover:bg-transparent">
                  <TableHead className="px-4">Data</TableHead>
                  <TableHead>Chip</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Contexto</TableHead>
                  <TableHead>Evidência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timelineEvents.map((event: any) => {
                  const chip = chips.find((item) => item.id === event.chipId);
                  return (
                    <TableRow key={`timeline-${event.id}`} className="border-cyan-500/10 hover:bg-cyan-500/5">
                      <TableCell className="px-4 text-gray-300">
                        <div className="flex flex-col">
                          <span>{new Date(event.occurredAt).toLocaleDateString("pt-BR")}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(event.occurredAt).toLocaleTimeString("pt-BR")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          className="text-cyan-400 hover:text-cyan-300 text-left"
                          onClick={() => openChipLogs(String(event.chipId))}
                        >
                          {chip?.chipName || `Chip #${event.chipId}`}
                        </button>
                      </TableCell>
                      <TableCell className="text-gray-200">
                        {timelineEventLabels[event.eventType as TimelineEventType] || event.eventType}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {timelineSourceLabels[event.source] || event.source}
                      </TableCell>
                      <TableCell className="text-gray-300">{getTimelineContext(event)}</TableCell>
                      <TableCell className="max-w-[420px]">
                        <div className="whitespace-normal text-sm text-gray-300 leading-6">
                          {getTimelineEvidence(event)}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="card-premium-enhanced p-0 overflow-hidden">
          <div className="p-6 border-b border-cyan-500/10 flex items-center justify-between">
            <div>
              <h2 className="section-title">Eventos recentes</h2>
              <p className="text-sm text-gray-400">Exibindo até 150 registros por consulta.</p>
            </div>
          </div>

          {logsQuery.isLoading ? (
            <div className="p-10 text-center text-gray-400">Carregando logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-white font-semibold mb-2">Nenhum log encontrado</p>
              <p className="text-sm text-gray-400">Ajuste os filtros ou aguarde novas atividades dos chips.</p>
            </div>
          ) : (
            <Table className="text-white">
              <TableHeader>
                <TableRow className="border-cyan-500/10 hover:bg-transparent">
                  <TableHead className="px-4">Data</TableHead>
                  <TableHead>Chip</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const chip = chips.find((item) => item.id === log.chipId);
                  return (
                    <TableRow key={log.id} className="border-cyan-500/10 hover:bg-cyan-500/5">
                      <TableCell className="px-4 text-gray-300">
                        <div className="flex flex-col">
                          <span>{new Date(log.createdAt).toLocaleDateString("pt-BR")}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(log.createdAt).toLocaleTimeString("pt-BR")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          className="text-cyan-400 hover:text-cyan-300 text-left"
                          onClick={() => openChipLogs(String(log.chipId))}
                        >
                          {chip?.chipName || `Chip #${log.chipId}`}
                        </button>
                      </TableCell>
                      <TableCell className="text-gray-200">
                        {actionLabels[log.actionType as ActionType] || log.actionType}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(log.status as StatusType)}>
                          {statusLabels[log.status as StatusType] || log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {log.targetNumber || log.targetGroup || "-"}
                      </TableCell>
                      <TableCell className="max-w-[420px]">
                        <div className="whitespace-normal text-sm text-gray-300 leading-6">
                          {log.errorMessage || log.messageContent || "Sem detalhes"}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
