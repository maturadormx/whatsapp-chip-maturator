import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Download, Link2, RefreshCw, Save, Settings2, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast as sonnerToast } from "sonner";
import { useLocation } from "wouter";

type TemplateCategory = "dispatch" | "maturation" | "general";
type TargetType = "number" | "group" | "chip";

const templateCategoryLabels: Record<TemplateCategory, string> = {
  dispatch: "Disparo",
  maturation: "Maturação",
  general: "Geral",
};

const targetTypeLabels: Record<TargetType, string> = {
  number: "Número",
  group: "Grupo",
  chip: "Chip",
};

const emptyTemplateForm = {
  templateId: null as number | null,
  templateName: "",
  category: "general" as TemplateCategory,
  content: "",
  isActive: true,
};

const emptyTargetForm = {
  targetId: null as number | null,
  targetName: "",
  targetType: "number" as TargetType,
  targetValue: "",
  notes: "",
  isActive: true,
};

const emptyBulkLibraryForm = {
  templateNamePrefix: "",
  category: "maturation" as TemplateCategory,
  content: "",
  isActive: true,
};

const emptyInviteGroupForm = {
  chipId: "",
  inviteLinkOrCode: "",
  importAsTarget: true,
};

const operationalExecutionTypes = ["dispatch", "maturation"] as const;
const operationalProfiles = ["suave", "normal", "ultra"] as const;
const operationalTargetTypes = ["number", "group"] as const;

export default function Operations() {
  const { isAuthenticated, loading } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "/login",
  });
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: templates = [], isLoading: isLoadingTemplates } = trpc.operations.listTemplates.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: targets = [], isLoading: isLoadingTargets } = trpc.operations.listTargets.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: chips = [] } = trpc.chips.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: operationalRules } = trpc.operations.getOperationalRules.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const createTemplateMutation = trpc.operations.createTemplate.useMutation();
  const bulkCreateTemplatesMutation = trpc.operations.bulkCreateTemplates.useMutation();
  const updateTemplateMutation = trpc.operations.updateTemplate.useMutation();
  const deleteTemplateMutation = trpc.operations.deleteTemplate.useMutation();
  const createTargetMutation = trpc.operations.createTarget.useMutation();
  const updateTargetMutation = trpc.operations.updateTarget.useMutation();
  const deleteTargetMutation = trpc.operations.deleteTarget.useMutation();
  const importChipGroupsMutation = trpc.operations.importChipGroups.useMutation();
  const joinGroupByInviteMutation = trpc.operations.joinGroupByInvite.useMutation();
  const updateOperationalRulesMutation = trpc.operations.updateOperationalRules.useMutation();

  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [targetForm, setTargetForm] = useState(emptyTargetForm);
  const [bulkLibraryForm, setBulkLibraryForm] = useState(emptyBulkLibraryForm);
  const [inviteGroupForm, setInviteGroupForm] = useState(emptyInviteGroupForm);
  const [operationalRulesForm, setOperationalRulesForm] = useState<any>(null);
  const [selectedGroupsChipId, setSelectedGroupsChipId] = useState<string>("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [groupCatalogFilter, setGroupCatalogFilter] = useState("");

  const { data: groupCatalogData, isLoading: isLoadingChipCatalog } = trpc.operations.listGroupCatalog.useQuery(
    selectedGroupsChipId ? { chipId: Number(selectedGroupsChipId) } : undefined,
    {
      enabled: isAuthenticated,
    }
  );
  const chipGroups = groupCatalogData?.groups ?? [];
  const unavailableGroupChips = groupCatalogData?.unavailableChips ?? [];
  const { data: invitePreview, isFetching: isLoadingInvitePreview } = trpc.operations.previewGroupInvite.useQuery(
    {
      chipId: Number(inviteGroupForm.chipId),
      inviteLinkOrCode: inviteGroupForm.inviteLinkOrCode,
    },
    {
      enabled:
        isAuthenticated &&
        inviteGroupForm.chipId !== "" &&
        inviteGroupForm.inviteLinkOrCode.trim().length >= 6,
      retry: false,
    }
  );

  const chipOptions = useMemo(
    () =>
      chips.map((chip) => ({
        value: String(chip.id),
        label: chip.phoneNumber ? `${chip.chipName} • ${chip.phoneNumber}` : chip.chipName,
      })),
    [chips]
  );
  const connectedChipCount = useMemo(
    () => chips.filter((chip) => chip.status === "conectado" || chip.status === "maturando").length,
    [chips]
  );
  const activeTemplateCount = useMemo(
    () => templates.filter((template) => Boolean(template.isActive)).length,
    [templates]
  );
  const activeTargetCount = useMemo(
    () => targets.filter((target) => Boolean(target.isActive)).length,
    [targets]
  );
  const activeGroupTargetCount = useMemo(
    () => targets.filter((target) => Boolean(target.isActive) && target.targetType === "group").length,
    [targets]
  );
  const operationReady = connectedChipCount > 0 && activeTemplateCount > 0 && activeTargetCount > 0;

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  const resetTemplateForm = () => setTemplateForm(emptyTemplateForm);
  const resetTargetForm = () => setTargetForm(emptyTargetForm);
  const resetBulkLibraryForm = () => setBulkLibraryForm(emptyBulkLibraryForm);
  const resetInviteGroupForm = () => setInviteGroupForm(emptyInviteGroupForm);

  useEffect(() => {
    setSelectedGroupIds([]);
  }, [selectedGroupsChipId]);

  useEffect(() => {
    if (operationalRules) {
      setOperationalRulesForm(JSON.parse(JSON.stringify(operationalRules)));
    }
  }, [operationalRules]);

  const filteredGroupCatalog = useMemo(() => {
    const term = groupCatalogFilter.trim().toLowerCase();
    if (!term) return chipGroups;
    return chipGroups.filter(
      (group) =>
        group.subject.toLowerCase().includes(term) ||
        group.id.toLowerCase().includes(term) ||
        group.chipName.toLowerCase().includes(term)
    );
  }, [chipGroups, groupCatalogFilter]);

  const handleSaveTemplate = async () => {
    if (!templateForm.templateName.trim() || !templateForm.content.trim()) {
      sonnerToast.error("Preencha nome e conteúdo do template.");
      return;
    }

    try {
      if (templateForm.templateId) {
        await updateTemplateMutation.mutateAsync({
          templateId: templateForm.templateId,
          templateName: templateForm.templateName.trim(),
          category: templateForm.category,
          content: templateForm.content.trim(),
          isActive: templateForm.isActive,
        });
        sonnerToast.success("Template atualizado.");
      } else {
        await createTemplateMutation.mutateAsync({
          templateName: templateForm.templateName.trim(),
          category: templateForm.category,
          content: templateForm.content.trim(),
          isActive: templateForm.isActive,
        });
        sonnerToast.success("Template criado.");
      }

      await utils.operations.listTemplates.invalidate();
      resetTemplateForm();
    } catch (error: any) {
      sonnerToast.error(error?.message || "Falha ao salvar template.");
    }
  };

  const handleSaveTarget = async () => {
    if (!targetForm.targetName.trim() || !targetForm.targetValue.trim()) {
      sonnerToast.error("Preencha nome e valor do target.");
      return;
    }

    try {
      if (targetForm.targetId) {
        await updateTargetMutation.mutateAsync({
          targetId: targetForm.targetId,
          targetName: targetForm.targetName.trim(),
          targetType: targetForm.targetType,
          targetValue: targetForm.targetValue.trim(),
          notes: targetForm.notes.trim() || undefined,
          isActive: targetForm.isActive,
        });
        sonnerToast.success("Target atualizado.");
      } else {
        await createTargetMutation.mutateAsync({
          targetName: targetForm.targetName.trim(),
          targetType: targetForm.targetType,
          targetValue: targetForm.targetValue.trim(),
          notes: targetForm.notes.trim() || undefined,
          isActive: targetForm.isActive,
        });
        sonnerToast.success("Target criado.");
      }

      await utils.operations.listTargets.invalidate();
      resetTargetForm();
    } catch (error: any) {
      sonnerToast.error(error?.message || "Falha ao salvar target.");
    }
  };

  const handleBulkImportTemplates = async () => {
    if (!bulkLibraryForm.templateNamePrefix.trim() || !bulkLibraryForm.content.trim()) {
      sonnerToast.error("Preencha o prefixo e a biblioteca de mensagens.");
      return;
    }

    try {
      const result = await bulkCreateTemplatesMutation.mutateAsync({
        templateNamePrefix: bulkLibraryForm.templateNamePrefix.trim(),
        category: bulkLibraryForm.category,
        content: bulkLibraryForm.content.trim(),
        isActive: bulkLibraryForm.isActive,
      });
      await utils.operations.listTemplates.invalidate();
      sonnerToast.success(`Biblioteca importada com ${result.createdCount} mensagens.`);
      resetBulkLibraryForm();
    } catch (error: any) {
      sonnerToast.error(error?.message || "Falha ao importar biblioteca.");
    }
  };

  const handleDeleteTemplate = async (templateId: number) => {
    const confirmed = window.confirm("Remover este template?");
    if (!confirmed) return;

    try {
      await deleteTemplateMutation.mutateAsync({ templateId });
      await utils.operations.listTemplates.invalidate();
      if (templateForm.templateId === templateId) resetTemplateForm();
      sonnerToast.success("Template removido.");
    } catch (error: any) {
      sonnerToast.error(error?.message || "Falha ao remover template.");
    }
  };

  const handleDeleteTarget = async (targetId: number) => {
    const confirmed = window.confirm("Remover este target?");
    if (!confirmed) return;

    try {
      await deleteTargetMutation.mutateAsync({ targetId });
      await utils.operations.listTargets.invalidate();
      if (targetForm.targetId === targetId) resetTargetForm();
      sonnerToast.success("Target removido.");
    } catch (error: any) {
      sonnerToast.error(error?.message || "Falha ao remover target.");
    }
  };

  const toggleImportedGroup = (groupId: string, checked: boolean) => {
    setSelectedGroupIds((current) =>
      checked ? (current.includes(groupId) ? current : [...current, groupId]) : current.filter((id) => id !== groupId)
    );
  };

  const handleImportGroups = async () => {
    if (!selectedGroupsChipId) {
      sonnerToast.error("Selecione um chip para listar os grupos.");
      return;
    }

    if (selectedGroupIds.length === 0) {
      sonnerToast.error("Selecione pelo menos um grupo para importar.");
      return;
    }

    try {
      const result = await importChipGroupsMutation.mutateAsync({
        chipId: Number(selectedGroupsChipId),
        groupIds: selectedGroupIds,
      });
      await utils.operations.listTargets.invalidate();
      await utils.operations.listGroupCatalog.invalidate();
      setSelectedGroupIds([]);
      sonnerToast.success(`Importação concluída. Novos grupos: ${result.importedCount}. Ignorados: ${result.skippedCount}.`);
    } catch (error: any) {
      sonnerToast.error(error?.message || "Falha ao importar grupos.");
    }
  };

  const handleJoinGroupByInvite = async () => {
    if (!inviteGroupForm.chipId || !inviteGroupForm.inviteLinkOrCode.trim()) {
      sonnerToast.error("Selecione o chip e informe o link ou código do grupo.");
      return;
    }

    try {
      const result = await joinGroupByInviteMutation.mutateAsync({
        chipId: Number(inviteGroupForm.chipId),
        inviteLinkOrCode: inviteGroupForm.inviteLinkOrCode.trim(),
        importAsTarget: inviteGroupForm.importAsTarget,
      });
      await utils.operations.listTargets.invalidate();
      await utils.operations.listGroupCatalog.invalidate();
      sonnerToast.success(
        result.imported
          ? `Entrou no grupo "${result.group.subject}" e importou como target.`
          : `Entrou no grupo "${result.group.subject}".`
      );
      resetInviteGroupForm();
    } catch (error: any) {
      sonnerToast.error(error?.message || "Falha ao entrar no grupo.");
    }
  };

  const handleOperationalRuleChange = (
    executionType: (typeof operationalExecutionTypes)[number],
    profile: (typeof operationalProfiles)[number],
    targetType: (typeof operationalTargetTypes)[number],
    field: "cooldownMinutes" | "maxPerHour" | "maxPerDay",
    value: string
  ) => {
    const numericValue = Math.max(1, Number(value || 0));
    setOperationalRulesForm((current: any) => ({
      ...current,
      [executionType]: {
        ...current[executionType],
        [profile]: {
          ...current[executionType][profile],
          [targetType]: {
            ...current[executionType][profile][targetType],
            [field]: numericValue,
          },
        },
      },
    }));
  };

  const handleSaveOperationalRules = async () => {
    if (!operationalRulesForm) return;

    try {
      await updateOperationalRulesMutation.mutateAsync(operationalRulesForm);
      await utils.operations.getOperationalRules.invalidate();
      sonnerToast.success("Regras operacionais atualizadas.");
    } catch (error: any) {
      sonnerToast.error(error?.message || "Falha ao atualizar regras operacionais.");
    }
  };

  if (loading) {
    return (
      <div className="app-shell bg-app-grid flex items-center justify-center">
        <Card className="card-premium-enhanced p-8 text-center">
          <p className="text-cyan-400 font-semibold">Carregando operação...</p>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="app-shell bg-app-grid">
      <div className="page-container">
        <div className="page-hero md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="page-title mb-2">CENTRO OPERACIONAL W.M.S.E</h1>
            <p className="page-subtitle">
              M13 Group • cadastre mensagens reutilizáveis e destinatários reais para maturação e disparos.
            </p>
          </div>

          <Button className="btn-primary-modern" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao painel operacional
          </Button>
        </div>

        <Card className="card-premium-enhanced p-6 mb-6">
          <div className={`status-banner ${operationReady ? "status-banner-ok" : "status-banner-warn"}`}>
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">
                  {operationReady ? "Base operacional pronta" : "Base operacional ainda incompleta"}
                </p>
                <p className="text-sm text-gray-300 mt-1">
                  {operationReady
                    ? "Você já tem chips conectados, biblioteca ativa e destinatários suficientes para operar com mais segurança."
                    : "Antes de rodar pesado, garanta pelo menos 1 chip conectado, templates ativos e destinatários cadastrados."}
                </p>
              </div>
              <Badge variant={operationReady ? "secondary" : "outline"}>
                {operationReady ? "configuração pronta" : "ajuste pendente"}
              </Badge>
            </div>

            <div className="summary-grid mt-4">
              <div className="summary-pill">
                <p className="summary-pill-label">Chips conectados</p>
                <p className="summary-pill-value">{connectedChipCount}</p>
              </div>
              <div className="summary-pill">
                <p className="summary-pill-label">Templates ativos</p>
                <p className="summary-pill-value">{activeTemplateCount}</p>
              </div>
              <div className="summary-pill">
                <p className="summary-pill-label">Destinatários ativos</p>
                <p className="summary-pill-value">{activeTargetCount}</p>
              </div>
              <div className="summary-pill">
                <p className="summary-pill-label">Grupos ativos</p>
                <p className="summary-pill-value">{activeGroupTargetCount}</p>
              </div>
            </div>

            <div className="surface-item-compact mt-4">
              <p className="text-xs text-gray-400 uppercase tracking-[0.08em] mb-1">Sequência recomendada</p>
              <p className="text-sm text-gray-300">
                1. Monte a biblioteca. 2. Cadastre destinatários. 3. Ajuste regras. 4. Revise grupos. 5. Vá para `Marketing` quando a base estiver pronta.
              </p>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="templates" className="gap-6">
          <TabsList className="bg-slate-950/60 border border-white/10 h-auto p-1">
            <TabsTrigger value="templates" className="px-4 py-2 text-white data-[state=active]:bg-white/10">
              Templates
            </TabsTrigger>
            <TabsTrigger value="targets" className="px-4 py-2 text-white data-[state=active]:bg-white/10">
              Destinatários
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates">
            <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
              <Card className="card-premium-enhanced p-6">
                <h2 className="section-title">
                  {templateForm.templateId ? "Editar template" : "Novo template"}
                </h2>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={templateForm.templateName}
                      onChange={(e) => setTemplateForm((current) => ({ ...current, templateName: e.target.value }))}
                      className="field-control"
                      placeholder="Ex: Abordagem suave"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Select
                        value={templateForm.category}
                        onValueChange={(value) =>
                          setTemplateForm((current) => ({ ...current, category: value as TemplateCategory }))
                        }
                      >
                        <SelectTrigger className="w-full field-control">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="field-dropdown">
                          <SelectItem value="dispatch">Disparo</SelectItem>
                          <SelectItem value="maturation">Maturação</SelectItem>
                          <SelectItem value="general">Geral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={templateForm.isActive ? "active" : "inactive"}
                        onValueChange={(value) =>
                          setTemplateForm((current) => ({ ...current, isActive: value === "active" }))
                        }
                      >
                        <SelectTrigger className="w-full field-control">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="field-dropdown">
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="inactive">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Conteúdo</Label>
                    <Textarea
                      value={templateForm.content}
                      onChange={(e) => setTemplateForm((current) => ({ ...current, content: e.target.value }))}
                      className="min-h-[180px] field-control"
                      placeholder="Escreva a mensagem base aqui"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button className="btn-primary-modern action-save" onClick={handleSaveTemplate}>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar template
                    </Button>
                    <Button variant="outline" className="subtle-action" onClick={resetTemplateForm}>
                      Limpar
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="card-premium-enhanced p-6">
                <h2 className="section-title">Biblioteca de templates</h2>
                {isLoadingTemplates ? (
                  <p className="text-gray-400">Carregando templates...</p>
                ) : templates.length === 0 ? (
                  <p className="text-gray-400">Nenhum template cadastrado.</p>
                ) : (
                  <div className="space-y-4">
                    {templates.map((template) => (
                      <div key={template.id} className="surface-item">
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                          <div>
                            <h3 className="text-white font-semibold">{template.templateName}</h3>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline">{templateCategoryLabels[template.category as TemplateCategory]}</Badge>
                              <Badge variant={template.isActive ? "secondary" : "outline"}>
                                {template.isActive ? "Ativo" : "Inativo"}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              className="subtle-action"
                              onClick={() =>
                                setTemplateForm({
                                  templateId: template.id,
                                  templateName: template.templateName,
                                  category: template.category as TemplateCategory,
                                  content: template.content,
                                  isActive: Boolean(template.isActive),
                                })
                              }
                            >
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              className="danger-action"
                              onClick={() => handleDeleteTemplate(template.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap">{template.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <Card className="card-premium-enhanced p-6 mt-6">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
                <div>
                  <h2 className="section-title mb-1">Catálogo de grupos</h2>
                  <p className="section-subtitle">
                    Visão operacional dos grupos encontrados, com origem do chip e estado de importação como destinatário.
                  </p>
                </div>
                <div className="w-full lg:w-80">
                  <Label>Filtrar grupos</Label>
                  <Input
                    value={groupCatalogFilter}
                    onChange={(e) => setGroupCatalogFilter(e.target.value)}
                    className="field-control"
                    placeholder="Buscar por nome, id ou chip"
                  />
                </div>
              </div>

              {unavailableGroupChips.length > 0 && (
                <div className="space-y-2 mb-4">
                  {unavailableGroupChips.map((chip) => (
                    <div key={chip.chipId} className="surface-item-compact">
                      <p className="text-sm text-yellow-300 font-medium">{chip.chipName}</p>
                      <p className="text-xs text-gray-400 mt-1">{chip.reason}</p>
                    </div>
                  ))}
                </div>
              )}

              {isLoadingChipCatalog ? (
                <p className="text-sm text-gray-400">Carregando catálogo de grupos...</p>
              ) : filteredGroupCatalog.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum grupo encontrado no catálogo atual.</p>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {filteredGroupCatalog.map((group) => (
                    <div key={`${group.chipId}:${group.id}`} className="surface-item">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <p className="text-white font-semibold truncate">{group.subject}</p>
                          <p className="text-xs text-gray-400 break-all mt-1">{group.id}</p>
                        </div>
                        <Badge variant={group.importedAsTarget ? "secondary" : "outline"}>
                          {group.importedAsTarget ? "Destinatário ativo" : "Só catálogo"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Badge variant="outline">{group.chipName}</Badge>
                        <Badge variant="outline">{group.size} membros</Badge>
                        <Badge variant={group.announce ? "secondary" : "outline"}>
                          {group.announce ? "Admins" : "Aberto"}
                        </Badge>
                        {group.targetName && <Badge variant="outline">{group.targetName}</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="card-premium-enhanced p-6 mt-6">
              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-slate-950/70 border border-white/10 flex items-center justify-center text-cyan-300">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="section-title mb-1">Biblioteca em lote</h2>
                  <p className="section-subtitle">
                    Cole 10 ou mais mensagens separadas por linha em branco ou por `---` para criar uma biblioteca de rotação.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label>Prefixo do nome</Label>
                  <Input
                    value={bulkLibraryForm.templateNamePrefix}
                    onChange={(e) => setBulkLibraryForm((current) => ({ ...current, templateNamePrefix: e.target.value }))}
                    className="field-control"
                    placeholder="Ex: Rodada aquecimento"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Categoria</Label>
                    <Select
                      value={bulkLibraryForm.category}
                      onValueChange={(value: TemplateCategory) => setBulkLibraryForm((current) => ({ ...current, category: value }))}
                    >
                      <SelectTrigger className="w-full field-control">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="field-dropdown">
                        {Object.entries(templateCategoryLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={bulkLibraryForm.isActive ? "active" : "inactive"}
                      onValueChange={(value) => setBulkLibraryForm((current) => ({ ...current, isActive: value === "active" }))}
                    >
                      <SelectTrigger className="w-full field-control">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="field-dropdown">
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Mensagens da biblioteca</Label>
                  <Textarea
                    value={bulkLibraryForm.content}
                    onChange={(e) => setBulkLibraryForm((current) => ({ ...current, content: e.target.value }))}
                    className="field-control min-h-[220px]"
                    placeholder={"Mensagem 1\n\nMensagem 2\n\n---\n\nMensagem 3"}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button className="btn-primary-modern action-save" onClick={handleBulkImportTemplates}>
                    <Download className="w-4 h-4 mr-2" />
                    Importar biblioteca
                  </Button>
                  <Button variant="outline" className="subtle-action" onClick={resetBulkLibraryForm}>
                    Limpar
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="card-premium-enhanced p-6 mt-6">
              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-slate-950/70 border border-white/10 flex items-center justify-center text-cyan-300">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="section-title mb-1">Regras operacionais</h2>
                  <p className="section-subtitle">
                    Ajuste intervalo mínimo e limites por perfil/tipo de destinatário sem mexer em código.
                  </p>
                </div>
              </div>

              {!operationalRulesForm ? (
                <p className="text-sm text-gray-400">Carregando regras operacionais...</p>
              ) : (
                <div className="space-y-6">
                  {operationalExecutionTypes.map((executionType) => (
                    <div key={executionType} className="surface-item">
                      <p className="text-white font-semibold capitalize mb-4">{executionType}</p>
                      <div className="space-y-4">
                        {operationalProfiles.map((profile) => (
                          <div key={`${executionType}-${profile}`} className="surface-item-compact">
                            <p className="text-sm font-semibold text-cyan-300 capitalize mb-3">{profile}</p>
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                              {operationalTargetTypes.map((targetType) => (
                                <div key={`${executionType}-${profile}-${targetType}`} className="surface-item-compact">
                                  <p className="text-sm font-medium text-white mb-3 capitalize">{targetType}</p>
                                  <div className="grid grid-cols-3 gap-3">
                                    <div>
                                      <Label>Intervalo</Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        value={operationalRulesForm[executionType][profile][targetType].cooldownMinutes}
                                        onChange={(e) =>
                                          handleOperationalRuleChange(
                                            executionType,
                                            profile,
                                            targetType,
                                            "cooldownMinutes",
                                            e.target.value
                                          )
                                        }
                                        className="field-control"
                                      />
                                    </div>
                                    <div>
                                      <Label>Hora</Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        value={operationalRulesForm[executionType][profile][targetType].maxPerHour}
                                        onChange={(e) =>
                                          handleOperationalRuleChange(
                                            executionType,
                                            profile,
                                            targetType,
                                            "maxPerHour",
                                            e.target.value
                                          )
                                        }
                                        className="field-control"
                                      />
                                    </div>
                                    <div>
                                      <Label>Dia</Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        value={operationalRulesForm[executionType][profile][targetType].maxPerDay}
                                        onChange={(e) =>
                                          handleOperationalRuleChange(
                                            executionType,
                                            profile,
                                            targetType,
                                            "maxPerDay",
                                            e.target.value
                                          )
                                        }
                                        className="field-control"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-wrap gap-3">
                    <Button className="btn-primary-modern action-save" onClick={handleSaveOperationalRules}>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar regras
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="targets">
            <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
              <Card className="card-premium-enhanced p-6">
                <h2 className="section-title">
                  {targetForm.targetId ? "Editar destinatário" : "Novo destinatário"}
                </h2>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={targetForm.targetName}
                      onChange={(e) => setTargetForm((current) => ({ ...current, targetName: e.target.value }))}
                      className="field-control"
                      placeholder="Ex: Grupo de aquecimento"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select
                        value={targetForm.targetType}
                        onValueChange={(value) =>
                          setTargetForm((current) => ({
                            ...current,
                            targetType: value as TargetType,
                            targetValue: value === "chip" ? current.targetValue : current.targetValue,
                          }))
                        }
                      >
                        <SelectTrigger className="w-full field-control">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="field-dropdown">
                          <SelectItem value="number">Número</SelectItem>
                          <SelectItem value="group">Grupo</SelectItem>
                          <SelectItem value="chip">Chip</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={targetForm.isActive ? "active" : "inactive"}
                        onValueChange={(value) =>
                          setTargetForm((current) => ({ ...current, isActive: value === "active" }))
                        }
                      >
                        <SelectTrigger className="w-full field-control">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="field-dropdown">
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="inactive">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {targetForm.targetType === "chip" ? (
                    <div className="space-y-2">
                      <Label>Chip alvo</Label>
                      <Select
                        value={targetForm.targetValue}
                        onValueChange={(value) => setTargetForm((current) => ({ ...current, targetValue: value }))}
                      >
                        <SelectTrigger className="w-full field-control">
                          <SelectValue placeholder="Selecione um chip" />
                        </SelectTrigger>
                        <SelectContent className="field-dropdown">
                          {chipOptions.length === 0 ? (
                            <SelectItem value="no-chip" disabled>
                              Nenhum chip disponível
                            </SelectItem>
                          ) : (
                            chipOptions.map((chip) => (
                              <SelectItem key={chip.value} value={chip.value}>
                                {chip.label}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Destino</Label>
                      <Input
                        value={targetForm.targetValue}
                        onChange={(e) => setTargetForm((current) => ({ ...current, targetValue: e.target.value }))}
                        className="field-control"
                        placeholder={targetForm.targetType === "group" ? "Ex: 1203...@g.us" : "Ex: 5511999999999"}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      value={targetForm.notes}
                      onChange={(e) => setTargetForm((current) => ({ ...current, notes: e.target.value }))}
                      className="min-h-[120px] field-control"
                        placeholder="Contexto de uso, campanha, origem do destinatário..."
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button className="btn-primary-modern action-save" onClick={handleSaveTarget}>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar destinatário
                    </Button>
                    <Button variant="outline" className="subtle-action" onClick={resetTargetForm}>
                      Limpar
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="card-premium-enhanced p-6">
                <h2 className="section-title">Destinatários cadastrados</h2>
                {isLoadingTargets ? (
                  <p className="text-gray-400">Carregando destinatários...</p>
                ) : targets.length === 0 ? (
                  <p className="text-gray-400">Nenhum destinatário cadastrado.</p>
                ) : (
                  <div className="space-y-4">
                    {targets.map((target) => (
                      <div key={target.id} className="surface-item">
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                          <div>
                            <h3 className="text-white font-semibold">{target.targetName}</h3>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline">{targetTypeLabels[target.targetType as TargetType]}</Badge>
                              <Badge variant={target.isActive ? "secondary" : "outline"}>
                                {target.isActive ? "Ativo" : "Inativo"}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              className="subtle-action"
                              onClick={() =>
                                setTargetForm({
                                  targetId: target.id,
                                  targetName: target.targetName,
                                  targetType: target.targetType as TargetType,
                                  targetValue: target.targetValue,
                                  notes: target.notes || "",
                                  isActive: Boolean(target.isActive),
                                })
                              }
                            >
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              className="danger-action"
                              onClick={() => handleDeleteTarget(target.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-200 break-all">{target.targetValue}</p>
                        {target.notes && <p className="text-sm text-gray-400 mt-2 whitespace-pre-wrap">{target.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <Card className="card-premium-enhanced p-6 mt-6">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5">
                <div>
                  <h2 className="section-title mb-1">Importar grupos do chip</h2>
                  <p className="section-subtitle">
                    Puxa grupos reais do chip conectado e importa como destinatários de grupo.
                  </p>
                </div>
                <div className="w-full md:w-80">
                  <Label>Chip conectado</Label>
                  <Select value={selectedGroupsChipId} onValueChange={setSelectedGroupsChipId}>
                    <SelectTrigger className="w-full field-control">
                      <SelectValue placeholder="Selecione um chip" />
                    </SelectTrigger>
                    <SelectContent className="field-dropdown">
                      {chipOptions.length === 0 ? (
                        <SelectItem value="no-chip" disabled>
                          Nenhum chip disponível
                        </SelectItem>
                      ) : (
                        chipOptions.map((chip) => (
                          <SelectItem key={chip.value} value={chip.value}>
                            {chip.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!selectedGroupsChipId ? (
                <p className="text-sm text-gray-400">Selecione um chip para descobrir os grupos disponíveis.</p>
              ) : isLoadingChipCatalog ? (
                <p className="text-sm text-gray-400">Buscando grupos do chip...</p>
              ) : chipGroups.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum grupo encontrado neste chip ou ele não está conectado.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" className="subtle-action" onClick={() => setSelectedGroupIds(chipGroups.filter((group) => !group.importedAsTarget).map((group) => group.id))}>
                      Selecionar todos
                    </Button>
                    <Button variant="outline" className="subtle-action" onClick={() => setSelectedGroupIds([])}>
                      Limpar seleção
                    </Button>
                    <Button variant="outline" className="subtle-action" onClick={() => utils.operations.listGroupCatalog.invalidate()}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Atualizar grupos
                    </Button>
                    <Button className="btn-primary-modern action-operations" onClick={handleImportGroups}>
                      <Download className="w-4 h-4 mr-2" />
                      Importar selecionados
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {chipGroups.map((group) => (
                      <label
                        key={group.id}
                        className="surface-item flex items-start gap-3 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedGroupIds.includes(group.id)}
                          onCheckedChange={(checked) => toggleImportedGroup(group.id, checked === true)}
                        />
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">{group.subject}</p>
                          <p className="text-xs text-gray-400 break-all mt-1">{group.id}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant={group.importedAsTarget ? "secondary" : "outline"}>
                              {group.importedAsTarget ? "Já é target" : "Não importado"}
                            </Badge>
                            <Badge variant="outline">{group.size} membros</Badge>
                            <Badge variant={group.announce ? "secondary" : "outline"}>
                              {group.announce ? "Somente admins" : "Livre"}
                            </Badge>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <Card className="card-premium-enhanced p-6 mt-6">
              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-slate-950/70 border border-white/10 flex items-center justify-center text-cyan-300">
                  <Link2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="section-title mb-1">Entrar em grupo por convite</h2>
                  <p className="section-subtitle">
                    Use um link ou código de convite do WhatsApp para o chip entrar no grupo e opcionalmente importar como target.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
                <div>
                  <Label>Chip conectado</Label>
                  <Select
                    value={inviteGroupForm.chipId}
                    onValueChange={(value) => setInviteGroupForm((current) => ({ ...current, chipId: value }))}
                  >
                    <SelectTrigger className="w-full field-control">
                      <SelectValue placeholder="Selecione um chip" />
                    </SelectTrigger>
                    <SelectContent className="field-dropdown">
                      {chipOptions.length === 0 ? (
                        <SelectItem value="no-chip" disabled>
                          Nenhum chip disponível
                        </SelectItem>
                      ) : (
                        chipOptions.map((chip) => (
                          <SelectItem key={chip.value} value={chip.value}>
                            {chip.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Link ou código do convite</Label>
                  <Input
                    value={inviteGroupForm.inviteLinkOrCode}
                    onChange={(e) => setInviteGroupForm((current) => ({ ...current, inviteLinkOrCode: e.target.value }))}
                    className="field-control"
                    placeholder="https://chat.whatsapp.com/..."
                  />
                </div>
              </div>

              {inviteGroupForm.chipId && inviteGroupForm.inviteLinkOrCode.trim().length >= 6 && (
                <div className="surface-item mt-4">
                  {isLoadingInvitePreview ? (
                    <p className="text-sm text-gray-400">Lendo convite do grupo...</p>
                  ) : invitePreview ? (
                    <div>
                      <p className="text-white font-semibold">{invitePreview.subject}</p>
                      <p className="text-xs text-gray-400 break-all mt-1">{invitePreview.id || invitePreview.inviteCode}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Badge variant="outline">{invitePreview.size || 0} membros</Badge>
                        <Badge variant="outline">Convite válido</Badge>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Sem preview disponível para este convite.</p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 mt-4 mb-4">
                <Checkbox
                  checked={inviteGroupForm.importAsTarget}
                  onCheckedChange={(checked) =>
                    setInviteGroupForm((current) => ({ ...current, importAsTarget: checked === true }))
                  }
                />
                <span className="text-sm text-gray-300">Importar automaticamente como target de grupo</span>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button className="btn-primary-modern action-dispatch" onClick={handleJoinGroupByInvite}>
                  <Link2 className="w-4 h-4 mr-2" />
                  Entrar no grupo
                </Button>
                <Button variant="outline" className="subtle-action" onClick={resetInviteGroupForm}>
                  Limpar
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
