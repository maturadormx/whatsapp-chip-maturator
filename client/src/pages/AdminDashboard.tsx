import { useAuth } from "@/_core/hooks/useAuth";
import { AdminEmptyState, AdminSkeletonGrid, AdminSkeletonTable, ShortcutHint } from "@/components/admin/AdminStates";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { trpc } from "@/lib/trpc";
import { toast as sonnerToast } from "sonner";
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle,
  Cpu,
  CreditCard,
  Crown,
  FileText,
  Filter,
  LayoutDashboard,
  Loader2,
  MoreHorizontal,
  PauseCircle,
  Pencil,
  Plus,
  Search,
  Shield,
  Sparkles,
  Users,
  Wifi,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { useLocation } from "wouter";
import "./AdminDashboard.css";

type AdminUserItem = any;
type SubscriptionPlanItem = any;
type CompanyChipItem = any;
type AuditLogItem = any;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value?: string | Date | null, withTime = false) {
  if (!value) return "N/D";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/D";
  return withTime ? date.toLocaleString("pt-BR") : date.toLocaleDateString("pt-BR");
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
      <div>
        <h2 className="text-xl font-semibold text-white tracking-tight">{title}</h2>
        {subtitle ? <p className="text-slate-400 text-sm mt-1">{subtitle}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  trend,
  trendValue,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  trend?: "up" | "down";
  trendValue?: string;
  icon: any;
}) {
  return (
    <div className="card-premium admin-kpi-card">
      <div className="flex items-start justify-between gap-4">
        <div className="admin-kpi-leading">
          <div className="admin-kpi-icon">
            <Icon className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="admin-kpi-copy">
            <h3 className="admin-kpi-label">{label}</h3>
            <p className="admin-kpi-value">{value}</p>
          </div>
        </div>
        {trend && trendValue ? (
          <span className={`admin-kpi-trend flex items-center font-medium ${trend === "up" ? "text-emerald-400" : "text-rose-400"}`}>
            {trend === "up" ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
            {trendValue}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function SubscriptionBadge({ status }: { status?: string | null }) {
  if (status === "active") {
    return (
      <span className="badge badge-success">
        <CheckCircle className="w-3 h-3" />
        Active
      </span>
    );
  }

  if (status === "trial") {
    return (
      <span className="badge badge-warning">
        <Sparkles className="w-3 h-3" />
        Trial
      </span>
    );
  }

  if (status === "cancelled" || status === "expired") {
    return (
      <span className="badge badge-danger">
        <XCircle className="w-3 h-3" />
        {status}
      </span>
    );
  }

  return <span className="badge badge-neutral">Sem assinatura</span>;
}

function ChipStatusBadge({ chip }: { chip: CompanyChipItem }) {
  if (chip.isPaused) {
    return (
      <span className="badge badge-info">
        <PauseCircle className="w-3 h-3" />
        Pausado
      </span>
    );
  }

  if (chip.status === "conectado") {
    return (
      <span className="badge badge-success">
        <CheckCircle className="w-3 h-3" />
        Conectado
      </span>
    );
  }

  if (chip.status === "maturando") {
    return (
      <span className="badge badge-warning">
        <PauseCircle className="w-3 h-3" />
        Maturando
      </span>
    );
  }

  return (
    <span className="badge badge-danger">
      <XCircle className="w-3 h-3" />
      Desconectado
    </span>
  );
}

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [subscriptionFilter, setSubscriptionFilter] = useState("all");
  const [companyOwnerFilter, setCompanyOwnerFilter] = useState("all");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);

  const [editRole, setEditRole] = useState("");
  const [editAccountStatus, setEditAccountStatus] = useState("");
  const [editSubscriptionPlanId, setEditSubscriptionPlanId] = useState("");
  const [editSubscriptionStatus, setEditSubscriptionStatus] = useState("");

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [planForm, setPlanForm] = useState({
    planName: "",
    description: "",
    maxChips: 0,
    maxMessagesPerMonth: 0,
    maxScheduledTasks: 0,
    priceMonthly: 0,
    isActive: 1,
  });
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isAuthenticated && user?.role !== "admin") {
      setLocation("/");
    }
  }, [isAuthenticated, user, setLocation]);

  const { data: stats, isLoading: statsLoading } = trpc.admin.getDashboardStats.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });
  const { data: users, isLoading: usersLoading } = trpc.admin.getAllUsers.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });
  const { data: plans, isLoading: plansLoading } = trpc.admin.getAllPlans.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });
  const { data: companyOverview } = trpc.admin.getCompanyOverview.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });
  const { data: companyChips } = trpc.admin.getCompanyChips.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });
  const { data: auditLogs } = trpc.admin.getAuditLogs.useQuery({ limit: 150 }, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  const createSubscriptionMutation = trpc.admin.createUserSubscription.useMutation();
  const updateUserAccountMutation = trpc.admin.updateUserAccount.useMutation();
  const updateUserSubscriptionMutation = trpc.admin.updateUserSubscription.useMutation();
  const updatePlanMutation = trpc.admin.updatePlan.useMutation();

  const safeUsers = (users ?? []) as AdminUserItem[];
  const safePlans = (plans ?? []) as SubscriptionPlanItem[];
  const safeCompanyChips = (companyChips ?? []) as CompanyChipItem[];
  const safeAuditLogs = (auditLogs ?? []) as AuditLogItem[];

  const adminInsights = useMemo(() => {
    const activeSubscriptions = safeUsers.filter((item) => item.subscription?.status === "active").length;
    const trialSubscriptions = safeUsers.filter((item) => item.subscription?.status === "trial").length;
    const usersWithoutSubscription = safeUsers.filter((item) => !item.subscription).length;

    const planUsage = safePlans
      .map((plan) => ({
        planId: plan.id,
        planName: plan.planName,
        users: safeUsers.filter((item) => item.subscription?.planId === plan.id).length,
        priceMonthly: plan.priceMonthly,
      }))
      .sort((a, b) => b.users - a.users);

    return {
      activeSubscriptions,
      trialSubscriptions,
      usersWithoutSubscription,
      topPlan: planUsage[0] ?? null,
      planUsage,
    };
  }, [safeUsers, safePlans]);

  const revenueProjection = useMemo(
    () => adminInsights.planUsage.reduce((sum, item) => sum + item.users * item.priceMonthly, 0),
    [adminInsights.planUsage]
  );

  const averageTicket = useMemo(() => {
    if (!adminInsights.planUsage.length) return 0;
    const paidUsers = adminInsights.planUsage.reduce((sum, item) => sum + item.users, 0);
    if (!paidUsers) return 0;
    return Math.round(revenueProjection / paidUsers);
  }, [adminInsights.planUsage, revenueProjection]);

  const planCommercialRows = useMemo(() => {
    return safePlans.map((plan) => {
      const usersCount = safeUsers.filter((item) => item.subscription?.planId === plan.id).length;
      const revenue = usersCount * plan.priceMonthly;
      const adoptionShare = stats?.totalUsers ? (usersCount / stats.totalUsers) * 100 : 0;
      return {
        ...plan,
        usersCount,
        revenue,
        adoptionShare,
        isTopPlan: adminInsights.topPlan?.planId === plan.id,
      };
    });
  }, [safePlans, safeUsers, stats?.totalUsers, adminInsights.topPlan]);

  const cheapestPlan = useMemo(() => {
    if (!planCommercialRows.length) return null;
    return [...planCommercialRows].sort((a, b) => a.priceMonthly - b.priceMonthly)[0] ?? null;
  }, [planCommercialRows]);

  const recentUsers = useMemo(
    () =>
      [...safeUsers]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [safeUsers]
  );

  const filteredUsers = useMemo(() => {
    return safeUsers.filter((item) => {
      const matchesSearch =
        !search.trim() ||
        item.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.email?.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === "all" || item.role === roleFilter;
      const matchesAccount =
        accountFilter === "all" ||
        (accountFilter === "active" && Boolean(item.isActive)) ||
        (accountFilter === "inactive" && !item.isActive);
      const subscriptionStatus = item.subscription?.status ?? "none";
      const matchesSubscription = subscriptionFilter === "all" || subscriptionStatus === subscriptionFilter;
      return matchesSearch && matchesRole && matchesAccount && matchesSubscription;
    });
  }, [safeUsers, search, roleFilter, accountFilter, subscriptionFilter]);

  const selectedUser = useMemo(() => safeUsers.find((item) => item.id === selectedUserId) ?? null, [safeUsers, selectedUserId]);

  const ownerOptions = useMemo(() => {
    const ownerMap = new Map<number, string>();
    safeCompanyChips.forEach((chip) => {
      ownerMap.set(chip.userId, chip.ownerName);
    });
    return Array.from(ownerMap.entries())
      .map(([userId, ownerName]) => ({ userId, ownerName }))
      .sort((a, b) => a.ownerName.localeCompare(b.ownerName));
  }, [safeCompanyChips]);

  const filteredCompanyChips = useMemo(() => {
    if (companyOwnerFilter === "all") return safeCompanyChips;
    return safeCompanyChips.filter((chip) => String(chip.userId) === companyOwnerFilter);
  }, [safeCompanyChips, companyOwnerFilter]);

  const fleetStats = useMemo(() => {
    const connected = companyOverview?.chipsByStatus.connected ?? 0;
    const maturing = companyOverview?.chipsByStatus.maturing ?? 0;
    const disconnected = companyOverview?.chipsByStatus.disconnected ?? 0;
    const paused = companyOverview?.chipsByStatus.paused ?? 0;
    return { connected, maturing, disconnected, paused };
  }, [companyOverview]);

  const activeChipCount = fleetStats.connected + fleetStats.maturing;
  const trialRate = stats?.totalUsers ? `${((adminInsights.trialSubscriptions / stats.totalUsers) * 100).toFixed(1)}%` : "0%";
  const activeRate = stats?.totalUsers ? `${((stats.activeUsers / stats.totalUsers) * 100).toFixed(0)}%` : "0%";
  const selectionSummary =
    selectedUserIds.length === 0 ? "Nenhum usuário selecionado" : `${selectedUserIds.length} usuário(s) selecionado(s)`;

  const adoptionChartData = useMemo(
    () =>
      adminInsights.planUsage.map((item, index) => ({
        name: item.planName,
        usuarios: item.users,
        receita: Number((item.users * item.priceMonthly) / 100),
        fill: ["#6366f1", "#8b5cf6", "#22c55e", "#38bdf8", "#f59e0b"][index % 5],
      })),
    [adminInsights.planUsage]
  );

  useEffect(() => {
    if (!selectedUser) {
      setEditRole("");
      setEditAccountStatus("");
      setEditSubscriptionPlanId("");
      setEditSubscriptionStatus("");
      return;
    }

    setEditRole(selectedUser.role);
    setEditAccountStatus(selectedUser.isActive ? "active" : "inactive");
    setEditSubscriptionPlanId(selectedUser.subscription?.planId ? String(selectedUser.subscription.planId) : "");
    setEditSubscriptionStatus(selectedUser.subscription?.status ?? "");
  }, [selectedUser]);

  useEffect(() => {
    setSelectedUserIds((previous) => previous.filter((id) => filteredUsers.some((user) => user.id === id)));
  }, [filteredUsers]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable;

      if (event.altKey && ["1", "2", "3", "4", "5"].includes(event.key)) {
        event.preventDefault();
        const nextTab = ["overview", "users", "plans", "company", "audit"][Number(event.key) - 1];
        setActiveTab(nextTab);
        return;
      }

      if (!isTyping && event.key === "/") {
        event.preventDefault();
        setActiveTab("users");
        requestAnimationFrame(() => searchInputRef.current?.focus());
        return;
      }

      if (!isTyping && event.shiftKey && event.key.toLowerCase() === "a" && activeTab === "users") {
        event.preventDefault();
        setSelectedUserIds(filteredUsers.map((item) => item.id));
        return;
      }

      if (!isTyping && event.key === "Escape") {
        setSelectedUserIds([]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTab, filteredUsers]);

  async function refreshAdminData() {
    await Promise.all([
      utils.admin.getAllUsers.invalidate(),
      utils.admin.getAllPlans.invalidate(),
      utils.admin.getDashboardStats.invalidate(),
      utils.admin.getCompanyOverview.invalidate(),
      utils.admin.getCompanyChips.invalidate(),
      utils.admin.getAuditLogs.invalidate(),
    ]);
  }

  const handleOpenSubscriptionDialog = (userId: number) => {
    setSelectedUserId(userId);
    setSelectedPlanId("");
    setSubscriptionDialogOpen(true);
  };

  const handleCreateSubscription = async () => {
    if (!selectedUserId || !selectedPlanId) {
      sonnerToast.error("Selecione um plano para criar a assinatura.");
      return;
    }

    try {
      await createSubscriptionMutation.mutateAsync({
        userId: selectedUserId,
        planId: Number(selectedPlanId),
      });
      await refreshAdminData();
      sonnerToast.success("Assinatura criada com sucesso.");
      setSubscriptionDialogOpen(false);
    } catch (error: any) {
      sonnerToast.error(error?.message || "Falha ao criar assinatura.");
    }
  };

  const handleUpdateAccount = async () => {
    if (!selectedUser) return;
    try {
      await updateUserAccountMutation.mutateAsync({
        userId: selectedUser.id,
        role: editRole as "user" | "admin",
        isActive: editAccountStatus === "active" ? 1 : 0,
      });
      await refreshAdminData();
      sonnerToast.success("Conta atualizada.");
    } catch (error: any) {
      sonnerToast.error(error?.message || "Falha ao atualizar conta.");
    }
  };

  const handleUpdateSubscription = async () => {
    if (!selectedUser?.subscription) {
      sonnerToast.error("Este usuário ainda não tem assinatura.");
      return;
    }

    try {
      await updateUserSubscriptionMutation.mutateAsync({
        userId: selectedUser.id,
        planId: editSubscriptionPlanId ? Number(editSubscriptionPlanId) : undefined,
        status: editSubscriptionStatus as "active" | "cancelled" | "expired" | "trial",
      });
      await refreshAdminData();
      sonnerToast.success("Assinatura atualizada.");
    } catch (error: any) {
      sonnerToast.error(error?.message || "Falha ao atualizar assinatura.");
    }
  };

  const handleOpenPlanDialog = (plan: SubscriptionPlanItem) => {
    setEditingPlanId(plan.id);
    setPlanForm({
      planName: plan.planName ?? "",
      description: plan.description ?? "",
      maxChips: plan.maxChips ?? 0,
      maxMessagesPerMonth: plan.maxMessagesPerMonth ?? 0,
      maxScheduledTasks: plan.maxScheduledTasks ?? 0,
      priceMonthly: plan.priceMonthly ?? 0,
      isActive: plan.isActive ?? 1,
    });
    setPlanDialogOpen(true);
  };

  const handleSavePlan = async () => {
    if (!editingPlanId) return;
    try {
      await updatePlanMutation.mutateAsync({
        planId: editingPlanId,
        planName: planForm.planName,
        description: planForm.description,
        maxChips: Number(planForm.maxChips),
        maxMessagesPerMonth: Number(planForm.maxMessagesPerMonth),
        maxScheduledTasks: Number(planForm.maxScheduledTasks),
        priceMonthly: Number(planForm.priceMonthly),
        isActive: Number(planForm.isActive),
      });
      await refreshAdminData();
      sonnerToast.success("Plano atualizado.");
      setPlanDialogOpen(false);
    } catch (error: any) {
      sonnerToast.error(error?.message || "Falha ao atualizar plano.");
    }
  };

  const toggleSelectedUser = (userId: number, checked: boolean) => {
    setSelectedUserIds((previous) => {
      if (checked) {
        return previous.includes(userId) ? previous : [...previous, userId];
      }
      return previous.filter((id) => id !== userId);
    });
  };

  const toggleSelectAllFilteredUsers = (checked: boolean) => {
    setSelectedUserIds(checked ? filteredUsers.map((item) => item.id) : []);
  };

  const handleBulkAccountUpdate = async (payload: { role?: "user" | "admin"; isActive?: number }, successLabel: string) => {
    if (!selectedUserIds.length) {
      sonnerToast.error("Selecione pelo menos um usuário.", {
        description: "Use as checkboxes da tabela para ativar as ações em lote.",
      });
      return;
    }

    try {
      await Promise.all(
        selectedUserIds.map((userId) =>
          updateUserAccountMutation.mutateAsync({
            userId,
            role: payload.role,
            isActive: payload.isActive,
          })
        )
      );
      await refreshAdminData();
      setSelectedUserIds([]);
      sonnerToast.success(successLabel, {
        description: "As contas selecionadas foram atualizadas.",
      });
    } catch (error: any) {
      sonnerToast.error(error?.message || "Falha ao aplicar ação em lote.");
    }
  };

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-8">
        <div className="card-premium p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-white mb-3">Acesso negado</h1>
          <p className="text-slate-400 text-sm">Você precisa estar logado como administrador para acessar esta área.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Visão Geral", icon: LayoutDashboard },
    { id: "users", label: "Usuários", icon: Users },
    { id: "plans", label: "Planos", icon: CreditCard },
    { id: "company", label: "Empresa", icon: Cpu },
    { id: "audit", label: "Auditoria", icon: Shield },
  ];

  return (
    <div className="admin-page min-h-screen text-slate-200 p-6 md:p-8">
      <div className="admin-shell">
        <p className="page-breadcrumb page-breadcrumb-cyan mb-4">Central admin / painel administrativo</p>
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Painel administrativo</h1>
            <p className="text-slate-400 text-sm mt-1">M13 Group • visão executiva de usuários, planos, empresa e auditoria.</p>
          </div>

          <div className="flex items-center gap-3">
            <button className="btn-ghost" onClick={() => setLocation("/admin-systems")}>
              <ArrowLeft className="w-4 h-4" />
              Central admin
            </button>
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium text-white">{user?.name || "Admin Master"}</p>
              <p className="text-xs text-slate-500">{user?.email || "admin@saas.com"}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border-2 border-slate-800 shadow-lg" />
          </div>
        </header>

        <nav className="flex overflow-x-auto pb-4 mb-6 border-b border-white/5">
          <div className="flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${isActive ? "admin-tab-pill admin-tab-pill-active" : "admin-tab-pill"}`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-indigo-400" : ""}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        <main className="min-h-[560px]">
          {activeTab === "overview" && (
            <div className="space-y-8 animate-in fade-in duration-500">
              {statsLoading ? (
                <>
                  <AdminSkeletonGrid count={4} />
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="card-premium p-6 lg:col-span-2">
                      <div className="admin-skeleton h-5 w-44 rounded mb-2" />
                      <div className="admin-skeleton h-3 w-56 rounded mb-6" />
                      <div className="admin-skeleton h-64 rounded-xl" />
                    </div>
                    <div className="card-premium p-6">
                      <div className="admin-skeleton h-5 w-36 rounded mb-2" />
                      <div className="admin-skeleton h-3 w-40 rounded mb-6" />
                      <div className="space-y-3">
                        <div className="admin-skeleton h-16 rounded-lg" />
                        <div className="admin-skeleton h-16 rounded-lg" />
                        <div className="admin-skeleton h-16 rounded-lg" />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="admin-overview-kpi-grid">
                    <StatCard label="Total Usuários" value={formatCompactNumber(stats?.totalUsers ?? 0)} trend="up" trendValue={activeRate} icon={Users} />
                    <StatCard label="Receita MRR" value={formatCurrency(revenueProjection)} trend="up" trendValue={`${adminInsights.activeSubscriptions} ativos`} icon={CreditCard} />
                    <StatCard label="Chips Ativos" value={formatCompactNumber(activeChipCount)} trend={fleetStats.disconnected > 0 ? "down" : "up"} trendValue={`${fleetStats.connected} online`} icon={Cpu} />
                    <StatCard label="Taxa de Trial" value={trialRate} trend="up" trendValue={`${adminInsights.trialSubscriptions} contas`} icon={Activity} />
                  </div>

                  <div className="admin-overview-main-grid">
                    <div className="card-premium p-6">
                      <SectionHeader
                        title="Adoção por Plano"
                        subtitle="Distribuição atual da base e tração comercial"
                        action={<ShortcutHint text="Alt + 1..5 troca as abas" />}
                      />
                      {adoptionChartData.length > 0 ? (
                        <ChartContainer
                          config={{
                            usuarios: { label: "Usuários", color: "#6366f1" },
                            receita: { label: "Receita", color: "#38bdf8" },
                          }}
                          className="h-72 w-full"
                        >
                          <BarChart data={adoptionChartData} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
                            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} stroke="#64748b" />
                            <YAxis tickLine={false} axisLine={false} tickMargin={10} stroke="#64748b" allowDecimals={false} />
                            <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                            <Bar dataKey="usuarios" radius={[10, 10, 0, 0]}>
                              {adoptionChartData.map((entry) => (
                                <Cell key={entry.name} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ChartContainer>
                      ) : (
                        <AdminEmptyState
                          title="Sem adoção para mostrar"
                          description="Ainda não há planos com usuários suficientes para montar o gráfico."
                          action={<button className="btn-ghost" onClick={() => setActiveTab("plans")}>Ver planos</button>}
                        />
                      )}
                    </div>

                    <div className="card-premium p-5">
                      <SectionHeader title="Atenção Necessária" subtitle="Alertas administrativos e operacionais" />
                      <div className="admin-compact-stack">
                        <div className="admin-soft-row py-2.5">
                          <div className="w-2 h-2 rounded-full bg-amber-500" />
                          <div className="flex-1">
                            <p className="text-sm text-slate-200 font-medium">{adminInsights.trialSubscriptions} trials exigem atenção</p>
                            <p className="text-xs text-slate-500">Contas em trial podem ser trabalhadas pelo comercial.</p>
                          </div>
                        </div>
                        <div className="admin-soft-row py-2.5">
                          <div className="w-2 h-2 rounded-full bg-rose-500" />
                          <div className="flex-1">
                            <p className="text-sm text-slate-200 font-medium">{fleetStats.disconnected} chips desconectados</p>
                            <p className="text-xs text-slate-500">Acompanhe a reconexão e revise a saúde da frota.</p>
                          </div>
                        </div>
                        <div className="admin-soft-row py-2.5">
                          <div className="w-2 h-2 rounded-full bg-sky-500" />
                          <div className="flex-1">
                            <p className="text-sm text-slate-200 font-medium">{adminInsights.usersWithoutSubscription} usuários sem assinatura</p>
                            <p className="text-xs text-slate-500">Existe espaço claro para conversão ou saneamento de base.</p>
                          </div>
                        </div>
                        <button className="w-full mt-2 btn-ghost justify-center" onClick={() => setActiveTab("audit")}>
                          Ver todos os eventos
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="admin-overview-secondary-grid">
                    <div className="card-premium p-5">
                      <SectionHeader title="Leitura Executiva" subtitle="Resumo comercial e administrativo do momento" />
                      <div className="admin-compact-metrics">
                        <div className="card-premium-muted p-3">
                          <p className="text-slate-400 text-[11px] uppercase tracking-wider mb-1">Assinaturas ativas</p>
                          <p className="text-lg font-bold text-white">{adminInsights.activeSubscriptions}</p>
                          <p className="text-[11px] text-slate-500 mt-1">base recorrente atual</p>
                        </div>
                        <div className="card-premium-muted p-3">
                          <p className="text-slate-400 text-[11px] uppercase tracking-wider mb-1">Ticket médio</p>
                          <p className="text-lg font-bold text-white">{formatCurrency(averageTicket)}</p>
                          <p className="text-[11px] text-slate-500 mt-1">por usuário pagante</p>
                        </div>
                        <div className="card-premium-muted p-3">
                          <p className="text-slate-400 text-[11px] uppercase tracking-wider mb-1">Plano líder</p>
                          <p className="text-lg font-bold text-white capitalize">{adminInsights.topPlan?.planName ?? "N/D"}</p>
                          <p className="text-[11px] text-slate-500 mt-1">maior adoção na base</p>
                        </div>
                      </div>
                    </div>

                    <div className="card-premium p-5">
                      <SectionHeader title="Entradas Recentes" subtitle="Últimos usuários criados" />
                      <div className="grid grid-cols-1 gap-2">
                        {recentUsers.map((item) => (
                          <div key={item.id} className="admin-soft-row py-2.5">
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-indigo-300 text-xs font-semibold">
                              {(item.name || item.email || "U").slice(0, 1).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">{item.name || "Sem nome"}</p>
                              <p className="text-[11px] text-slate-500 truncate">{item.email || "Sem email"}</p>
                            </div>
                            <span className="text-[11px] text-slate-500 whitespace-nowrap">{formatDate(item.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "users" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <SectionHeader
                title="Gerenciamento de Usuários"
                subtitle="Visualize, filtre e administre contas e assinaturas"
                action={
                  <div className="flex flex-wrap gap-2">
                    <ShortcutHint text="/ foca na busca • Shift+A seleciona tudo" />
                    <button
                      className="btn-ghost"
                      onClick={() => {
                        setSearch("");
                        setRoleFilter("all");
                        setAccountFilter("all");
                        setSubscriptionFilter("all");
                        setSelectedUserIds([]);
                      }}
                    >
                      <Filter className="w-4 h-4" />
                      Limpar filtros
                    </button>
                  </div>
                }
              />

              <div className="admin-filter-strip">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    type="text"
                    ref={searchInputRef}
                    placeholder="Buscar por nome ou email..."
                    className="input-premium w-full pl-9"
                  />
                </div>

                <select className="input-premium w-auto min-w-[160px]" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                  <option value="all">Todos os papéis</option>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                </select>

                <select className="input-premium w-auto min-w-[160px]" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
                  <option value="all">Status: Todos</option>
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>

                <select className="input-premium w-auto min-w-[180px]" value={subscriptionFilter} onChange={(e) => setSubscriptionFilter(e.target.value)}>
                  <option value="all">Assinaturas: Todas</option>
                  <option value="active">Ativa</option>
                  <option value="trial">Trial</option>
                  <option value="none">Sem assinatura</option>
                  <option value="cancelled">Cancelada</option>
                  <option value="expired">Expirada</option>
                </select>
              </div>

              {selectedUserIds.length > 0 ? (
                <div className="admin-bulk-bar">
                  <div>
                    <p className="text-sm font-medium text-white">{selectionSummary}</p>
                    <p className="text-xs text-slate-400 mt-1">Ações em lote agem nas contas selecionadas da tabela.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-ghost" onClick={() => handleBulkAccountUpdate({ isActive: 1 }, "Usuários ativados")}>
                      Ativar
                    </button>
                    <button className="btn-ghost" onClick={() => handleBulkAccountUpdate({ isActive: 0 }, "Usuários inativados")}>
                      Inativar
                    </button>
                    <button className="btn-primary" onClick={() => handleBulkAccountUpdate({ role: "admin" }, "Usuários promovidos")}>
                      Tornar admin
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="admin-users-main-grid">
                <div className="card-premium admin-users-table-card">
                  <div className="p-5 border-b border-white/5 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-slate-200">Base de usuários</h3>
                      <p className="text-xs text-slate-500 mt-1">{filteredUsers.length} usuário(s) encontrados</p>
                    </div>
                  </div>

                  {usersLoading ? (
                    <AdminSkeletonTable rows={6} />
                  ) : filteredUsers.length > 0 ? (
                    <table className="table-premium">
                      <thead>
                        <tr>
                          <th className="w-12">
                            <Checkbox
                              checked={filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length}
                              onCheckedChange={(checked) => toggleSelectAllFilteredUsers(Boolean(checked))}
                            />
                          </th>
                          <th>Usuário</th>
                          <th>Papel</th>
                          <th>Plano</th>
                          <th>Status</th>
                          <th>Criado</th>
                          <th className="text-right pr-4">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((item) => {
                          const currentPlan = safePlans.find((plan) => plan.id === item.subscription?.planId);
                          return (
                            <tr key={item.id} className="group cursor-pointer" onClick={() => setSelectedUserId(item.id)}>
                              <td onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedUserIds.includes(item.id)}
                                  onCheckedChange={(checked) => toggleSelectedUser(item.id, Boolean(checked))}
                                />
                              </td>
                              <td>
                                <div className="flex flex-col">
                                  <span className="font-medium text-white">{item.name || "Sem nome"}</span>
                                  <span className="text-xs text-slate-500">{item.email || "Sem email"}</span>
                                </div>
                              </td>
                              <td>
                                <span className={`badge ${item.role === "admin" ? "badge-info" : "badge-neutral"}`}>{item.role === "admin" ? "Admin" : "User"}</span>
                              </td>
                              <td className="text-slate-300">{currentPlan?.planName ?? "—"}</td>
                              <td>
                                <div className="flex flex-col gap-2">
                                  <SubscriptionBadge status={item.subscription?.status} />
                                  <span className={`badge ${item.isActive ? "badge-success" : "badge-danger"}`}>
                                    {item.isActive ? "Conta ativa" : "Conta inativa"}
                                  </span>
                                </div>
                              </td>
                              <td className="text-slate-500 text-xs">{formatDate(item.createdAt)}</td>
                              <td className="text-right pr-4">
                                <div className="flex items-center justify-end gap-2">
                                  <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); setSelectedUserId(item.id); }}>
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>
                                  {!item.subscription ? (
                                    <button
                                      className="btn-primary"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenSubscriptionDialog(item.id);
                                      }}
                                    >
                                      <Plus className="w-4 h-4" />
                                      Assinar
                                    </button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <AdminEmptyState
                      variant="search"
                      title="Nenhum usuário encontrado"
                      description="Ajuste os filtros ou limpe a busca para voltar a ver a base completa."
                      action={
                        <button
                          className="btn-ghost"
                          onClick={() => {
                            setSearch("");
                            setRoleFilter("all");
                            setAccountFilter("all");
                            setSubscriptionFilter("all");
                          }}
                        >
                          Limpar busca
                        </button>
                      }
                    />
                  )}
                </div>

                <div className="card-premium admin-users-panel">
                  <SectionHeader title="Painel do Usuário" subtitle="Resumo e ações administrativas" />
                  {selectedUser ? (
                    <div className="space-y-4">
                      <div className="card-premium-muted admin-user-summary">
                        <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Usuário</p>
                        <p className="text-lg font-semibold text-white">{selectedUser.name || "Sem nome"}</p>
                        <p className="text-xs text-slate-500 mt-1">{selectedUser.email || "Sem email"}</p>
                      </div>

                      <div className="card-premium-muted admin-user-action-card">
                        <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">Conta</p>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <select className="input-premium" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                          <select className="input-premium" value={editAccountStatus} onChange={(e) => setEditAccountStatus(e.target.value)}>
                            <option value="active">Ativa</option>
                            <option value="inactive">Inativa</option>
                          </select>
                        </div>
                        <button className="btn-primary w-full" onClick={handleUpdateAccount} disabled={updateUserAccountMutation.isPending}>
                          {updateUserAccountMutation.isPending ? "Salvando..." : "Salvar conta"}
                        </button>
                      </div>

                      {selectedUser.subscription ? (
                        <div className="card-premium-muted admin-user-action-card">
                          <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">Assinatura</p>
                          <div className="grid grid-cols-1 gap-2 mb-3">
                            <select className="input-premium" value={editSubscriptionPlanId} onChange={(e) => setEditSubscriptionPlanId(e.target.value)}>
                              <option value="">Selecione um plano</option>
                              {safePlans.map((plan) => (
                                <option key={plan.id} value={String(plan.id)}>
                                  {plan.planName}
                                </option>
                              ))}
                            </select>

                            <select className="input-premium" value={editSubscriptionStatus} onChange={(e) => setEditSubscriptionStatus(e.target.value)}>
                              <option value="active">Active</option>
                              <option value="trial">Trial</option>
                              <option value="cancelled">Cancelled</option>
                              <option value="expired">Expired</option>
                            </select>
                          </div>
                          <button className="btn-primary w-full" onClick={handleUpdateSubscription} disabled={updateUserSubscriptionMutation.isPending}>
                            {updateUserSubscriptionMutation.isPending ? "Atualizando..." : "Atualizar assinatura"}
                          </button>
                        </div>
                      ) : (
                        <div className="card-premium-muted admin-user-action-card">
                          <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Assinatura</p>
                          <p className="text-sm text-slate-300 mb-3">Este usuário ainda não possui assinatura vinculada.</p>
                          <button className="btn-primary w-full" onClick={() => handleOpenSubscriptionDialog(selectedUser.id)}>
                            <Plus className="w-4 h-4" />
                            Criar assinatura
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="card-premium-muted admin-user-panel-empty text-sm text-slate-400">
                      Selecione um usuário na tabela para abrir o painel lateral de ações.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "plans" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <SectionHeader
                title="Gestão de Planos"
                subtitle="Compare preço, limite, adoção e receita com uma leitura mais comercial"
                action={<ShortcutHint text="Alt+3 abre planos • edição salva e audita" />}
              />

              <div className="admin-overview-kpi-grid">
                <StatCard label="Total de Planos" value={formatCompactNumber(safePlans.length)} icon={CreditCard} />
                <StatCard
                  label="Planos Ativos"
                  value={formatCompactNumber(safePlans.filter((plan) => plan.isActive !== 0).length)}
                  icon={CheckCircle}
                />
                <StatCard label="Ticket Médio" value={formatCurrency(averageTicket)} icon={Activity} />
                <StatCard label="Receita Potencial" value={formatCurrency(revenueProjection)} icon={FileText} />
              </div>

              {plansLoading ? (
                <AdminSkeletonGrid count={3} />
              ) : safePlans.length > 0 ? (
                <>
                  <div className="admin-plans-top-grid">
                    <div className="card-premium admin-plan-showcase">
                      <div className="flex items-start justify-between gap-4 mb-5">
                        <div>
                          <span className="admin-plan-badge">
                            <Crown className="w-3.5 h-3.5" />
                            plano em destaque
                          </span>
                          <h3 className="text-2xl font-semibold text-white tracking-tight mt-3 capitalize">
                            {adminInsights.topPlan?.planName ?? "Sem plano líder"}
                          </h3>
                          <p className="text-sm text-slate-400 mt-2 max-w-xl">
                            {safePlans.find((plan) => plan.id === adminInsights.topPlan?.planId)?.description || "O plano com maior adoção atual recebe destaque para facilitar a leitura comercial."}
                          </p>
                        </div>
                        <CreditCard className="w-5 h-5 text-indigo-300/75 mt-1" />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="card-premium-muted p-4">
                          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Preço</p>
                          <p className="text-2xl font-bold text-white">
                            {formatCurrency(
                              safePlans.find((plan) => plan.id === adminInsights.topPlan?.planId)?.priceMonthly ?? 0
                            )}
                          </p>
                        </div>
                        <div className="card-premium-muted p-4">
                          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Usuários</p>
                          <p className="text-2xl font-bold text-white">{formatCompactNumber(adminInsights.topPlan?.users ?? 0)}</p>
                        </div>
                        <div className="card-premium-muted p-4">
                          <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Receita potencial</p>
                          <p className="text-2xl font-bold text-white">
                            {formatCurrency((adminInsights.topPlan?.users ?? 0) * (adminInsights.topPlan?.priceMonthly ?? 0))}
                          </p>
                        </div>
                      </div>

                      {cheapestPlan ? (
                        <div className="admin-plan-insight-strip mt-4">
                          <div>
                            <p className="admin-plan-insight-label">Plano mais acessível</p>
                            <p className="admin-plan-insight-value capitalize">{cheapestPlan.planName}</p>
                          </div>
                          <div>
                            <p className="admin-plan-insight-label">Menor preço</p>
                            <p className="admin-plan-insight-value">{formatCurrency(cheapestPlan.priceMonthly)}</p>
                          </div>
                          <div>
                            <p className="admin-plan-insight-label">Base atual</p>
                            <p className="admin-plan-insight-value">{formatCompactNumber(cheapestPlan.usersCount)}</p>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="card-premium p-5">
                      <SectionHeader title="Comparativo rápido" subtitle="Leitura de adoção e retorno por plano" />
                      <div className="space-y-3">
                        {adminInsights.planUsage.map((item) => {
                          const usageWidth = adminInsights.topPlan?.users
                            ? Math.max(10, (item.users / adminInsights.topPlan.users) * 100)
                            : 10;
                          return (
                            <div key={item.planId} className="card-premium-muted p-3">
                              <div className="flex items-center justify-between gap-3 mb-2">
                                <p className="text-sm font-medium text-white capitalize">{item.planName}</p>
                                <p className="text-xs text-slate-400">
                                  {item.users} usuários • {formatCurrency(item.priceMonthly)}
                                </p>
                              </div>
                              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-400 to-violet-400"
                                  style={{ width: `${usageWidth}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="admin-plan-card-grid">
                    {planCommercialRows.map((plan) => {
                      const isCheapest = cheapestPlan?.id === plan.id;
                      return (
                        <div
                          key={plan.id}
                          className={`card-premium admin-plan-card ${
                            plan.isTopPlan ? "admin-plan-card-top" : isCheapest ? "admin-plan-card-cheapest" : ""
                          }`}
                        >
                          <div className="admin-plan-card-glow" />
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                {plan.isTopPlan ? (
                                  <span className="admin-plan-badge">
                                    <Crown className="w-3.5 h-3.5" />
                                    líder
                                  </span>
                                ) : null}
                                {isCheapest ? (
                                  <span className="admin-plan-badge admin-plan-badge-soft">
                                    melhor entrada
                                  </span>
                                ) : null}
                                <span className={`badge ${plan.isActive !== 0 ? "badge-success" : "badge-neutral"}`}>
                                  {plan.isActive !== 0 ? "Ativo" : "Inativo"}
                                </span>
                              </div>
                              <h3 className="text-xl font-semibold text-white capitalize">{plan.planName}</h3>
                              <p className="text-sm text-slate-400 mt-2 min-h-[40px]">{plan.description || "Sem descrição"}</p>
                            </div>
                            <CreditCard className="w-5 h-5 text-indigo-300/70 mt-1" />
                          </div>

                          <div className="mb-4">
                            <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500 mb-1">Preço mensal</p>
                            <p className="text-3xl font-bold text-white tracking-tight">{formatCurrency(plan.priceMonthly)}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {plan.adoptionShare.toFixed(1)}% da base atual
                            </p>
                          </div>

                          <div className="admin-plan-card-feature-list">
                            <div className="admin-plan-card-feature">
                              <span className="text-sm text-slate-400">Usuários no plano</span>
                              <strong className="text-white">{formatCompactNumber(plan.usersCount)}</strong>
                            </div>
                            <div className="admin-plan-card-feature">
                              <span className="text-sm text-slate-400">Receita potencial</span>
                              <strong className="text-white">{formatCurrency(plan.revenue)}</strong>
                            </div>
                            <div className="admin-plan-card-feature">
                              <span className="text-sm text-slate-400">Máx. chips</span>
                              <strong className="text-white">{plan.maxChips}</strong>
                            </div>
                            <div className="admin-plan-card-feature">
                              <span className="text-sm text-slate-400">Máx. tarefas</span>
                              <strong className="text-white">{plan.maxScheduledTasks}</strong>
                            </div>
                            <div className="admin-plan-card-feature">
                              <span className="text-sm text-slate-400">Mensagens/mês</span>
                              <strong className="text-white">{plan.maxMessagesPerMonth === -1 ? "Ilimitado" : formatCompactNumber(plan.maxMessagesPerMonth)}</strong>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-white/5">
                            <div>
                              <p className="text-[11px] text-slate-500 uppercase tracking-[0.08em]">Adoção</p>
                              <p className="text-sm text-slate-300 mt-1">{plan.adoptionShare.toFixed(1)}% da base</p>
                            </div>
                            <button className="btn-primary" onClick={() => handleOpenPlanDialog(plan)}>
                              <Pencil className="w-4 h-4" />
                              Editar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="card-premium admin-plan-table-wrap">
                    <div className="p-5 border-b border-white/5">
                      <SectionHeader title="Radar executivo dos planos" subtitle="Comparação direta de posicionamento comercial e retorno" />
                    </div>
                    <div className="admin-plan-executive-list">
                      {planCommercialRows.map((plan) => (
                        <div key={`exec-${plan.id}`} className="admin-plan-executive-row">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-semibold text-white capitalize">{plan.planName}</p>
                              {plan.isTopPlan ? <span className="badge badge-info">líder</span> : null}
                              {cheapestPlan?.id === plan.id ? <span className="badge badge-warning">mais barato</span> : null}
                            </div>
                            <p className="text-xs text-slate-500 truncate">{plan.description || "Sem descrição"}</p>
                          </div>

                          <div className="admin-plan-executive-metrics">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Preço</p>
                              <p className="text-sm font-semibold text-white">{formatCurrency(plan.priceMonthly)}</p>
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Usuários</p>
                              <p className="text-sm font-semibold text-white">{formatCompactNumber(plan.usersCount)}</p>
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Receita</p>
                              <p className="text-sm font-semibold text-white">{formatCurrency(plan.revenue)}</p>
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Capacidade</p>
                              <p className="text-sm font-semibold text-white">{plan.maxChips} chips • {plan.maxScheduledTasks} tarefas</p>
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">Status</p>
                              <span className={`badge mt-1 ${plan.isActive !== 0 ? "badge-success" : "badge-neutral"}`}>
                                {plan.isActive !== 0 ? "Ativo" : "Inativo"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <AdminEmptyState
                  title="Nenhum plano cadastrado"
                  description="Crie ou sincronize planos para liberar a gestão comercial desta área."
                />
              )}
            </div>
          )}

          {activeTab === "company" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <SectionHeader title="Frota de Chips" subtitle="Visão geral do parque operacional e detalhe da frota" />

              <div className="admin-company-top-grid">
                <div className="card-premium admin-company-status-card border-l-emerald-500">
                  <p className="text-slate-400 text-[11px] uppercase tracking-wider mb-1">Conectados</p>
                  <p className="text-xl font-bold text-white">{fleetStats.connected}</p>
                </div>
                <div className="card-premium admin-company-status-card border-l-amber-500">
                  <p className="text-slate-400 text-[11px] uppercase tracking-wider mb-1">Maturando</p>
                  <p className="text-xl font-bold text-white">{fleetStats.maturing}</p>
                </div>
                <div className="card-premium admin-company-status-card border-l-rose-500">
                  <p className="text-slate-400 text-[11px] uppercase tracking-wider mb-1">Desconectados</p>
                  <p className="text-xl font-bold text-white">{fleetStats.disconnected}</p>
                </div>
                <div className="card-premium admin-company-status-card border-l-slate-500">
                  <p className="text-slate-400 text-[11px] uppercase tracking-wider mb-1">Pausados</p>
                  <p className="text-xl font-bold text-white">{fleetStats.paused}</p>
                </div>
              </div>

              <div className="admin-company-main-grid">
                <div className="card-premium p-5 admin-company-highlight">
                  <SectionHeader title="Saúde da Frota" subtitle="Leitura rápida da operação" />
                  <div className="admin-company-health-grid">
                    <div className="admin-soft-row py-2.5">
                      <Wifi className="w-4 h-4 text-emerald-400" />
                      <div>
                        <p className="text-sm font-medium text-white">{fleetStats.connected} chips online</p>
                        <p className="text-[11px] text-slate-500">Base pronta para operação imediata.</p>
                      </div>
                    </div>
                    <div className="admin-soft-row py-2.5">
                      <PauseCircle className="w-4 h-4 text-amber-400" />
                      <div>
                        <p className="text-sm font-medium text-white">{fleetStats.maturing} chips em maturação</p>
                        <p className="text-[11px] text-slate-500">Acompanhe a evolução antes de forçar carga.</p>
                      </div>
                    </div>
                    <div className="admin-soft-row py-2.5">
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <div>
                        <p className="text-sm font-medium text-white">{fleetStats.disconnected} chips fora</p>
                        <p className="text-[11px] text-slate-500">Avalie reconexão e limpeza da frota.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card-premium p-5 admin-company-highlight">
                  <SectionHeader title="Usuários com mais chips" subtitle="Quem concentra maior carga operacional" />
                  <div className="admin-chip-owners-grid">
                    {(companyOverview?.userChipLoad ?? []).map((item: any) => (
                      <div key={item.userId} className="admin-soft-row justify-between py-2.5">
                        <div>
                          <p className="text-sm font-medium text-white">{item.userName}</p>
                          <p className="text-[11px] text-slate-500">owner #{item.userId}</p>
                        </div>
                        <span className="badge badge-info">{item.chipCount} chips</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card-premium admin-company-table-card">
                <div className="p-4 border-b border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h3 className="font-medium text-slate-200">Detalhe dos dispositivos</h3>
                    <p className="text-xs text-slate-500 mt-1">{filteredCompanyChips.length} chip(s) com o filtro atual</p>
                  </div>

                  <select className="input-premium w-full md:w-[260px]" value={companyOwnerFilter} onChange={(e) => setCompanyOwnerFilter(e.target.value)}>
                    <option value="all">Todos os donos</option>
                    {ownerOptions.map((owner) => (
                      <option key={owner.userId} value={String(owner.userId)}>
                        {owner.ownerName}
                      </option>
                    ))}
                  </select>
                </div>

                {safeCompanyChips.length === 0 ? (
                  <AdminEmptyState
                    title="Sem chips na frota"
                    description="Ainda não existem chips conectados a esta instância administrativa."
                  />
                ) : (
                  <table className="table-premium">
                    <thead>
                      <tr>
                        <th>ID Chip</th>
                        <th>Proprietário</th>
                        <th>Status</th>
                        <th>Perfil</th>
                        <th>Última Atividade</th>
                        <th className="text-right pr-4">Logs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCompanyChips.map((chip) => (
                        <tr key={chip.id}>
                          <td className="font-mono text-xs text-indigo-300">CHIP-{String(chip.id).padStart(3, "0")}</td>
                          <td className="text-slate-300">{chip.ownerName}</td>
                          <td>
                            <ChipStatusBadge chip={chip} />
                          </td>
                          <td className="text-slate-400 capitalize">{chip.maturationProfile ?? "normal"}</td>
                          <td className="text-slate-500 text-xs">{formatDate(chip.lastActivity, true)}</td>
                          <td className="text-right pr-4">
                            <button className="text-xs text-indigo-400 hover:text-indigo-300 font-medium" onClick={() => setLocation(`/logs?chipId=${chip.id}`)}>
                              Ver logs
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredCompanyChips.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-0 border-b-0">
                            <AdminEmptyState
                              variant="search"
                              title="Nenhum chip encontrado"
                              description="Troque o dono no filtro para voltar a ver a frota completa."
                            />
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === "audit" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <SectionHeader
                title="Trilha de Auditoria"
                subtitle="Histórico imutável de ações administrativas"
                action={<ShortcutHint text="Alt+5 abre auditoria • Esc limpa seleção" />}
              />

              <div className="card-premium overflow-hidden">
                {safeAuditLogs.length > 0 ? (
                  <table className="table-premium">
                    <thead>
                      <tr>
                        <th>Data/Hora</th>
                        <th>Entidade</th>
                        <th>Ação</th>
                        <th>Alvo</th>
                        <th>Detalhes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {safeAuditLogs.map((log) => (
                        <tr key={log.id} className="opacity-80 hover:opacity-100">
                          <td className="font-mono text-xs text-slate-500">{formatDate(log.createdAt, true)}</td>
                          <td className="text-slate-300">{log.entity}</td>
                          <td>
                            <span className="badge badge-neutral">{log.action}</span>
                          </td>
                          <td className="text-indigo-300">{log.targetUserId ? `user#${log.targetUserId}` : "—"}</td>
                          <td className="text-slate-500 text-xs max-w-xs truncate">{log.payload || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <AdminEmptyState
                    variant="audit"
                    title="Sem eventos de auditoria"
                    description="As ações críticas feitas por admin vão aparecer aqui automaticamente."
                  />
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      <Dialog open={subscriptionDialogOpen} onOpenChange={setSubscriptionDialogOpen}>
        <DialogContent className="bg-transparent border-none shadow-none p-0 max-w-xl">
          <div className="card-premium admin-modal-card">
            <DialogHeader>
              <DialogTitle className="text-white text-xl">Criar assinatura</DialogTitle>
              <DialogDescription className="text-slate-400">
                Vincule um plano a {selectedUser?.name || "este usuário"} para tirar a conta da zona sem assinatura.
              </DialogDescription>
            </DialogHeader>

            <div className="admin-modal-grid">
              <div className="card-premium-muted admin-modal-section">
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Usuário</p>
                <p className="text-lg font-semibold text-white">{selectedUser?.name || "Sem nome"}</p>
                <p className="text-xs text-slate-500 mt-1">{selectedUser?.email || "Sem email"}</p>
              </div>

              <div className="card-premium-muted admin-modal-section">
                <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Plano</p>
                <select className="input-premium w-full" value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)}>
                  <option value="">Selecione um plano</option>
                  {safePlans.map((plan) => (
                    <option key={plan.id} value={String(plan.id)}>
                      {plan.planName} • {formatCurrency(plan.priceMonthly)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <button className="btn-ghost" onClick={() => setSubscriptionDialogOpen(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleCreateSubscription} disabled={createSubscriptionMutation.isPending}>
                {createSubscriptionMutation.isPending ? "Criando..." : "Criar assinatura"}
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="bg-transparent border-none shadow-none p-0 max-w-2xl">
          <div className="card-premium admin-modal-card">
            <DialogHeader>
              <DialogTitle className="text-white text-xl">Editar plano</DialogTitle>
              <DialogDescription className="text-slate-400">Ajuste preço, limites e status do plano comercial.</DialogDescription>
            </DialogHeader>

            <div className="admin-modal-grid">
              <div className="card-premium-muted admin-modal-section">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Nome</p>
                <input className="input-premium w-full" value={planForm.planName} onChange={(e) => setPlanForm((prev) => ({ ...prev, planName: e.target.value }))} />
              </div>
              <div className="card-premium-muted admin-modal-section">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Status</p>
                <select className="input-premium w-full" value={String(planForm.isActive)} onChange={(e) => setPlanForm((prev) => ({ ...prev, isActive: Number(e.target.value) }))}>
                  <option value="1">Ativo</option>
                  <option value="0">Inativo</option>
                </select>
              </div>
              <div className="card-premium-muted admin-modal-section md:col-span-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Descrição</p>
                <input className="input-premium w-full" value={planForm.description} onChange={(e) => setPlanForm((prev) => ({ ...prev, description: e.target.value }))} />
              </div>
              <div className="card-premium-muted admin-modal-section">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Máx chips</p>
                <input className="input-premium w-full" type="number" value={planForm.maxChips} onChange={(e) => setPlanForm((prev) => ({ ...prev, maxChips: Number(e.target.value) }))} />
              </div>
              <div className="card-premium-muted admin-modal-section">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Máx tarefas</p>
                <input className="input-premium w-full" type="number" value={planForm.maxScheduledTasks} onChange={(e) => setPlanForm((prev) => ({ ...prev, maxScheduledTasks: Number(e.target.value) }))} />
              </div>
              <div className="card-premium-muted admin-modal-section">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Máx mensagens/mês</p>
                <input className="input-premium w-full" type="number" value={planForm.maxMessagesPerMonth} onChange={(e) => setPlanForm((prev) => ({ ...prev, maxMessagesPerMonth: Number(e.target.value) }))} />
              </div>
              <div className="card-premium-muted admin-modal-section">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Preço mensal (centavos)</p>
                <input className="input-premium w-full" type="number" value={planForm.priceMonthly} onChange={(e) => setPlanForm((prev) => ({ ...prev, priceMonthly: Number(e.target.value) }))} />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <button className="btn-ghost" onClick={() => setPlanDialogOpen(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleSavePlan} disabled={updatePlanMutation.isPending}>
                {updatePlanMutation.isPending ? "Salvando..." : "Salvar plano"}
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
