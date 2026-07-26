import { useAuth } from "@/_core/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Activity, ArrowRight, Megaphone, MonitorPlay, ShieldCheck, Waves, Workflow } from "lucide-react";
import { useLocation } from "wouter";

export default function AdminSystemsHub() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { data: dashboardData } = trpc.chips.getDashboardData.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: marketingExecutiveSummary } = trpc.chips.getMarketingExecutiveSummary.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const totalChips = dashboardData?.summary?.totalChips ?? 0;
  const connectedChips = dashboardData?.summary?.connectedCount ?? 0;
  const activeMarketingCampaigns = marketingExecutiveSummary?.marketing?.activeCampaigns ?? 0;
  const queuedCampaigns = marketingExecutiveSummary?.marketing?.queuedCampaigns ?? 0;

  return (
    <div className="app-shell bg-app-grid">
      <div className="page-container py-10">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.14em] text-cyan-300 mb-3">Central admin / escolha do sistema</p>
          <h1 className="page-title mb-2">Escolha o sistema operacional</h1>
          <p className="page-subtitle">
            Maturação e Marketing funcionam como dois sistemas independentes. Aqui é só o ponto de entrada.
          </p>
        </div>

        <Card className="demo-hero-panel mb-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 relative z-10">
            <div className="max-w-3xl">
              <div className="demo-badge mb-4">
                <MonitorPlay className="w-4 h-4 text-cyan-300" />
                Modo apresentação pronto
              </div>
              <h2 className="text-3xl font-semibold text-white tracking-tight mb-3">Uma central única, dois sistemas independentes</h2>
              <p className="text-slate-300 leading-7">
                Use esta central para apresentar o produto de forma clara: maturação cuida da base operacional e marketing cuida da execução comercial.
              </p>
            </div>
            <Button className="btn-primary-modern" onClick={() => setLocation("/system-demo")}>
              <ArrowRight className="w-4 h-4 mr-2" />
              Ver apresentação completa
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="card-premium-enhanced p-5 border-cyan-500/15">
            <p className="text-xs uppercase tracking-[0.08em] text-cyan-300">Chips totais</p>
            <p className="text-2xl font-bold text-white mt-2">{totalChips}</p>
          </Card>
          <Card className="card-premium-enhanced p-5 border-emerald-500/15">
            <p className="text-xs uppercase tracking-[0.08em] text-emerald-300">Chips conectados</p>
            <p className="text-2xl font-bold text-white mt-2">{connectedChips}</p>
          </Card>
          <Card className="card-premium-enhanced p-5 border-fuchsia-500/15">
            <p className="text-xs uppercase tracking-[0.08em] text-fuchsia-300">Campanhas ativas</p>
            <p className="text-2xl font-bold text-white mt-2">{activeMarketingCampaigns}</p>
          </Card>
          <Card className="card-premium-enhanced p-5 border-amber-500/15">
            <p className="text-xs uppercase tracking-[0.08em] text-amber-300">Campanhas na fila</p>
            <p className="text-2xl font-bold text-white mt-2">{queuedCampaigns}</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="card-premium-enhanced p-8 border-emerald-500/20 bg-gradient-to-br from-emerald-500/8 to-transparent">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/25">
                <Activity className="w-6 h-6 text-emerald-300" />
              </div>
              <span className="text-xs uppercase tracking-[0.12em] text-emerald-300">Sistema 1</span>
            </div>
            <h2 className="text-2xl font-semibold text-white mb-3">Maturação</h2>
            <p className="text-slate-300 text-sm leading-7 mb-6">
              Ambiente de aquecimento, saúde operacional, ritmo de uso e prontidão dos chips. Não executa campanhas de marketing.
            </p>
            <div className="space-y-2 text-sm text-slate-400 mb-8">
              <p>`Conectar chips`, `perfis`, `logs`, `saúde` e `rotina de maturação`.</p>
              <p>Objetivo: preparar a infraestrutura com comportamento estável.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-8">
              <div className="surface-item-compact">
                <div className="flex items-center gap-2 text-emerald-300 mb-2">
                  <Waves className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-[0.08em]">Base</span>
                </div>
                <p className="text-sm text-white">{connectedChips} chips prontos</p>
              </div>
              <div className="surface-item-compact">
                <div className="flex items-center gap-2 text-emerald-300 mb-2">
                  <Workflow className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-[0.08em]">Foco</span>
                </div>
                <p className="text-sm text-white">Estabilidade operacional</p>
              </div>
            </div>
            <Button className="btn-primary-modern" onClick={() => setLocation("/dashboard")}>
              <ArrowRight className="w-4 h-4 mr-2" />
              Abrir maturação
            </Button>
          </Card>

          <Card className="card-premium-enhanced p-8 border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/8 to-transparent">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="p-3 rounded-2xl bg-fuchsia-500/15 border border-fuchsia-500/25">
                <Megaphone className="w-6 h-6 text-fuchsia-300" />
              </div>
              <span className="text-xs uppercase tracking-[0.12em] text-fuchsia-300">Sistema 2</span>
            </div>
            <h2 className="text-2xl font-semibold text-white mb-3">Marketing e disparo</h2>
            <p className="text-slate-300 text-sm leading-7 mb-6">
              Ambiente de campanhas, fila, lista de bloqueio, agenda, análises e execução comercial. Não controla o motor de maturação.
            </p>
            <div className="space-y-2 text-sm text-slate-400 mb-8">
              <p>`Campanhas`, `fila`, `agendamento`, `tags`, `análises` e `relatórios`.</p>
              <p>Objetivo: operar alcance, conversão e resultado de campanha.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-8">
              <div className="surface-item-compact">
                <div className="flex items-center gap-2 text-fuchsia-300 mb-2">
                  <Waves className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-[0.08em]">Base</span>
                </div>
                <p className="text-sm text-white">{activeMarketingCampaigns} campanhas ativas</p>
              </div>
              <div className="surface-item-compact">
                <div className="flex items-center gap-2 text-fuchsia-300 mb-2">
                  <Workflow className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-[0.08em]">Foco</span>
                </div>
                <p className="text-sm text-white">{queuedCampaigns} campanhas em fila</p>
              </div>
            </div>
            <Button className="bg-fuchsia-500 hover:bg-fuchsia-600 text-black font-semibold" onClick={() => setLocation("/bulk-dispatch")}>
              <ArrowRight className="w-4 h-4 mr-2" />
              Abrir marketing
            </Button>
          </Card>
        </div>

        <Card className="card-premium-enhanced p-6 mt-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-cyan-300 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Separação operacional mantida</p>
              <p className="text-sm text-slate-400 mt-1">
                A central só organiza o acesso. Cada sistema mantém regras, fila, métricas e execução próprias.
              </p>
            </div>
          </div>
        </Card>

        <Card className="card-premium-enhanced p-6 mt-6 border-cyan-500/15">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <MonitorPlay className="w-5 h-5 text-cyan-300 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">Modo demo do sistema</p>
                <p className="text-sm text-slate-400 mt-1">
                  Abra uma versão mais apresentável para mostrar a arquitetura do produto e os dois sistemas separados.
                </p>
              </div>
            </div>
            <Button className="btn-primary-modern" onClick={() => setLocation("/system-demo")}>
              <ArrowRight className="w-4 h-4 mr-2" />
              Abrir demo
            </Button>
          </div>
        </Card>

        <Card className="card-premium-enhanced p-6 mt-6 border-white/10">
          <p className="text-sm font-semibold text-white mb-4">Checklist rápido antes de demonstrar</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="surface-item-compact">
              <p className="text-xs uppercase tracking-[0.08em] text-cyan-300 mb-1">1. Narrativa</p>
              <p className="text-sm text-slate-300">Explique primeiro a separação entre os dois sistemas.</p>
            </div>
            <div className="surface-item-compact">
              <p className="text-xs uppercase tracking-[0.08em] text-emerald-300 mb-1">2. Base</p>
              <p className="text-sm text-slate-300">Mostre maturação como motor de prontidão e saúde.</p>
            </div>
            <div className="surface-item-compact">
              <p className="text-xs uppercase tracking-[0.08em] text-fuchsia-300 mb-1">3. Escala</p>
              <p className="text-sm text-slate-300">Mostre marketing como camada comercial com fila, agenda e análises.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
