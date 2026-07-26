import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { isAdminRole } from "@/lib/access";
import { ArrowRight, Crown, Megaphone, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { useLocation } from "wouter";

export default function UserWorkspace() {
  const { user, isAuthenticated, loading } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "/login",
  });
  const [, setLocation] = useLocation();
  const isAdmin = isAdminRole(user?.role);

  const { data: planData } = trpc.auth.getMyPlanLimits.useQuery(undefined, {
    enabled: !!user?.id,
  });
  const { data: workspaceSummary } = trpc.auth.workspaceSummary.useQuery(undefined, {
    enabled: !!user?.id,
  });

  if (loading) {
    return (
      <div className="app-shell bg-app-grid flex items-center justify-center">
        <Card className="card-premium-enhanced p-8 text-center">
          <p className="text-cyan-400 font-semibold">Carregando área do usuário...</p>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const subscription = planData?.subscription;
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "pendente",
      running: "em andamento",
      completed: "concluída",
      failed: "falhou",
      partial: "parcial",
    };
    return labels[status] ?? status;
  };

  return (
    <div className="app-shell bg-app-grid">
      <div className="page-container">
        <div className="page-hero md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300 mb-5">
              <Sparkles className="w-4 h-4" />
              M13 Group apresenta W.M.S.E
            </div>
            <h1 className="page-title mb-2">Área do usuário</h1>
            <p className="page-subtitle">
              Acompanhe sua conta, assinatura e acesso ao sistema. A operação, o monitoramento e o painel administrativo ficam separados na área do administrador.
            </p>
          </div>
          <Button className="btn-primary-modern" onClick={() => setLocation("/profile")}>
            <UserRound className="w-4 h-4" />
            Abrir meu perfil
          </Button>
        </div>

        <Card className="card-premium-enhanced p-6 mb-8">
          <div className="summary-grid">
            <div className="summary-pill">
              <p className="summary-pill-label">Conta</p>
              <p className="summary-pill-value">{user.name || "Usuário"}</p>
            </div>
            <div className="summary-pill">
              <p className="summary-pill-label">Email</p>
              <p className="summary-pill-value">{user.email || "Sem email"}</p>
            </div>
            <div className="summary-pill">
              <p className="summary-pill-label">Perfil</p>
              <p className="summary-pill-value">{isAdmin ? "Administrador" : "Usuário"}</p>
            </div>
            <div className="summary-pill">
              <p className="summary-pill-label">Assinatura</p>
              <p className="summary-pill-value capitalize">{subscription?.status || "Sem dados"}</p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
          <Card className="card-premium-enhanced p-6">
            <h2 className="section-title">W.M.S.E</h2>
            <p className="text-slate-300 leading-7 mb-6">
              `W.M.S.E` é o produto operacional da `M13 Group`, com entrada separada entre área do usuário e área administrativa. Nesta tela você acompanha conta, assinatura e acesso, sem a camada técnica de operação.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="ops-glance-card">
                <p className="ops-glance-title">Identidade mais limpa</p>
                <p className="ops-glance-copy">A área do usuário fica separada do monitoramento técnico para reduzir ruído e evitar confusão de permissões.</p>
              </div>
              <div className="ops-glance-card">
                <p className="ops-glance-title">Controle central</p>
                <p className="ops-glance-copy">Somente o admin acessa dashboard operacional, monitoramento, chips, relatórios e o painel completo do sistema.</p>
              </div>
            </div>
          </Card>

          <Card className="card-premium-enhanced p-6">
            <h2 className="section-title-soft">Acesso rápido</h2>
            <div className="space-y-3">
              <button className="ops-glance-card text-left w-full" onClick={() => setLocation("/plans")}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="ops-glance-title">Ver planos</p>
                    <p className="ops-glance-copy">Consulte categorias, faixas e posicionamento comercial.</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-cyan-300" />
                </div>
              </button>

              <button className="ops-glance-card text-left w-full" onClick={() => setLocation("/profile")}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="ops-glance-title">Meu perfil</p>
                    <p className="ops-glance-copy">Revise seus dados, assinatura e informações da conta.</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-cyan-300" />
                </div>
              </button>

              {isAdmin ? (
                <button className="ops-glance-card text-left w-full" onClick={() => setLocation("/bulk-dispatch")}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="ops-glance-title">Abrir sistema de marketing</p>
                      <p className="ops-glance-copy">Acesse o ambiente comercial separado para campanhas, fila, agenda e análises.</p>
                    </div>
                    <Megaphone className="w-4 h-4 text-cyan-300" />
                  </div>
                </button>
              ) : null}

              <div className="surface-item-compact">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-white">Operação protegida</p>
                    <p className="text-xs text-slate-400 mt-1">A parte crítica de sistema e monitoramento permanece isolada para administração.</p>
                  </div>
                </div>
              </div>

              <div className="surface-item-compact">
                <div className="flex items-start gap-3">
                  <Crown className="w-5 h-5 text-amber-300 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-white">Marca em transição</p>
                    <p className="text-xs text-slate-400 mt-1">A base visual já passou a usar `M13 Group` como marca e `W.M.S.E` como produto.</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 mt-6">
          <Card className="card-premium-enhanced p-6">
            <h2 className="section-title">Resumo de disparos</h2>
            {workspaceSummary?.recentDispatchJobs?.length ? (
              <div className="space-y-3">
                {workspaceSummary.recentDispatchJobs.map((job) => (
                  <div key={job.id} className="surface-item-compact">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{job.executionType === "dispatch" ? `Campanha #${job.id}` : `Execução #${job.id}`}</p>
                        <p className="text-xs text-slate-400 mt-1">Chip #{job.chipId ?? "n/d"} • {job.totalTargets || 0} destinatários • {job.totalMessagesSent || 0} envios</p>
                      </div>
                      <span className={`badge ${job.status === "completed" ? "badge-success" : job.status === "failed" ? "badge-danger" : "badge-warning"}`}>
                        {getStatusLabel(job.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Ainda não há campanhas recentes vinculadas à sua conta.</p>
            )}
          </Card>

          <Card className="card-premium-enhanced p-6">
            <h2 className="section-title-soft">Chips em rotação</h2>
            {workspaceSummary?.chips?.length ? (
              <div className="space-y-3">
                {workspaceSummary.chips.slice(0, 6).map((chip) => (
                  <div key={chip.id} className="surface-item-compact">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{chip.chipName}</p>
                        <p className="text-xs text-slate-400 mt-1 capitalize">{chip.status} • {chip.isPaused ? "pausado" : "ativo"}</p>
                      </div>
                      <span className={`badge ${chip.rotationActive ? "badge-info" : "badge-neutral"}`}>
                        {chip.rotationActive ? "em rotação" : "fora da rotação"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Nenhum chip associado à sua conta no momento.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
