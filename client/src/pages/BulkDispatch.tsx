import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import SystemSidebar from "@/components/SystemSidebar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowLeft, Eye, RefreshCw, Rocket, Save, Send, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast as sonnerToast } from "sonner";
import { useLocation } from "wouter";

type DispatchProfile = "suave" | "normal" | "ultra";
type DispatchTargetType = "number" | "group" | "list";
type RotationStrategy = "round_robin" | "random" | "least_usage";

const operationalRuleFallback: Record<
  DispatchProfile,
  Record<"number" | "group", { cooldownMinutes: number; maxPerHour: number; maxPerDay: number }>
> = {
  suave: {
    number: { cooldownMinutes: 30, maxPerHour: 1, maxPerDay: 4 },
    group: { cooldownMinutes: 45, maxPerHour: 1, maxPerDay: 3 },
  },
  normal: {
    number: { cooldownMinutes: 20, maxPerHour: 2, maxPerDay: 6 },
    group: { cooldownMinutes: 35, maxPerHour: 1, maxPerDay: 4 },
  },
  ultra: {
    number: { cooldownMinutes: 12, maxPerHour: 3, maxPerDay: 10 },
    group: { cooldownMinutes: 25, maxPerHour: 2, maxPerDay: 6 },
  },
};

export default function BulkDispatch() {
  const { isAuthenticated, loading } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "/login",
  });
  const [location, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: chips = [], isLoading } = trpc.chips.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: limitsData } = trpc.auth.getMyPlanLimits.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: savedTemplates = [] } = trpc.operations.listTemplates.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: savedTargets = [] } = trpc.operations.listTargets.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: operationalRules } = trpc.operations.getOperationalRules.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: recentExecutionJobs = [] } = trpc.chips.listExecutionJobs.useQuery(
    { limit: 8 },
    { enabled: isAuthenticated }
  );
  const { data: savedCampaigns = [] } = trpc.chips.listMarketingCampaigns.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: marketingAnalytics } = trpc.chips.getMarketingAnalytics.useQuery(
    { limit: 80 },
    { enabled: isAuthenticated }
  );
  const { data: suppressionEntries = [] } = trpc.chips.listMarketingSuppression.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const { data: selectedJobDetail, isFetching: isLoadingSelectedJob } = trpc.chips.getExecutionJob.useQuery(
    { jobId: selectedJobId ?? 0 },
    { enabled: isAuthenticated && selectedJobId !== null }
  );
  const executeMutation = trpc.chips.executeBulkDispatch.useMutation();
  const saveCampaignMutation = trpc.chips.saveMarketingCampaign.useMutation();
  const deleteCampaignMutation = trpc.chips.deleteMarketingCampaign.useMutation();
  const addSuppressionMutation = trpc.chips.addMarketingSuppression.useMutation();
  const removeSuppressionMutation = trpc.chips.removeMarketingSuppression.useMutation();

  const [selectedChipIds, setSelectedChipIds] = useState<number[]>([]);
  const [targetType, setTargetType] = useState<DispatchTargetType>("number");
  const [targetsText, setTargetsText] = useState("");
  const [targetEntries, setTargetEntries] = useState<Array<{ value: string; name?: string; tag?: string }>>([]);
  const [messageTemplate, setMessageTemplate] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedSavedTargetId, setSelectedSavedTargetId] = useState<string>("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("all");
  const [profile, setProfile] = useState<DispatchProfile>("normal");
  const [intervalSeconds, setIntervalSeconds] = useState(5);
  const [maxMessagesPerTarget, setMaxMessagesPerTarget] = useState(1);
  const [rotationStrategy, setRotationStrategy] = useState<RotationStrategy>("round_robin");
  const [rotationLookbackHours, setRotationLookbackHours] = useState(24);
  const [campaignName, setCampaignName] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [maxRetries, setMaxRetries] = useState(2);
  const [retryDelayMinutes, setRetryDelayMinutes] = useState(30);
  const [timeWindowStart, setTimeWindowStart] = useState("08:00");
  const [timeWindowEnd, setTimeWindowEnd] = useState("20:00");
  const [suppressionValue, setSuppressionValue] = useState("");
  const [suppressionReason, setSuppressionReason] = useState("");
  const [suppressionTag, setSuppressionTag] = useState("");
  const [dispatchResults, setDispatchResults] = useState<any[] | null>(null);
  const { data: selectedCampaignHistory } = trpc.chips.getMarketingCampaignHistory.useQuery(
    { campaignId: selectedCampaignId, limit: 30 },
    { enabled: isAuthenticated && !!selectedCampaignId }
  );
  const [previewResult, setPreviewResult] = useState<{
    valid: boolean;
    error?: string;
    estimatedMessages: number;
    estimatedDuration: number;
    checks: Array<{ key: string; label: string; passed: boolean; detail: string }>;
    warnings: string[];
    distributionPreview?: Array<{ chipId: number; targetCount: number; plannedMessages: number; sampleTargets: string[] }>;
  } | null>(null);

  const activeChips = chips.filter((chip) => chip.status === "conectado" || chip.status === "maturando");
  const currentPlan = limitsData?.plan;
  const currentSubscription = limitsData?.subscription;
  const dispatchTargets = useMemo(
    () => savedTargets.filter((target) => target.targetType === "number" || target.targetType === "group"),
    [savedTargets]
  );
  const dispatchTemplates = useMemo(
    () => savedTemplates.filter((template) => template.category === "dispatch" || template.category === "general"),
    [savedTemplates]
  );
  const activeDispatchTemplateCount = useMemo(
    () => dispatchTemplates.filter((template) => Boolean(template.isActive)).length,
    [dispatchTemplates]
  );

  const availableTags = useMemo(
    () => Array.from(new Set(targetEntries.map((entry) => entry.tag).filter(Boolean) as string[])).sort(),
    [targetEntries]
  );
  const filteredTargetEntries = useMemo(() => {
    if (!targetEntries.length || selectedTagFilter === "all") return targetEntries;
    return targetEntries.filter((entry) => entry.tag === selectedTagFilter);
  }, [selectedTagFilter, targetEntries]);
  const sourceTargetText = useMemo(() => {
    if (filteredTargetEntries.length > 0) {
      return filteredTargetEntries.map((entry) => entry.value).join("\n");
    }
    return targetsText;
  }, [filteredTargetEntries, targetsText]);

  const parsedTargetDiagnostics = useMemo(() => {
    const rawItems = sourceTargetText
      .split(/\r?\n|,|;/)
      .map((item) => item.trim())
      .filter(Boolean);
    const normalizedSet = new Set<string>();
    const duplicates = new Set<string>();
    const invalid: string[] = [];
    const valid: string[] = [];
    const numberRegex = /^\d{10,15}$/;

    rawItems.forEach((item) => {
      const normalized = item.replace(/[^\dA-Za-z@\-_.]/g, "");
      const candidate = targetType === "group" ? item : item.replace(/\D/g, "");
      const isValid = targetType === "group" ? item.length >= 5 : numberRegex.test(candidate);

      if (!isValid) {
        invalid.push(item);
        return;
      }

      const dedupeKey = targetType === "group" ? normalized || item : candidate;
      if (normalizedSet.has(dedupeKey)) {
        duplicates.add(dedupeKey);
        return;
      }

      normalizedSet.add(dedupeKey);
      valid.push(targetType === "group" ? item : candidate);
    });

    return {
      rawCount: rawItems.length,
      valid,
      invalid,
      duplicates: Array.from(duplicates),
    };
  }, [sourceTargetText, targetType]);

  const parsedTargets = parsedTargetDiagnostics.valid;
  const invalidTargetCount = parsedTargetDiagnostics.invalid.length;
  const duplicateTargetCount = parsedTargetDiagnostics.duplicates.length;
  const averageTargetsPerChip = selectedChipIds.length > 0 ? Math.ceil(parsedTargets.length / selectedChipIds.length) : 0;
  const taggedTargetCount = targetEntries.filter((entry) => entry.tag).length;
  const namedTargetCount = targetEntries.filter((entry) => entry.name).length;
  const suppressedTargetCount = useMemo(() => {
    if (!suppressionEntries.length || targetType === "group") return 0;
    const set = new Set(suppressionEntries.map((entry) => entry.value));
    return parsedTargets.filter((target) => set.has(target.replace(/\D/g, ""))).length;
  }, [parsedTargets, suppressionEntries, targetType]);
  const rotationLabel =
    rotationStrategy === "round_robin"
      ? "Round-robin"
      : rotationStrategy === "least_usage"
        ? "Menos uso"
        : "Aleatória";
  const campaignMetrics = useMemo(() => {
    if (!dispatchResults?.length) return null;
    const suspicionRegex = /(bloque|block|ban|forbidden|not[- ]authorized|401|403|429|rate)/i;
    let delivered = 0;
    let failed = 0;
    let skipped = 0;
    let suspicion = 0;

    for (const result of dispatchResults) {
      delivered += result.successCount ?? 0;
      failed += result.failureCount ?? 0;
      skipped += result.skippedCount ?? 0;
      for (const item of result.results ?? []) {
        if (item?.error && suspicionRegex.test(String(item.error))) {
          suspicion += 1;
        }
      }
    }

    const processed = delivered + failed + skipped;
    return {
      processed,
      delivered,
      failed,
      skipped,
      suspicion,
      deliveryRate: processed > 0 ? (delivered / processed) * 100 : 0,
    };
  }, [dispatchResults]);
  const campaignChartData = useMemo(
    () =>
      (marketingAnalytics?.campaigns ?? []).slice(0, 6).map((campaign) => ({
        name: campaign.campaignName.length > 18 ? `${campaign.campaignName.slice(0, 18)}…` : campaign.campaignName,
        envios: campaign.totalMessagesSent,
        falhas: campaign.failureCount,
        suspeitas: campaign.suspicionCount,
      })),
    [marketingAnalytics]
  );
  const selectedCampaignRecord = useMemo(
    () => savedCampaigns.find((campaign) => campaign.id === selectedCampaignId),
    [selectedCampaignId, savedCampaigns]
  );
  const dispatchSetupReady =
    activeChips.length > 0 &&
    (Boolean(messageTemplate.trim()) || activeDispatchTemplateCount > 0) &&
    (parsedTargets.length > 0 || dispatchTargets.length > 0);
  const currentOperationalRule =
    operationalRules?.dispatch?.[profile]?.[targetType === "group" ? "group" : "number"] ??
    operationalRuleFallback[profile][targetType === "group" ? "group" : "number"];

  useEffect(() => {
    const selectedChipId = new URLSearchParams(window.location.search).get("chipId");
    if (!selectedChipId) return;

    const chipId = Number(selectedChipId);
    if (!Number.isNaN(chipId)) {
      setSelectedChipIds((current) => (current.includes(chipId) ? current : [...current, chipId]));
    }
  }, [location]);

  const toggleChip = (chipId: number, checked: boolean) => {
    setSelectedChipIds((current) =>
      checked ? [...current, chipId] : current.filter((id) => id !== chipId)
    );
  };

  const handlePreview = async () => {
    if (selectedChipIds.length === 0) {
      sonnerToast.error("Selecione pelo menos um chip.");
      return;
    }
    if (parsedTargets.length === 0) {
      sonnerToast.error("Informe ao menos um alvo para o disparo.");
      return;
    }

    try {
      const preview = await utils.chips.previewBulkDispatch.fetch({
        chipIds: selectedChipIds,
        targetType,
        targets: parsedTargets,
        maxMessagesPerTarget,
        messageTemplate: messageTemplate.trim() || undefined,
        intervalSeconds,
        rotationStrategy,
        rotationLookbackHours,
      });
      setPreviewResult(preview);
      sonnerToast.success("Pré-validação concluída.");
    } catch (error: any) {
      sonnerToast.error(error?.message || "Falha ao validar disparo.");
    }
  };

  const handleExecute = async () => {
    const preview = previewResult;
    if (!preview?.valid) {
      sonnerToast.error(preview?.error || "Valide o disparo antes de executar.");
      return;
    }

    const clientTraceId = `bulk-dispatch-client-${Date.now()}`;
    try {
      console.log("[6] Cliente enviando executeBulkDispatch", {
        clientTraceId,
        chipIds: selectedChipIds,
        targetType,
        targetsCount: parsedTargets.length,
        messageLength: messageTemplate.trim().length,
      });
      const result = await executeMutation.mutateAsync({
        chipIds: selectedChipIds,
        targetType,
        targets: parsedTargets,
        messageTemplate: messageTemplate.trim(),
        templateId: selectedTemplateId ? Number(selectedTemplateId) : undefined,
        profile,
        intervalSeconds,
        maxMessagesPerTarget,
        rotationStrategy,
        rotationLookbackHours,
        campaignId: selectedCampaignId || undefined,
        campaignName: campaignName.trim() || undefined,
      });
      console.log("[6] Cliente recebeu sucesso");
      console.dir(
        {
          clientTraceId,
          result,
        },
        { depth: null }
      );
      setDispatchResults(result);
      const firstJobId = result.find((item: any) => item.executionJobId)?.executionJobId;
      if (firstJobId) {
        setSelectedJobId(firstJobId);
      }
      await utils.chips.listExecutionJobs.invalidate();
      await utils.chips.getMarketingAnalytics.invalidate();
      if (selectedJobId) {
        await utils.chips.getExecutionJob.invalidate({ jobId: selectedJobId });
      }
      sonnerToast.success("Disparo em massa iniciado com sucesso.");
    } catch (error: any) {
      console.log("[6] Cliente recebeu erro");
      console.dir(
        {
          clientTraceId,
          error,
          message: error?.message,
          data: error?.data,
          shape: error?.shape,
          cause: error?.cause,
        },
        { depth: null }
      );
      sonnerToast.error(error?.message || "Falha ao executar disparo.");
    }
  };

  const applySavedTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = dispatchTemplates.find((item) => String(item.id) === templateId);
    if (!template) return;
    setMessageTemplate(template.content);
    sonnerToast.success("Template aplicado ao disparo.");
  };

  const applySavedTarget = (targetId: string) => {
    setSelectedSavedTargetId(targetId);
    setSelectedTagFilter("all");
    const target = dispatchTargets.find((item) => String(item.id) === targetId);
    if (!target) return;
    setTargetEntries([]);
    setTargetsText(target.targetValue);
    setTargetType(target.targetType === "group" ? "group" : "number");
    sonnerToast.success("Target aplicado ao disparo.");
  };

  const handleTargetsFileUpload = async (file?: File | null) => {
    if (!file) return;
    const content = await file.text();
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const header = lines[0]?.toLowerCase() || "";

    if (header.includes("numero") || header.includes("number")) {
      const rows = lines.slice(1);
      const entries = rows
        .map((row) => row.split(","))
        .map((columns) => ({
          value: (columns[0] || "").replace(/\D/g, ""),
          name: columns[1]?.trim() || undefined,
          tag: columns[2]?.trim() || undefined,
        }))
        .filter((entry) => entry.value.length > 0) as Array<{ value: string; name?: string; tag?: string }>;

      setTargetEntries(entries);
      setSelectedTagFilter("all");
      setTargetsText(entries.map((entry) => entry.value).join("\n"));
      sonnerToast.success("CSV carregado com colunas numero,nome,tag.");
      return;
    }

    setTargetEntries([]);
    setSelectedTagFilter("all");
    setTargetsText(content);
    sonnerToast.success("Lista carregada com sucesso.");
  };

  const handleSaveCampaign = async () => {
    if (!campaignName.trim()) {
      sonnerToast.error("Dê um nome para a campanha.");
      return;
    }
    if (selectedChipIds.length === 0) {
      sonnerToast.error("Selecione pelo menos um chip.");
      return;
    }

    await saveCampaignMutation.mutateAsync({
      id: selectedCampaignId || undefined,
      name: campaignName.trim(),
      targetType,
      targetsText,
      targetEntries,
      selectedChipIds,
      messageTemplate,
      templateId: selectedTemplateId ? Number(selectedTemplateId) : null,
      profile,
      intervalSeconds,
      maxMessagesPerTarget,
      rotationStrategy,
      rotationLookbackHours,
      selectedTagFilter: selectedTagFilter === "all" ? undefined : selectedTagFilter,
      scheduleEnabled,
      scheduleTime,
      maxRetries,
      retryDelayMinutes,
      timeWindowStart,
      timeWindowEnd,
    });
    await utils.chips.listMarketingCampaigns.invalidate();
    await utils.chips.getMarketingAnalytics.invalidate();
    sonnerToast.success("Campanha salva com sucesso.");
  };

  const handleApplyCampaign = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    const campaign = savedCampaigns.find((item) => item.id === campaignId);
    if (!campaign) return;

    setCampaignName(campaign.name);
    setTargetType(campaign.targetType as DispatchTargetType);
    setTargetsText(campaign.targetsText);
    setTargetEntries(
      (campaign.targetEntries || []).filter(
        (entry) => typeof entry?.value === "string" && entry.value.length > 0,
      ) as Array<{ value: string; name?: string; tag?: string }>,
    );
    setSelectedChipIds(campaign.selectedChipIds || []);
    setMessageTemplate(campaign.messageTemplate || "");
    setSelectedTemplateId(campaign.templateId ? String(campaign.templateId) : "");
    setProfile(campaign.profile as DispatchProfile);
    setIntervalSeconds(campaign.intervalSeconds);
    setMaxMessagesPerTarget(campaign.maxMessagesPerTarget);
    setRotationStrategy(campaign.rotationStrategy as RotationStrategy);
    setRotationLookbackHours(campaign.rotationLookbackHours || 24);
    setSelectedTagFilter(campaign.selectedTagFilter || "all");
    setScheduleEnabled(Boolean(campaign.scheduleEnabled));
    setScheduleTime(campaign.scheduleTime || "09:00");
    setMaxRetries(campaign.maxRetries ?? 2);
    setRetryDelayMinutes(campaign.retryDelayMinutes ?? 30);
    setTimeWindowStart(campaign.timeWindowStart || "08:00");
    setTimeWindowEnd(campaign.timeWindowEnd || "20:00");
    sonnerToast.success("Campanha aplicada.");
  };

  const handleDeleteCampaign = async () => {
    if (!selectedCampaignId) {
      sonnerToast.error("Selecione uma campanha salva.");
      return;
    }

    await deleteCampaignMutation.mutateAsync({ campaignId: selectedCampaignId });
    await utils.chips.listMarketingCampaigns.invalidate();
    setSelectedCampaignId("");
    sonnerToast.success("Campanha removida.");
  };

  const handleAddSuppression = async () => {
    if (!suppressionValue.trim()) {
      sonnerToast.error("Informe um número para suprimir.");
      return;
    }

    await addSuppressionMutation.mutateAsync({
      value: suppressionValue,
      reason: suppressionReason || undefined,
      tag: suppressionTag || undefined,
    });
    await utils.chips.listMarketingSuppression.invalidate();
    setSuppressionValue("");
    setSuppressionReason("");
    setSuppressionTag("");
    sonnerToast.success("Número adicionado à lista de bloqueio.");
  };

  const handleRemoveSuppression = async (suppressionId: string) => {
    await removeSuppressionMutation.mutateAsync({ suppressionId });
    await utils.chips.listMarketingSuppression.invalidate();
    sonnerToast.success("Número removido da lista de bloqueio.");
  };

  const handleExportCampaignResults = () => {
    const rows: string[] = ["campanha,jobId,chipId,target,status,mensagem,error"];

    if (selectedCampaignHistory?.jobs?.length) {
      selectedCampaignHistory.jobs.forEach((entry) => {
        entry.attempts.forEach((attempt) => {
          rows.push(
            [
              `"${(entry.payload?.campaignName || campaignName || `Campanha ${entry.job.id}`).replace(/"/g, '""')}"`,
              entry.job.id,
              entry.job.chipId,
              `"${String(attempt.targetValue || "").replace(/"/g, '""')}"`,
              attempt.status,
              `"${String(attempt.messageContent || "").replace(/"/g, '""')}"`,
              `"${String(attempt.errorMessage || "").replace(/"/g, '""')}"`,
            ].join(",")
          );
        });
      });
    } else if (dispatchResults?.length) {
      dispatchResults.forEach((result) => {
        (result.results || []).forEach((item: any) => {
          rows.push(
            [
              `"${(campaignName || "Campanha").replace(/"/g, '""')}"`,
              result.executionJobId ?? "",
              result.chipId,
              `"${String(item.target || "").replace(/"/g, '""')}"`,
              item.skipped ? "skipped" : item.success ? "success" : "failed",
              item.messagesSent ?? "",
              `"${String(item.error || "").replace(/"/g, '""')}"`,
            ].join(",")
          );
        });
      });
    } else {
      sonnerToast.error("Não há resultado para exportar.");
      return;
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(campaignName || "campanha").replace(/[^\w\-]+/g, "_")}_resultado.csv`;
    link.click();
    URL.revokeObjectURL(url);
    sonnerToast.success("Resultado exportado em CSV.");
  };

  const handleExportPremiumReport = () => {
    if (!selectedCampaignRecord && !campaignName.trim()) {
      sonnerToast.error("Selecione ou nomeie uma campanha para gerar o relatório.");
      return;
    }

    const reportTitle = selectedCampaignRecord?.name || campaignName || "Campanha";
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório ${reportTitle}</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; background:#07111f; color:#e2e8f0; margin:0; padding:32px; }
    .wrap { max-width: 1100px; margin:0 auto; }
    .hero { background: linear-gradient(135deg,#0f172a,#082f49); border:1px solid rgba(148,163,184,.18); border-radius:20px; padding:24px; margin-bottom:24px; }
    .grid { display:grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap:16px; margin:20px 0; }
    .card { background:rgba(15,23,42,.7); border:1px solid rgba(148,163,184,.14); border-radius:16px; padding:16px; }
    .muted { color:#94a3b8; font-size:12px; text-transform:uppercase; letter-spacing:.08em; }
    .value { font-size:28px; font-weight:700; margin-top:8px; }
    table { width:100%; border-collapse: collapse; margin-top:16px; }
    th,td { border-bottom:1px solid rgba(148,163,184,.12); text-align:left; padding:12px; font-size:14px; }
    th { color:#94a3b8; font-weight:600; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <div class="muted">Relatório premium</div>
      <h1>${reportTitle}</h1>
      <p>Resumo executivo da campanha, com métricas operacionais, risco por chip e status de agendamento.</p>
    </div>
    <div class="grid">
      <div class="card"><div class="muted">Alvos válidos</div><div class="value">${parsedTargets.length}</div></div>
      <div class="card"><div class="muted">Suprimidos</div><div class="value">${suppressedTargetCount}</div></div>
      <div class="card"><div class="muted">Entrega</div><div class="value">${campaignMetrics ? campaignMetrics.deliveryRate.toFixed(1) : "0"}%</div></div>
      <div class="card"><div class="muted">Status agenda</div><div class="value">${selectedCampaignRecord?.scheduleEnabled ? "Ativa" : "Inativa"}</div></div>
    </div>
    <div class="card">
      <div class="muted">Risco por chip</div>
      <table>
        <thead><tr><th>Chip</th><th>Envios</th><th>Suspeitas</th><th>Risco</th></tr></thead>
        <tbody>
          ${(marketingAnalytics?.chips ?? []).slice(0, 8).map((chip) => `<tr><td>#${chip.chipId}</td><td>${chip.totalMessagesSent}</td><td>${chip.suspicionCount}</td><td>${chip.riskScore}/100</td></tr>`).join("") || "<tr><td colspan='4'>Sem dados suficientes.</td></tr>"}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportTitle.replace(/[^\w\-]+/g, "_")}_relatorio.html`;
    link.click();
    URL.revokeObjectURL(url);
    sonnerToast.success("Relatório premium exportado em HTML.");
  };

  const getJobBadgeVariant = (status: string) => {
    if (status === "completed") return "secondary" as const;
    if (status === "failed") return "destructive" as const;
    return "outline" as const;
  };
  const getExecutionStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "pendente",
      running: "em andamento",
      completed: "concluída",
      failed: "falhou",
      partial: "parcial",
      success: "sucesso",
      skipped: "pulado",
    };
    return labels[status] ?? status;
  };
  const getAttemptPresentation = (attempt: any) => {
    if (attempt.errorMessage?.startsWith("SKIPPED_RULE:")) {
      return {
        label: "pulado",
        variant: "outline" as const,
        reason: attempt.errorMessage.replace(/^SKIPPED_RULE:/, "").trim(),
      };
    }
    return {
      label: getExecutionStatusLabel(attempt.status),
      variant: attempt.status === "success" ? ("secondary" as const) : attempt.status === "failed" ? ("destructive" as const) : ("outline" as const),
      reason: attempt.errorMessage,
    };
  };

  if (loading) {
    return (
      <div className="app-shell bg-app-grid flex items-center justify-center">
        <Card className="card-premium-enhanced p-8 text-center">
          <p className="text-cyan-400 font-semibold">Carregando disparos...</p>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="app-shell bg-app-grid">
      <div className="page-container">
        <div className="system-layout">
          <SystemSidebar system="marketing" />
          <div>
        <div className="system-switcher">
          <button
            onClick={() => setLocation("/admin-systems")}
            className="system-switcher-button system-switcher-button-active-cyan"
          >
            Central admin
          </button>
          <button
            onClick={() => setLocation("/dashboard")}
            className="system-switcher-button"
          >
            Sistema 1 • Maturação
          </button>
          <button
            onClick={() => setLocation("/bulk-dispatch")}
            className="system-switcher-button system-switcher-button-active-fuchsia"
          >
            Sistema 2 • Marketing
          </button>
        </div>
        <p className="page-breadcrumb page-breadcrumb-fuchsia">Central admin / sistema 2 / marketing e disparo</p>

        <div className="page-hero md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="page-title mb-2">CENTRAL DE MARKETING E DISPARO</h1>
            <p className="page-subtitle">
              Sistema 2 do produto: campanhas, fila, agenda e disparo de marketing independentes da maturação.
            </p>
          </div>

          <Button className="bg-fuchsia-500 hover:bg-fuchsia-600 text-black font-semibold" onClick={() => setLocation("/admin-systems")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar à central admin
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="card-premium-enhanced p-5">
            <div className="flex items-center gap-3">
              <Smartphone className="w-6 h-6 text-cyan-400" />
              <div>
                <p className="text-xs uppercase text-gray-400">Chips ativos</p>
                <p className="text-2xl font-bold text-cyan-400">{activeChips.length}</p>
              </div>
            </div>
          </Card>
          <Card className="card-premium-enhanced p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-blue-400" />
              <div>
                <p className="text-xs uppercase text-gray-400">Mensagens do plano</p>
                <p className="text-2xl font-bold text-blue-400">
                  {currentPlan?.maxMessagesPerMonth === -1 ? "Ilimitado" : currentPlan?.maxMessagesPerMonth ?? 0}
                </p>
              </div>
            </div>
          </Card>
          <Card className="card-premium-enhanced p-5">
            <div className="flex items-center gap-3">
              <Rocket className="w-6 h-6 text-yellow-400" />
              <div>
                <p className="text-xs uppercase text-gray-400">Alcance válido</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {parsedTargets.length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="card-premium-enhanced p-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-rose-400" />
              <div>
                <p className="text-xs uppercase text-gray-400">Suprimidos</p>
                <p className="text-2xl font-bold text-rose-300">{suppressedTargetCount}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="card-premium-enhanced p-6 mb-6">
          <div className={`status-banner ${dispatchSetupReady ? "status-banner-ok" : "status-banner-warn"}`}>
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">
                  {dispatchSetupReady ? "Disparo pronto para validar" : "Configuração do disparo precisa de ajuste"}
                </p>
                <p className="text-sm text-gray-300 mt-1">
                  {dispatchSetupReady
                    ? "A campanha já tem base suficiente para validar alcance, distribuir números entre chips e disparar com mais previsibilidade."
                    : "Antes de executar, garanta chips conectados, uma mensagem ou biblioteca ativa e uma lista válida de números ou grupos."}
                </p>
              </div>
              <Badge variant={dispatchSetupReady ? "secondary" : "outline"}>
                {dispatchSetupReady ? "pronto para validar" : "configuração pendente"}
              </Badge>
            </div>
            <div className="summary-grid mt-4">
              <div className="summary-pill">
                <p className="summary-pill-label">Chips ativos</p>
                <p className="summary-pill-value">{activeChips.length}</p>
              </div>
              <div className="summary-pill">
                <p className="summary-pill-label">Templates ativos</p>
                <p className="summary-pill-value">{activeDispatchTemplateCount}</p>
              </div>
              <div className="summary-pill">
                <p className="summary-pill-label">Listas salvas</p>
                <p className="summary-pill-value">{dispatchTargets.length}</p>
              </div>
              <div className="summary-pill">
                <p className="summary-pill-label">Destinatários válidos</p>
                <p className="summary-pill-value">{parsedTargets.length}</p>
              </div>
              <div className="summary-pill">
                <p className="summary-pill-label">Campanha</p>
                <p className="summary-pill-value">{campaignName.trim() || "Sem nome"}</p>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
          <Card className="card-premium-enhanced p-6">
            <h2 className="section-title">Configuração do disparo</h2>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome da campanha</Label>
                  <Input
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="field-control"
                    placeholder="Ex: Oferta de reativação • junho"
                  />
                </div>
                <div className="surface-item-compact">
                  <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-1">Lógica atual</p>
                  <p className="text-sm text-gray-300">Sistema comercial independente: campanha, fila, agenda, lista de bloqueio e análises próprias.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3">
                <div className="space-y-2">
                  <Label>Campanhas salvas</Label>
                  <Select value={selectedCampaignId} onValueChange={handleApplyCampaign}>
                    <SelectTrigger className="w-full field-control">
                      <SelectValue placeholder="Carregar campanha salva" />
                    </SelectTrigger>
                    <SelectContent className="field-dropdown">
                      {savedCampaigns.length === 0 ? (
                        <SelectItem value="no-campaign" disabled>
                          Nenhuma campanha salva
                        </SelectItem>
                      ) : (
                        savedCampaigns.map((campaign) => (
                          <SelectItem key={campaign.id} value={campaign.id}>
                            {campaign.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" className="subtle-action self-end" onClick={handleSaveCampaign}>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </Button>
                <Button variant="outline" className="subtle-action self-end" onClick={handleDeleteCampaign} disabled={!selectedCampaignId}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remover
                </Button>
              </div>
              {selectedCampaignRecord ? (
                <div className="surface-item-compact">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Status da campanha selecionada</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {selectedCampaignRecord.scheduleEnabled
                          ? `Agendada para ${selectedCampaignRecord.scheduleTime || "--:--"} • próxima execução ${selectedCampaignRecord.nextRunAt ? new Date(selectedCampaignRecord.nextRunAt).toLocaleString("pt-BR") : "pendente"}`
                          : "Sem agendamento ativo"}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Fila: {selectedCampaignRecord.queueStatus || "finalizada"} • Novas tentativas: {selectedCampaignRecord.retryCount ?? 0}/{selectedCampaignRecord.maxRetries ?? maxRetries}
                      </p>
                    </div>
                    <Badge variant={selectedCampaignRecord.autoPauseReason ? "destructive" : "secondary"}>
                      {selectedCampaignRecord.autoPauseReason ? "pausada por risco" : selectedCampaignRecord.queueStatus || "normal"}
                    </Badge>
                  </div>
                  {selectedCampaignRecord.autoPauseReason ? (
                    <p className="text-xs text-rose-300 mt-3">{selectedCampaignRecord.autoPauseReason}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="surface-item-compact">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Agendamento da campanha</p>
                    <p className="text-xs text-slate-400 mt-1">Sistema de marketing separado da maturação. Aqui você agenda só campanhas de disparo.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={scheduleEnabled} onCheckedChange={(checked) => setScheduleEnabled(checked === true)} />
                    <span className="text-sm text-slate-300">Ativar</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
                  <div className="space-y-2">
                    <Label>Horário diário</Label>
                    <Input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="field-control"
                      disabled={!scheduleEnabled}
                    />
                  </div>
                  <div className="surface-item-compact">
                    <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-1">Próxima execução</p>
                    <p className="text-sm text-white">
                      {selectedCampaignRecord?.nextRunAt
                        ? new Date(selectedCampaignRecord.nextRunAt).toLocaleString("pt-BR")
                        : scheduleEnabled
                          ? "Será calculada após salvar a campanha"
                          : "Agendamento desativado"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label>Tentativas extras</Label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={maxRetries}
                      onChange={(e) => setMaxRetries(Number(e.target.value))}
                      className="field-control"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Intervalo entre tentativas</Label>
                    <Input
                      type="number"
                      min={5}
                      max={1440}
                      value={retryDelayMinutes}
                      onChange={(e) => setRetryDelayMinutes(Number(e.target.value))}
                      className="field-control"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Janela inicial</Label>
                    <Input
                      type="time"
                      value={timeWindowStart}
                      onChange={(e) => setTimeWindowStart(e.target.value)}
                      className="field-control"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Janela final</Label>
                    <Input
                      type="time"
                      value={timeWindowEnd}
                      onChange={(e) => setTimeWindowEnd(e.target.value)}
                      className="field-control"
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-300 mb-3">Chips selecionados</p>
                {isLoading ? (
                  <p className="text-sm text-gray-400">Carregando chips...</p>
                ) : activeChips.length === 0 ? (
                  <p className="text-sm text-red-400">Nenhum chip conectado disponível para disparo.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activeChips.map((chip) => (
                      <label key={chip.id} className="surface-item-compact flex items-center gap-3 cursor-pointer">
                        <Checkbox
                          checked={selectedChipIds.includes(chip.id)}
                          onCheckedChange={(checked) => toggleChip(chip.id, checked === true)}
                        />
                        <div>
                          <p className="text-white font-medium">{chip.chipName}</p>
                          <p className="text-xs text-gray-400 capitalize">{chip.status}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de alvo</Label>
                  <Select value={targetType} onValueChange={(value) => setTargetType(value as DispatchTargetType)}>
                    <SelectTrigger className="w-full field-control">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="field-dropdown">
                      <SelectItem value="number">Números</SelectItem>
                      <SelectItem value="group">Grupos</SelectItem>
                      <SelectItem value="list">Lista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Perfil</Label>
                  <Select value={profile} onValueChange={(value) => setProfile(value as DispatchProfile)}>
                    <SelectTrigger className="w-full field-control">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="field-dropdown">
                      <SelectItem value="suave">Suave</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="ultra">Ultra</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Intervalo entre alvos</Label>
                  <Input
                    type="number"
                    min={1}
                    max={300}
                    value={intervalSeconds}
                    onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                    className="field-control"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Rotação entre chips</Label>
                  <Select value={rotationStrategy} onValueChange={(value) => setRotationStrategy(value as RotationStrategy)}>
                    <SelectTrigger className="w-full field-control">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="field-dropdown">
                      <SelectItem value="round_robin">Round-robin</SelectItem>
                      <SelectItem value="random">Aleatória</SelectItem>
                      <SelectItem value="least_usage">Menos uso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="surface-item-compact">
                  <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-1">Distribuição média</p>
                  <p className="text-lg font-semibold text-cyan-300">{averageTargetsPerChip || 0}</p>
                    <p className="text-xs text-gray-400 mt-1">destinatários por chip selecionado</p>
                </div>
                <div className="surface-item-compact">
                  <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-1">Estratégia ativa</p>
                  <p className="text-lg font-semibold text-cyan-300">{rotationLabel}</p>
                  <p className="text-xs text-gray-400 mt-1">distribuição atual entre chips</p>
                </div>
                <div className="space-y-2">
                  <Label>Janela do menos uso</Label>
                  <Input
                    type="number"
                    min={1}
                    max={24 * 30}
                    value={rotationLookbackHours}
                    onChange={(e) => setRotationLookbackHours(Number(e.target.value))}
                    className="field-control"
                    disabled={rotationStrategy !== "least_usage"}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mensagens por alvo</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={maxMessagesPerTarget}
                    onChange={(e) => setMaxMessagesPerTarget(Number(e.target.value))}
                    className="field-control"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total de alvos detectados</Label>
                  <div className="h-10 px-3 flex items-center rounded-md field-control text-cyan-400">
                    {parsedTargets.length}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Mensagem base</Label>
                <Select value={selectedTemplateId} onValueChange={applySavedTemplate}>
                  <SelectTrigger className="w-full field-control">
                    <SelectValue placeholder="Aplicar template salvo" />
                  </SelectTrigger>
                  <SelectContent className="field-dropdown">
                    {dispatchTemplates.length === 0 ? (
                      <SelectItem value="no-template" disabled>
                        Nenhum template de disparo salvo
                      </SelectItem>
                    ) : (
                      dispatchTemplates.map((template) => (
                        <SelectItem key={template.id} value={String(template.id)}>
                          {template.templateName}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Textarea
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  className="field-control min-h-28"
                  placeholder="Digite a mensagem principal que será usada no disparo."
                />
              </div>

              <div className="space-y-2">
                <Label>Lista de números / grupos</Label>
                <Select value={selectedSavedTargetId} onValueChange={applySavedTarget}>
                  <SelectTrigger className="w-full field-control">
                  <SelectValue placeholder="Aplicar lista salva" />
                  </SelectTrigger>
                  <SelectContent className="field-dropdown">
                    {dispatchTargets.length === 0 ? (
                      <SelectItem value="no-target" disabled>
                        Nenhuma lista compatível salva
                      </SelectItem>
                    ) : (
                      dispatchTargets.map((target) => (
                        <SelectItem key={target.id} value={String(target.id)}>
                          {target.targetName}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-3">
                  <label className="subtle-action inline-flex items-center cursor-pointer px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-slate-300">
                    Importar `.csv` ou `.txt`
                    <input
                      type="file"
                      accept=".txt,.csv"
                      className="hidden"
                      onChange={(e) => void handleTargetsFileUpload(e.target.files?.[0])}
                    />
                  </label>
                  <div className="surface-item-compact flex-1 min-w-[220px]">
                    <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-1">Onde colocar a lista</p>
                    <p className="text-sm text-gray-300">Cole uma lista manual ou importe arquivo com um número por linha.</p>
                  </div>
                </div>
                <Textarea
                  value={targetsText}
                  onChange={(e) => {
                    setTargetEntries([]);
                    setSelectedTagFilter("all");
                    setTargetsText(e.target.value);
                  }}
                  className="field-control min-h-36"
                  placeholder="Um número, grupo ou item por linha. Também aceita separação por vírgula."
                />
                {availableTags.length > 0 ? (
                  <div className="space-y-2">
                    <Label>Filtrar por tag</Label>
                    <Select value={selectedTagFilter} onValueChange={setSelectedTagFilter}>
                      <SelectTrigger className="w-full field-control">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="field-dropdown">
                        <SelectItem value="all">Todas as tags</SelectItem>
                        {availableTags.map((tag) => (
                          <SelectItem key={tag} value={tag}>
                            {tag}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="surface-item-compact">
                    <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-1">Linhas</p>
                    <p className="text-lg font-semibold text-white">{parsedTargetDiagnostics.rawCount}</p>
                  </div>
                  <div className="surface-item-compact">
                    <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-1">Válidos</p>
                    <p className="text-lg font-semibold text-emerald-300">{parsedTargets.length}</p>
                  </div>
                  <div className="surface-item-compact">
                    <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-1">Inválidos</p>
                    <p className="text-lg font-semibold text-rose-300">{invalidTargetCount}</p>
                  </div>
                  <div className="surface-item-compact">
                    <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-1">Duplicados</p>
                    <p className="text-lg font-semibold text-amber-300">{duplicateTargetCount}</p>
                  </div>
                </div>
                {targetEntries.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="surface-item-compact">
                      <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-1">Com nome</p>
                      <p className="text-lg font-semibold text-white">{namedTargetCount}</p>
                    </div>
                    <div className="surface-item-compact">
                      <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-1">Com tag</p>
                      <p className="text-lg font-semibold text-white">{taggedTargetCount}</p>
                    </div>
                    <div className="surface-item-compact">
                      <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-1">Formato CSV</p>
                      <p className="text-lg font-semibold text-cyan-300">numero,nome,tag</p>
                    </div>
                  </div>
                ) : null}
                {suppressedTargetCount > 0 ? (
                  <div className="surface-item-compact">
                    <p className="text-sm text-rose-300">
                      {suppressedTargetCount} destinatário(s) desta campanha já estão na lista de bloqueio e serão ignorados na validação e execução.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="card-premium-enhanced p-6">
              <h2 className="section-title">Pré-validação</h2>

              {previewResult ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Status</span>
                    <Badge variant={previewResult.valid ? "secondary" : "destructive"}>
                      {previewResult.valid ? "Aprovado" : "Bloqueado"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Alcance estimado</span>
                    <span className="text-cyan-400 font-bold">{previewResult.estimatedMessages}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Duração estimada</span>
                    <span className="text-cyan-400 font-bold">
                      {Math.ceil(previewResult.estimatedDuration / 1000)}s
                    </span>
                  </div>
                  {previewResult.distributionPreview?.length ? (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.08em] text-gray-400">Distribuição por chip</p>
                      {previewResult.distributionPreview.map((entry) => (
                        <div key={entry.chipId} className="surface-item-compact">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm text-white">Chip #{entry.chipId}</p>
                            <span className="text-xs text-cyan-300 font-semibold">
                              {entry.targetCount} destinatários • {entry.plannedMessages} msgs
                            </span>
                          </div>
                          {entry.sampleTargets.length ? (
                            <p className="text-xs text-slate-400 mt-2 break-all">
                              Exemplo: {entry.sampleTargets.join(", ")}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {!previewResult.valid && (
                    <p className="text-sm text-red-400">{previewResult.error}</p>
                  )}
                  <div className="space-y-2">
                    {previewResult.checks.map((check) => (
                      <div key={check.key} className="surface-item-compact">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm text-white">{check.label}</p>
                          <Badge variant={check.passed ? "secondary" : "destructive"}>
                            {check.passed ? "ok" : "bloqueado"}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{check.detail}</p>
                      </div>
                    ))}
                  </div>
                  {previewResult.warnings.length > 0 && (
                    <div className="space-y-2">
                      {previewResult.warnings.map((warning, index) => (
                        <div key={`${warning}-${index}`} className="surface-item-compact">
                          <p className="text-xs text-yellow-300">{warning}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400">
                    Clique em `Validar envio` para estimar alcance, checar o plano e confirmar que a distribuição entre chips está pronta.
                  </p>
                  <div className="surface-item-compact">
                    <p className="text-xs text-gray-400 uppercase tracking-[0.08em] mb-1">Sequência recomendada</p>
                    <p className="text-sm text-gray-300">
                      1. Escolha os chips. 2. Defina rotação. 3. Cole a lista. 4. Valide. 5. Execute.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 mt-6">
                <Button
                  variant="outline"
                  className="subtle-action action-validate"
                  onClick={handlePreview}
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Validar envio
                </Button>
                <Button
                  className="btn-primary-modern action-dispatch"
                  onClick={handleExecute}
                  disabled={executeMutation.isPending || !previewResult?.valid}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Executar disparo
                </Button>
              </div>

              <div className="surface-item mt-5">
                <p className="text-sm font-semibold text-white mb-2">Regras operacionais ativas</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-gray-400">Cooldown</p>
                    <p className="text-cyan-300 font-semibold">{currentOperationalRule.cooldownMinutes} min</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Limite/hora</p>
                    <p className="text-cyan-300 font-semibold">{currentOperationalRule.maxPerHour}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Limite/dia</p>
                    <p className="text-cyan-300 font-semibold">{currentOperationalRule.maxPerDay}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/5">
                  <p className="text-xs text-gray-400">
                    `Taxa de visualização` e `bloqueio confirmado` não são métricas perfeitas via WhatsApp comum. Nesta fase a leitura confiável é: válidos, enviados, falhas, pulados e suspeita operacional por chip.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="card-premium-enhanced p-6">
              <h2 className="section-title">Resultado operacional</h2>

              {!dispatchResults ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400">
                    Depois da execução, o resumo por chip aparece aqui.
                  </p>
                  <div className="surface-item-compact">
                    <p className="text-xs text-gray-400 uppercase tracking-[0.08em] mb-1">Próximo passo</p>
                    <p className="text-sm text-gray-300">
                      Depois de executar, revise os `pulados`, abra o detalhe da execução e confirme se a cadência ficou saudável.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {campaignMetrics ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="surface-item-compact">
                        <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-1">Processados</p>
                        <p className="text-lg font-semibold text-white">{campaignMetrics.processed}</p>
                      </div>
                      <div className="surface-item-compact">
                        <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-1">Entrega</p>
                        <p className="text-lg font-semibold text-emerald-300">{campaignMetrics.deliveryRate.toFixed(1)}%</p>
                      </div>
                      <div className="surface-item-compact">
                        <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-1">Falhas</p>
                        <p className="text-lg font-semibold text-rose-300">{campaignMetrics.failed}</p>
                      </div>
                      <div className="surface-item-compact">
                        <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-1">Suspeita bloqueio</p>
                        <p className="text-lg font-semibold text-amber-300">{campaignMetrics.suspicion}</p>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex justify-end gap-3">
                    <Button variant="outline" className="subtle-action" onClick={handleExportPremiumReport}>
                      <Eye className="w-4 h-4 mr-2" />
                      Relatório premium
                    </Button>
                    <Button variant="outline" className="subtle-action" onClick={handleExportCampaignResults}>
                      <Save className="w-4 h-4 mr-2" />
                      Exportar CSV
                    </Button>
                  </div>

                  {dispatchResults.map((result) => (
                    <div key={result.dispatchId} className="surface-item">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-semibold text-white">Chip #{result.chipId}</p>
                        <Badge variant={result.success ? "secondary" : "destructive"}>
                          {result.success ? "Processado" : "Falha"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-400">Execução</p>
                          <p className="text-cyan-400 font-semibold">
                            {result.executionJobId ? `#${result.executionJobId}` : "n/d"}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400">Alvos</p>
                          <p className="text-cyan-400 font-semibold">{result.totalTargets}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Mensagens</p>
                          <p className="text-cyan-400 font-semibold">{result.totalMessagesSent}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Sucessos</p>
                          <p className="text-green-400 font-semibold">{result.successCount}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Falhas</p>
                          <p className="text-red-400 font-semibold">{result.failureCount}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Pulados</p>
                          <p className="text-yellow-300 font-semibold">{result.skippedCount ?? 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Suspeita</p>
                          <p className="text-amber-300 font-semibold">
                            {(result.results || []).filter((item: any) => /(bloque|block|ban|forbidden|not[- ]authorized|401|403|429|rate)/i.test(String(item?.error || ""))).length}
                          </p>
                        </div>
                      </div>
                      {(result.results || []).some((item: any) => item.skipped) && (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs uppercase tracking-[0.08em] text-gray-400">Destinatários pulados por regra</p>
                          {(result.results || [])
                            .filter((item: any) => item.skipped)
                            .slice(0, 5)
                            .map((item: any, index: number) => (
                              <div key={`${item.target}-${index}`} className="surface-item-compact">
                                <p className="text-sm text-white break-all">{item.target}</p>
                                <p className="text-xs text-yellow-300 mt-1">{item.error}</p>
                              </div>
                            ))}
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap gap-3">
                        {result.executionJobId && (
                          <Button
                            variant="outline"
                            className="subtle-action action-view"
                            onClick={() => setSelectedJobId(result.executionJobId)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Abrir execução
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          className="subtle-action action-view"
                          onClick={() => setLocation(`/logs?chipId=${result.chipId}`)}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Ver logs do chip
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="card-premium-enhanced p-6">
              <h2 className="section-title">Análises de marketing</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="surface-item-compact">
                    <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-1">Campanhas</p>
                    <p className="text-lg font-semibold text-white">{marketingAnalytics?.campaigns?.length ?? 0}</p>
                  </div>
                  <div className="surface-item-compact">
                    <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-1">Envios totais</p>
                    <p className="text-lg font-semibold text-cyan-300">
                      {(marketingAnalytics?.campaigns ?? []).reduce((acc, item) => acc + item.totalMessagesSent, 0)}
                    </p>
                  </div>
                  <div className="surface-item-compact">
                    <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-1">Lista de bloqueio</p>
                    <p className="text-lg font-semibold text-rose-300">{suppressionEntries.length}</p>
                  </div>
                  <div className="surface-item-compact">
                    <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-1">Risco médio</p>
                    <p className="text-lg font-semibold text-amber-300">
                      {marketingAnalytics?.chips?.length
                        ? Math.round(marketingAnalytics.chips.reduce((acc, item) => acc + item.riskScore, 0) / marketingAnalytics.chips.length)
                        : 0}
                      /100
                    </p>
                  </div>
                </div>
                <div className="surface-item">
                  <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-3">Gráfico por campanha</p>
                  {campaignChartData.length ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={campaignChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                          <YAxis stroke="#94a3b8" fontSize={11} />
                          <Tooltip />
                          <Bar dataKey="envios" fill="#22d3ee" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="falhas" fill="#fb7185" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="suspeitas" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">O gráfico aparece conforme campanhas executadas acumulam volume.</p>
                  )}
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-2">Por campanha</p>
                  <div className="space-y-2">
                    {(marketingAnalytics?.campaigns ?? []).slice(0, 4).map((campaign) => (
                      <div key={campaign.campaignId} className="surface-item-compact">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{campaign.campaignName}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {campaign.totalMessagesSent} envios • {campaign.totalTargets} destinatários • {campaign.totalJobs} execuções
                            </p>
                          </div>
                          <span className="badge badge-info">{campaign.suspicionCount} suspeitas</span>
                        </div>
                      </div>
                    ))}
                    {!(marketingAnalytics?.campaigns?.length) ? (
                      <p className="text-sm text-slate-400">As campanhas salvas e executadas vão aparecer aqui com volume agregado.</p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-gray-400 mb-2">Por chip</p>
                  <div className="space-y-2">
                    {(marketingAnalytics?.chips ?? []).slice(0, 5).map((chip) => (
                      <div key={chip.chipId} className="surface-item-compact">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">Chip #{chip.chipId}</p>
                            <p className="text-xs text-slate-400 mt-1">{chip.totalMessagesSent} envios • {chip.totalJobs} execuções</p>
                          </div>
                          <div className="text-right">
                            <span className="badge badge-neutral">{chip.suspicionCount} suspeitas</span>
                            <p className="text-xs text-slate-400 mt-1">risco {chip.riskScore}/100</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!(marketingAnalytics?.chips?.length) ? (
                      <p className="text-sm text-slate-400">Quando houver execução suficiente, este bloco mostra a saúde operacional por chip.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="card-premium-enhanced p-6">
              <h2 className="section-title">Lista de bloqueio e supressão</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    value={suppressionValue}
                    onChange={(e) => setSuppressionValue(e.target.value)}
                    className="field-control"
                    placeholder="Número para suprimir"
                  />
                  <Input
                    value={suppressionReason}
                    onChange={(e) => setSuppressionReason(e.target.value)}
                    className="field-control"
                    placeholder="Motivo"
                  />
                  <Input
                    value={suppressionTag}
                    onChange={(e) => setSuppressionTag(e.target.value)}
                    className="field-control"
                    placeholder="Tag"
                  />
                </div>
                <Button variant="outline" className="subtle-action" onClick={handleAddSuppression}>
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Adicionar à lista de bloqueio
                </Button>
                <div className="space-y-2">
                  {suppressionEntries.slice(0, 8).map((entry) => (
                    <div key={entry.id} className="surface-item-compact">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{entry.value}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {entry.reason || "Sem motivo"}{entry.tag ? ` • ${entry.tag}` : ""}
                          </p>
                        </div>
                        <Button variant="outline" className="subtle-action" onClick={() => handleRemoveSuppression(entry.id)}>
                          Remover
                        </Button>
                      </div>
                    </div>
                  ))}
                  {!suppressionEntries.length ? (
                    <p className="text-sm text-slate-400">Nenhum número suprimido ainda.</p>
                  ) : null}
                </div>
              </div>
            </Card>

            <Card className="card-premium-enhanced p-6">
              <h2 className="section-title">Histórico da campanha</h2>
              {!selectedCampaignId ? (
                <p className="text-sm text-slate-400">Selecione uma campanha salva para ver o histórico detalhado.</p>
              ) : !(selectedCampaignHistory?.jobs?.length) ? (
                <p className="text-sm text-slate-400">Essa campanha ainda não tem execuções registradas.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <Button variant="outline" className="subtle-action" onClick={handleExportCampaignResults}>
                      <Save className="w-4 h-4 mr-2" />
                      Exportar histórico
                    </Button>
                  </div>
                  {selectedCampaignHistory.jobs.map((entry) => (
                    <div key={entry.job.id} className="surface-item">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">Execução #{entry.job.id}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            Chip #{entry.job.chipId} • {entry.job.totalMessagesSent} envios • {entry.job.successCount} sucessos
                          </p>
                        </div>
                        <Badge variant={getJobBadgeVariant(entry.job.status)}>{getExecutionStatusLabel(entry.job.status)}</Badge>
                      </div>
                      <div className="mt-3 space-y-2">
                        {entry.attempts.slice(0, 6).map((attempt) => (
                          <div key={attempt.id} className="surface-item-compact">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm text-white break-all">{attempt.targetValue}</p>
                              <Badge variant={attempt.status === "success" ? "secondary" : "destructive"}>{getExecutionStatusLabel(attempt.status)}</Badge>
                            </div>
                            {attempt.errorMessage ? (
                              <p className="text-xs text-slate-400 mt-2 break-all">{attempt.errorMessage}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="card-premium-enhanced p-6">
              <h2 className="section-title">Execuções recentes</h2>

              {recentExecutionJobs.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhuma execução registrada ainda.</p>
              ) : (
                <div className="space-y-3">
                  {recentExecutionJobs.map((job) => (
                    <div key={job.id} className="surface-item">
                      <div className="flex items-center justify-between mb-2 gap-3">
                        <div>
                          <p className="font-semibold text-white">Execução #{job.id}</p>
                          <p className="text-xs text-gray-400">
                            Chip #{job.chipId} • {job.executionType} • {job.profileName}
                          </p>
                        </div>
                        <Badge variant={getJobBadgeVariant(job.status)}>{getExecutionStatusLabel(job.status)}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-400">Planejadas</p>
                          <p className="text-cyan-400 font-semibold">{job.plannedMessages}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Enviadas</p>
                          <p className="text-cyan-400 font-semibold">{job.totalMessagesSent}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Sucessos</p>
                          <p className="text-green-400 font-semibold">{job.successCount}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Falhas</p>
                          <p className="text-red-400 font-semibold">{job.failureCount}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Pulados</p>
                          <p className="text-yellow-300 font-semibold">{job.skippedCount ?? 0}</p>
                        </div>
                      </div>
                      {job.errorMessage && <p className="text-xs text-red-400 mt-3">{job.errorMessage}</p>}
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button
                          variant="outline"
                          className="subtle-action action-view"
                          onClick={() => setSelectedJobId(job.id)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Ver tentativas
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="card-premium-enhanced p-6">
              <div className="flex items-center justify-between gap-3 mb-5">
                <h2 className="section-title mb-0">Detalhe da execução</h2>
                {selectedJobId && (
                  <Button
                    variant="outline"
                    className="subtle-action action-view"
                    onClick={() => utils.chips.getExecutionJob.invalidate({ jobId: selectedJobId })}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Atualizar
                  </Button>
                )}
              </div>

              {!selectedJobId ? (
                <p className="text-sm text-gray-400">Selecione uma execução recente para ver as tentativas detalhadas.</p>
              ) : isLoadingSelectedJob ? (
                <p className="text-sm text-gray-400">Carregando tentativas da execução...</p>
              ) : !selectedJobDetail ? (
                <p className="text-sm text-red-400">Não foi possível carregar os detalhes da execução.</p>
              ) : (
                <div className="space-y-4">
                  <div className="surface-item">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="font-semibold text-white">Execução #{selectedJobDetail.job.id}</p>
                        <p className="text-xs text-gray-400">
                          Chip #{selectedJobDetail.job.chipId} • {selectedJobDetail.job.executionType} •{" "}
                          {selectedJobDetail.job.profileName}
                        </p>
                      </div>
                      <Badge variant={getJobBadgeVariant(selectedJobDetail.job.status)}>
                        {getExecutionStatusLabel(selectedJobDetail.job.status)}
                      </Badge>
                    </div>
                    {selectedJobDetail.job.errorMessage && (
                      <div className="flex gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{selectedJobDetail.job.errorMessage}</span>
                      </div>
                    )}
                  </div>

                  {selectedJobDetail.attempts.length === 0 ? (
                    <p className="text-sm text-gray-400">Nenhuma tentativa gravada para esta execução ainda.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedJobDetail.attempts.map((attempt) => (
                        <div key={attempt.id} className="surface-item">
                          {(() => {
                            const presentation = getAttemptPresentation(attempt);
                            return (
                              <>
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <div>
                              <p className="font-semibold text-white">
                                Tentativa #{attempt.id} • {attempt.actionType}
                              </p>
                              <p className="text-xs text-gray-400 break-all">
                                {attempt.targetType} • {attempt.targetValue}
                              </p>
                            </div>
                            <Badge variant={presentation.variant}>
                              {presentation.label}
                            </Badge>
                          </div>
                          {attempt.messageContent && (
                            <p className="text-sm text-gray-300 whitespace-pre-wrap mb-2">{attempt.messageContent}</p>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-gray-400">Ordem</p>
                              <p className="text-cyan-400 font-semibold">{attempt.attemptOrder}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Provider ID</p>
                              <p className="text-cyan-400 font-semibold break-all">{attempt.providerMessageId || "n/d"}</p>
                            </div>
                          </div>
                          {presentation.reason && (
                            <p className={`text-xs mt-3 break-all ${presentation.label === "pulado" ? "text-yellow-300" : "text-red-400"}`}>
                              {presentation.reason}
                            </p>
                          )}
                              </>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
        </div>
        </div>
      </div>
    </div>
  );
}
