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
import { isAdminRole } from "@/lib/access";
import SystemSidebar from "@/components/SystemSidebar";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  Filter,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast as sonnerToast } from "sonner";
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

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [chipId, setChipId] = useState<string>("all");
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

  const reportQuery = trpc.chips.getReportData.useQuery(
    {
      chipId: chipId !== "all" ? Number(chipId) : undefined,
      actionType: actionType !== "all" ? (actionType as ActionType) : undefined,
      status: status !== "all" ? (status as StatusType) : undefined,
      search: search.trim() || undefined,
      dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
      dateTo: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
      limit: 1000,
    },
    {
      enabled: isAuthenticated,
    }
  );

  const logs = reportQuery.data?.logs ?? [];
  const summary = reportQuery.data?.summary;

  const chipLookup = useMemo(
    () => new Map(chips.map((chip) => [chip.id, chip.chipName])),
    [chips]
  );

  const clearFilters = () => {
    setChipId("all");
    setActionType("all");
    setStatus("all");
    setSearch("");
    setDateFrom("");
    setDateTo("");
  };

  const exportJson = () => {
    if (logs.length === 0) {
      sonnerToast.error("Não há dados para exportar.");
      return;
    }

    downloadTextFile(
      `relatorio-whatsapp-${Date.now()}.json`,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          filters: { chipId, actionType, status, search, dateFrom, dateTo },
          summary,
          logs,
        },
        null,
        2
      ),
      "application/json;charset=utf-8"
    );
    sonnerToast.success("Relatório JSON exportado.");
  };

  const exportCsv = () => {
    if (logs.length === 0) {
      sonnerToast.error("Não há dados para exportar.");
      return;
    }

    const headers = ["data", "chip", "acao", "status", "destino", "detalhes"];
    const rows = logs.map((log) => [
      new Date(log.createdAt).toISOString(),
      chipLookup.get(log.chipId) || `Chip #${log.chipId}`,
      actionLabels[log.actionType as ActionType] || log.actionType,
      log.status,
      log.targetNumber || log.targetGroup || "",
      (log.errorMessage || log.messageContent || "").replace(/\r?\n/g, " "),
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    downloadTextFile(`relatorio-whatsapp-${Date.now()}.csv`, csv, "text/csv;charset=utf-8");
    sonnerToast.success("Relatório CSV exportado.");
  };

  if (!isAuthenticated || !user) {
    return null;
  }

  const isAdmin = isAdminRole(user.role);

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
        <div className={isAdmin ? "system-layout" : ""}>
          {isAdmin ? <SystemSidebar system="marketing" /> : null}
          <div className={isAdmin ? "system-main" : ""}>
        <div className="page-hero md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-cyan-300 mb-3">
              {isAdmin ? "Central admin / relatórios" : "Área do usuário / relatórios"}
            </p>
            <h1 className="page-title mb-2">RELATÓRIOS DO SISTEMA</h1>
            <p className="page-subtitle">
              M13 Group • revise a operação filtrada e exporte eventos em `CSV` ou `JSON`.
            </p>
          </div>

          <Button className="btn-primary-modern" onClick={() => setLocation(isAdmin ? "/admin-systems" : "/workspace")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {isAdmin ? "Voltar à central admin" : "Voltar à área do usuário"}
          </Button>
        </div>

        <Card className="card-premium-enhanced p-6 mb-8">
          <div className={`status-banner ${logs.length > 0 ? "status-banner-ok" : "status-banner-warn"}`}>
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">
                  {logs.length > 0 ? "Relatório pronto para leitura e exportação" : "Relatório sem dados no filtro atual"}
                </p>
                <p className="text-sm text-gray-300 mt-1">
                  {logs.length > 0
                    ? "Revise o resumo, confira os chips mais ativos e depois exporte em CSV ou JSON."
                    : "Ajuste os filtros ou gere novas atividades antes de exportar."}
                </p>
              </div>
              <Badge variant={logs.length > 0 ? "secondary" : "outline"}>
                {logs.length > 0 ? "dados prontos" : "sem dados"}
              </Badge>
            </div>

            <div className="summary-grid mt-4">
              <div className="summary-pill">
                <p className="summary-pill-label">Eventos</p>
                <p className="summary-pill-value">{summary?.totalLogs ?? 0}</p>
              </div>
              <div className="summary-pill">
                <p className="summary-pill-label">Sucessos</p>
                <p className="summary-pill-value text-green-400">{summary?.successCount ?? 0}</p>
              </div>
              <div className="summary-pill">
                <p className="summary-pill-label">Falhas</p>
                <p className="summary-pill-value text-red-400">{summary?.failedCount ?? 0}</p>
              </div>
              <div className="summary-pill">
                <p className="summary-pill-label">Mensagens</p>
                <p className="summary-pill-value text-yellow-300">{summary?.messageSentCount ?? 0}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="card-premium-enhanced p-6 mb-8">
          <div className="flex items-center gap-2 mb-5">
            <Filter className="w-4 h-4 text-cyan-400" />
            <h2 className="section-title">Filtros do relatório</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
            <div className="space-y-2">
              <p className="text-xs text-gray-400 uppercase">Chip</p>
              <Select value={chipId} onValueChange={setChipId}>
                <SelectTrigger className="w-full field-control">
                  <SelectValue />
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
              <p className="text-xs text-gray-400 uppercase">Ação</p>
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger className="w-full field-control">
                  <SelectValue />
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="field-dropdown">
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="failed">Falha</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-gray-400 uppercase">Busca</p>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Mensagem, erro, número"
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
              <Input
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                type="date"
                className="field-control"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-5">
            <Button
              variant="outline"
              className="subtle-action"
              onClick={() => reportQuery.refetch()}
            >
              <Activity className="w-4 h-4 mr-2" />
              Atualizar relatório
            </Button>
            <Button
              variant="outline"
              className="subtle-action"
              onClick={clearFilters}
            >
              Limpar filtros
            </Button>
            <Button
              variant="outline"
              className="border-green-500/30 text-green-400 hover:bg-green-500/10"
              onClick={exportCsv}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
            <Button
              variant="outline"
              className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              onClick={exportJson}
            >
              <FileJson className="w-4 h-4 mr-2" />
              Exportar JSON
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="card-premium-enhanced p-5">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-cyan-400" />
              <div>
                <p className="text-xs uppercase text-gray-400">Eventos</p>
                <p className="text-2xl font-bold text-cyan-400">{summary?.totalLogs ?? 0}</p>
              </div>
            </div>
          </Card>
          <Card className="card-premium-enhanced p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
              <div>
                <p className="text-xs uppercase text-gray-400">Sucessos</p>
                <p className="text-2xl font-bold text-green-400">{summary?.successCount ?? 0}</p>
              </div>
            </div>
          </Card>
          <Card className="card-premium-enhanced p-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <div>
                <p className="text-xs uppercase text-gray-400">Falhas</p>
                <p className="text-2xl font-bold text-red-400">{summary?.failedCount ?? 0}</p>
              </div>
            </div>
          </Card>
          <Card className="card-premium-enhanced p-5">
            <div className="flex items-center gap-3">
              <Download className="w-6 h-6 text-yellow-400" />
              <div>
                <p className="text-xs uppercase text-gray-400">Mensagens</p>
                <p className="text-2xl font-bold text-yellow-400">{summary?.messageSentCount ?? 0}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6 mb-8">
          <Card className="card-premium-enhanced p-6">
            <h2 className="section-title">Ações mais frequentes</h2>
            <div className="space-y-3">
              {summary?.actionBreakdown?.length ? (
                summary.actionBreakdown.map((item) => (
                  <div key={item.actionType} className="flex items-center justify-between border-b border-cyan-500/10 pb-3 last:border-0">
                    <span className="text-gray-300">
                      {actionLabels[item.actionType as ActionType] || item.actionType}
                    </span>
                    <Badge variant="outline">{item.count}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">Nenhum dado disponível.</p>
              )}
            </div>
          </Card>

          <Card className="card-premium-enhanced p-6">
            <h2 className="section-title">Chips com mais atividade</h2>
            <div className="space-y-3">
              {summary?.chipBreakdown?.length ? (
                summary.chipBreakdown.map((item) => (
                  <div key={item.chipId} className="flex items-center justify-between border-b border-cyan-500/10 pb-3 last:border-0">
                    <span className="text-gray-300">{chipLookup.get(item.chipId) || `Chip #${item.chipId}`}</span>
                    <Badge variant="outline">{item.count}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">Nenhum dado disponível.</p>
              )}
            </div>
          </Card>
        </div>

        <Card className="card-premium-enhanced p-0 overflow-hidden">
          <div className="p-6 border-b border-cyan-500/10">
            <h2 className="section-title">Base do relatório</h2>
            <p className="text-sm text-gray-400">Até 1000 eventos filtrados para auditoria e exportação.</p>
          </div>

          {reportQuery.isLoading ? (
            <div className="p-10 text-center text-gray-400">Gerando relatório...</div>
          ) : logs.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-white font-semibold mb-2">Nenhum evento para este relatório</p>
              <p className="text-sm text-gray-400">Ajuste os filtros ou gere novas atividades no sistema.</p>
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
                {logs.slice(0, 20).map((log) => (
                  <TableRow key={log.id} className="border-cyan-500/10 hover:bg-cyan-500/5">
                    <TableCell className="px-4 text-gray-300">
                      <div className="flex flex-col">
                        <span>{new Date(log.createdAt).toLocaleDateString("pt-BR")}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(log.createdAt).toLocaleTimeString("pt-BR")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{chipLookup.get(log.chipId) || `Chip #${log.chipId}`}</TableCell>
                    <TableCell>{actionLabels[log.actionType as ActionType] || log.actionType}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === "success" ? "secondary" : log.status === "failed" ? "destructive" : "outline"}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.targetNumber || log.targetGroup || "-"}</TableCell>
                    <TableCell className="max-w-[420px]">
                      <div className="whitespace-normal text-sm text-gray-300 leading-6">
                        {log.errorMessage || log.messageContent || "Sem detalhes"}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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
